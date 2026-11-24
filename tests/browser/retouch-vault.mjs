import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

// Run only from a disposable copy without .git, after checking the VPS process margin.
const root = process.cwd();
assert(root.startsWith("/srv/dental-lab/.local/"), "ISOLATED_COPY_REQUIRED");
await assert.rejects(fs.access(path.join(root, ".git")));
const cgroup = "/sys/fs/cgroup/system.slice/dental-ai-remote.service";
const [current, maximum] = await Promise.all([
  fs.readFile(path.join(cgroup, "pids.current"), "utf8"),
  fs.readFile(path.join(cgroup, "pids.max"), "utf8"),
]);
assert(Number(maximum) - Number(current) >= 64, "BROWSER_PROCESS_MARGIN_REQUIRED");
const web = path.join(root, "apps/web");
const html = path.join(web, "retouch-vault-browser.html");
let server, browser;
try {
  await fs.writeFile(html, "<html><body>Isolated synthetic vault</body></html>");
  server = await createServer({
    root: web,
    configFile: path.join(web, "vite.config.mjs"),
    envDir: false,
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  const base = server.resolvedUrls.local[0].replace("localhost", "127.0.0.1");
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium", headless: true,
    args: ["--no-sandbox", "--no-zygote", "--single-process", "--renderer-process-limit=1", "--disable-gpu", "--disable-dev-shm-usage", "--disable-background-networking"],
  });
  const context = await browser.newContext({ baseURL: base });
  let requests = 0;
  await context.route("**/api/**", (route) => { requests++; return route.abort(); });
  const account = "91000000-0000-4000-8000-000000000001";
  const source = "91000000-0000-4000-8000-000000000002";
  const phrase = "synthetic vault phrase only";
  const page = await context.newPage();
  await page.goto("/retouch-vault-browser.html");
  const key = await page.evaluate(async ({ account, source, phrase }) => {
    const crypto = await import("/src/features/drafts/vault-crypto.ts");
    const storage = await import("/src/features/drafts/local-vault.ts");
    const intent = await import("/src/features/drafts/retouch-intent.ts");
    const db = await storage.openLocalVault();
    const prepared = await crypto.prepareVault(account, phrase);
    await storage.createVault(db, prepared.envelope);
    const request = {
      idempotency_key: globalThis.crypto.randomUUID(), confirmed_warnings: false,
      input: {
        source_order_id: source, expected_source_version_id: globalThis.crypto.randomUUID(),
        expected_source_revision: 1, intervention_kind: "retouch", material_id: globalThis.crypto.randomUUID(),
        shade_id: globalThis.crypto.randomUUID(), description: "Synthetic dental work", file_ids: [],
      },
    };
    const active = { db, envelope: prepared.envelope, key: prepared.active };
    await intent.stageRetouchIntent(active, request);
    await intent.markRetouchAttempt(active, request);
    db.close();
    return request.idempotency_key;
  }, { account, source, phrase });
  await page.close(); // The encrypted IndexedDB record survives a closed tab.
  const reopened = await context.newPage();
  await reopened.goto("/retouch-vault-browser.html");
  const result = await reopened.evaluate(async ({ account, source, phrase, key }) => {
    const crypto = await import("/src/features/drafts/vault-crypto.ts");
    const storage = await import("/src/features/drafts/local-vault.ts");
    const intent = await import("/src/features/drafts/retouch-intent.ts");
    const db = await storage.openLocalVault();
    const envelope = await storage.readVault(db, account);
    let foreignDenied = false;
    try { await crypto.unlockVault(envelope, source, phrase, "phrase"); }
    catch { foreignDenied = true; }
    const active = { db, envelope, key: await crypto.unlockVault(envelope, account, phrase, "phrase") };
    const pending = await intent.readRetouchIntent(active);
    let otherWorkDenied = false;
    try { await intent.clearRetouchIntent(active, account); }
    catch { otherWorkDenied = true; }
    const same = await intent.markRetouchAttempt(active, pending.request);
    const reply = {
      kind: "submitted", persisted: true, order_id: globalThis.crypto.randomUUID(),
      number: "123", received_at: new Date().toISOString(), replayed: true,
    };
    await intent.settleRetouchIntent(active, pending.request, reply);
    const confirmed = await intent.readRetouchIntent(active);
    db.close();
    return { foreignDenied, otherWorkDenied, retainedKey: same.request.idempotency_key === key,
      confirmed: confirmed.reply.order_id === reply.order_id && confirmed.state === "settled" };
  }, { account, source, phrase, key });
  assert.deepEqual(result, { foreignDenied: true, otherWorkDenied: true, retainedKey: true, confirmed: true });
  assert.equal(requests, 0, "NO_AUTOMATIC_SUBMISSION");
  const purged = await reopened.evaluate(async (account) => {
    const storage = await import("/src/features/drafts/local-vault.ts");
    await storage.purgeSuspendedAccount(account); // Synthetic, isolated browser only.
    const db = await storage.openLocalVault();
    const envelope = await storage.readVault(db, account);
    db.close();
    return envelope === null;
  }, account);
  assert.equal(purged, true, "CONFIRMED_SUSPENSION_PURGES_SYNTHETIC_VAULT");
  console.log("Synthetic encrypted retouch vault: reopened, explicit replay, receipt, account and source isolation");
} finally {
  await browser?.close();
  await server?.close();
  await fs.rm(html, { force: true });
}
