import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const root = process.cwd();
assert(root.startsWith("/srv/dental-lab/.local/"), "ISOLATED_COPY_REQUIRED");
await assert.rejects(fs.access(path.join(root, ".git")));
const cgroup = "/sys/fs/cgroup/system.slice/dental-ai-remote.service";
const [current, maximum] = await Promise.all([
  fs.readFile(path.join(cgroup, "pids.current"), "utf8"),
  fs.readFile(path.join(cgroup, "pids.max"), "utf8"),
]);
assert(
  Number(maximum) - Number(current) >= 64,
  "BROWSER_PROCESS_MARGIN_REQUIRED",
);
const web = path.join(root, "apps/web");
const html = path.join(web, "similarity-browser.html");
const entry = path.join(web, "src/similarity-browser.tsx");
const id = "91000000-0000-4000-8000-000000000001";
const shade = "91000000-0000-4000-8000-000000000002";
const order = "91000000-0000-4000-8000-000000000003";
let server,
  browser,
  submitted = 0,
  searched = 0,
  mode = "empty";
const json = (route, body, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
    headers: { "cache-control": "no-store" },
  });
try {
  await fs.writeFile(
    html,
    '<html><body><main id="root"></main><script type="module" src="/src/similarity-browser.tsx"></script></body></html>',
  );
  await fs.writeFile(
    entry,
    `import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ClinicOrderForm } from "./features/orders/ClinicOrderForm.js";
import { OrderTrackingPanel } from "./features/orders/OrderTrackingPanel.js";
function Harness() {
  const [number, setNumber] = useState<string | null>(null);
  return <>
    <OrderTrackingPanel key={number ?? ""} clinic={true}
      permissions={["orders.read_logistics"]} initialSearchNumber={number ?? ""} />
    <ClinicOrderForm onInspectSimilar={setNumber} />
  </>;
}
createRoot(document.getElementById("root")!).render(<Harness />);`,
  );
  server = await createServer({
    root: web,
    configFile: path.join(web, "vite.config.mjs"),
    envDir: false,
    server: { host: "127.0.0.1", port: 0 },
    clearScreen: false,
  });
  await server.listen();
  const base = server.resolvedUrls.local[0].replace("localhost", "127.0.0.1");
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: [
      "--no-sandbox",
      "--no-zygote",
      "--single-process",
      "--renderer-process-limit=1",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-background-networking",
      "--disable-crash-reporter",
      "--disable-breakpad",
    ],
  });
  const context = await browser.newContext({ baseURL: base });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(base).origin) return route.abort();
    if (url.pathname.startsWith("/api/v1/catalog/")) {
      const kind = url.pathname.split("/").at(-1);
      return json(route, {
        items: [
          {
            id: kind === "material" ? id : shade,
            kind,
            label: "Sintetik " + kind,
            revision: 1,
          },
        ],
        next_after: null,
      });
    }
    if (url.pathname === "/api/v1/orders/preflight")
      return mode === "preflight_error"
        ? json(route, {}, 500)
        : json(route, {
            persisted: false,
            status: "checked",
            reasons: [],
            warnings: ["low_detail"],
            references: [
              {
                id,
                kind: "material",
                label: "Sintetik",
                revision: 1,
                state: "available",
              },
              {
                id: shade,
                kind: "shade",
                label: "Sintetik",
                revision: 1,
                state: "available",
              },
            ],
          });
    if (url.pathname === "/api/v1/orders/similar") {
      if (mode === "unavailable") return json(route, {}, 403);
      if (mode === "malformed")
        return json(route, { matches: [], patient_name: "FORBIDDEN_LEAK" });
      return json(route, {
        matches:
          mode === "match"
            ? [
                {
                  order_id: order,
                  number: "123",
                  signal: "same_reference_and_work",
                },
              ]
            : [],
      });
    }
    if (url.pathname === "/api/v1/orders/submit") {
      submitted++;
      return json(route, {
        kind: "submitted",
        persisted: true,
        order_id: order,
        number: "124",
        received_at: "2026-10-20T12:00:00.000Z",
        replayed: false,
      });
    }
    if (url.pathname === "/api/v1/orders/search") {
      searched++;
      return json(route, {
        can_read_details: true,
        items: [
          {
            id: order,
            number: "123",
            clinic_name: "Clinique synthétique",
            kind: "normal",
            origin: "clinic",
            status: "pending",
            received_at: "2026-10-20T12:00:00.000Z",
            requested_delivery_date: "2026-11-01",
            planned_delivery_date: null,
            priority: false,
          },
        ],
        next_after: null,
      });
    }
    if (url.pathname.startsWith("/api/")) return json(route, {}, 404);
    return route.continue();
  });
  const form = page.getByRole("region", { name: "Përgatitja e porosisë" });
  async function prepare(scenario) {
    mode = scenario;
    await page.goto("/similarity-browser.html");
    await form.getByLabel("Referenca e klinikës").fill("SYNTHETIC-REF");
    await form.getByLabel("Data e dëshiruar").fill("2026-11-01");
    await form.getByRole("button", { name: "Ngarko materiali" }).click();
    await form.getByLabel("Materiali", { exact: true }).selectOption(id);
    await form.getByRole("button", { name: "Ngarko ngjyra" }).click();
    await form.getByLabel("Ngjyra", { exact: true }).selectOption(shade);
    await form.getByRole("button", { name: "Kontrollo të dhënat" }).click();
  }
  async function submit() {
    await form.getByRole("checkbox").check();
    await form
      .getByRole("button", { name: "Konfirmo dhe dërgo porosinë" })
      .click();
    await form.getByText("Porosia nr. 124", { exact: false }).waitFor();
  }
  await prepare("empty");
  await form.getByText("Kontrolli përfundoi.", { exact: false }).waitFor();
  assert.equal(
    await form.getByRole("link", { name: "Shikoni porosinë në listë" }).count(),
    0,
  );
  await submit();
  await prepare("match");
  const link = form.getByRole("link", { name: "Shikoni porosinë në listë" });
  await link.waitFor();
  assert.match(await form.getByRole("alert").last().innerText(), /Nr. 123/);
  await link.focus();
  await page.keyboard.press("Enter");
  assert.equal(new URL(page.url()).hash, "#order-tracking");
  const tracking = page.getByRole("region", { name: "Ndjekja e porosive" });
  assert.equal(
    await tracking
      .getByLabel("Numri, klinika ose pacienti (sipas lejeve)")
      .inputValue(),
    "123",
  );
  await tracking.getByRole("button", { name: "Kërko", exact: true }).click();
  await tracking.getByText("123", { exact: false }).first().waitFor();
  assert(searched > 0);
  await submit();
  for (const scenario of ["unavailable", "malformed"]) {
    await prepare(scenario);
    await form
      .getByText("Kontrolli i ngjashmërisë nuk u përfundua", { exact: false })
      .waitFor();
    assert.equal(await form.getByText("FORBIDDEN_LEAK").count(), 0);
    await submit();
  }
  await prepare("preflight_error");
  await form.getByText("Kontrolli nuk u përfundua", { exact: false }).waitFor();
  assert.equal(
    await form
      .getByRole("button", { name: "Konfirmo dhe dërgo porosinë" })
      .count(),
    0,
  );
  assert.equal(submitted, 4);
  await context.close();
  console.log(
    JSON.stringify({
      result: "synthetic-browser-similarity-passed",
      scenarios: 5,
      submitted,
      searched,
    }),
  );
} finally {
  if (browser) await browser.close();
  if (server) await server.close();
  await fs.rm(html, { force: true });
  await fs.rm(entry, { force: true });
}
