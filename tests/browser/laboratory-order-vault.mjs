import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

// Synthetic browser receipt only: run from a disposable copy without .git.
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
const html = path.join(web, "laboratory-order-vault-browser.html");
let server, browser;
try {
  await fs.writeFile(html, "<html><body>Synthetic laboratory order vault</body></html>");
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
  const account = "94000000-0000-4000-8000-000000000001";
  const clinic = "94000000-0000-4000-8000-000000000002";
  const other = "94000000-0000-4000-8000-000000000003";
  const phrase = "synthetic laboratory vault phrase";
  const page = await context.newPage();
  await page.goto("/laboratory-order-vault-browser.html");
  const key = await page.evaluate(async ({ account, clinic, phrase }) => {
    const crypto = await import("/src/features/drafts/vault-crypto.ts");
    const storage = await import("/src/features/drafts/local-vault.ts");
    const intent = await import("/src/features/drafts/laboratory-order-intent.ts");
    const db = await storage.openLocalVault();
    const prepared = await crypto.prepareVault(account, phrase);
    await storage.createVault(db, prepared.envelope);
    const request = {
      clinic_id: clinic, idempotency_key: globalThis.crypto.randomUUID(), confirmed_warnings: false,
      input: {
        patient: { internal_reference: "SYNTHETIC" }, requested_delivery_date: null,
        material_id: globalThis.crypto.randomUUID(), shade_id: globalThis.crypto.randomUUID(),
        teeth: [], file_ids: [],
      },
    };
    const active = { db, envelope: prepared.envelope, key: prepared.active };
    await intent.prepareLaboratoryOrderAttempt(active, account, request, new AbortController().signal);
    db.close();
    return request.idempotency_key;
  }, { account, clinic, phrase });
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("/laboratory-order-vault-browser.html");
  const result = await reopened.evaluate(async ({ account, clinic, other, phrase, key }) => {
    const crypto = await import("/src/features/drafts/vault-crypto.ts");
    const storage = await import("/src/features/drafts/local-vault.ts");
    const intent = await import("/src/features/drafts/laboratory-order-intent.ts");
    const db = await storage.openLocalVault();
    const envelope = await storage.readVault(db, account);
    let foreignDenied = false;
    try { await crypto.unlockVault(envelope, other, phrase, "phrase"); }
    catch { foreignDenied = true; }
    const active = { db, envelope, key: await crypto.unlockVault(envelope, account, phrase, "phrase") };
    const pending = await intent.readLaboratoryOrderIntent(active, account);
    let accountDenied = false, clinicDenied = false, payloadDenied = false;
    try { await intent.readLaboratoryOrderIntent(active, other); }
    catch { accountDenied = true; }
    try { await intent.prepareLaboratoryOrderAttempt(active, account, { ...pending.request, clinic_id: other }, new AbortController().signal); }
    catch { clinicDenied = true; }
    try { await intent.prepareLaboratoryOrderAttempt(active, account, { ...pending.request, input: { ...pending.request.input, description: "CHANGED" } }, new AbortController().signal); }
    catch { payloadDenied = true; }
    await intent.prepareLaboratoryOrderAttempt(active, account, pending.request, new AbortController().signal);
    const reply = {
      kind: "submitted", persisted: true, order_id: globalThis.crypto.randomUUID(),
      number: "123", received_at: new Date().toISOString(), replayed: true,
    };
    await intent.settleLaboratoryOrderIntent(active, account, pending.request, reply);
    db.close();
    return { foreignDenied, accountDenied, clinicDenied, payloadDenied,
      retainedKey: pending.request.idempotency_key === key, state: pending.state,
      expectedClinic: pending.clinicId === clinic, replyId: reply.order_id };
  }, { account, clinic, other, phrase, key });
  assert.deepEqual({ ...result, replyId: undefined }, {
    foreignDenied: true, accountDenied: true, clinicDenied: true,
    payloadDenied: true, retainedKey: true, state: "uncertain", expectedClinic: true,
    replyId: undefined,
  });
  const settled = await reopened.evaluate(async ({ account, phrase }) => {
    const crypto = await import("/src/features/drafts/vault-crypto.ts");
    const storage = await import("/src/features/drafts/local-vault.ts");
    const intent = await import("/src/features/drafts/laboratory-order-intent.ts");
    const db = await storage.openLocalVault();
    const envelope = await storage.readVault(db, account);
    const active = { db, envelope, key: await crypto.unlockVault(envelope, account, phrase, "phrase") };
    const saved = await intent.readLaboratoryOrderIntent(active, account);
    const matches = saved.state === "settled" && saved.reply.order_id && saved.request === null;
    await intent.clearLaboratoryOrderIntent(active, account);
    const cleared = await intent.readLaboratoryOrderIntent(active, account);
    db.close();
    return { matches, cleared: cleared === null };
  }, { account, phrase });
  assert.equal(settled.matches, result.replyId);
  assert.equal(settled.cleared, true);
  assert.equal(requests, 0, "NO_AUTOMATIC_SUBMISSION");
  console.log("Synthetic laboratory order: encrypted reopening, exact manual replay, account/clinic isolation and receipt");
} finally {
  await browser?.close();
  await server?.close();
  await fs.rm(html, { force: true });
}
