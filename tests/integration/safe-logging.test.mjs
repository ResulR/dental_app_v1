import { expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { createTechnicalLogger } from "../../apps/api/dist/shared/logging.js";
import { createAuditWriter } from "../../apps/api/dist/modules/audit/index.js";
test("500 is correlated without echoing URL, header, body, message or stack", async () => {
  const lines = [];
  const marker = "SYNTHETIC_PRIVATE_MARKER";
  const app = createApp(
    (app) => {
      app.post("/test-failure", () => {
        throw new Error(marker);
      });
    },
    createTechnicalLogger((line) => lines.push(line)),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  try {
    const response = await fetch(
      "http://127.0.0.1:" +
        server.address().port +
        "/test-failure?secret=" +
        marker,
      {
        method: "POST",
        headers: {
          authorization: "Bearer " + marker,
          "x-request-id": marker,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          patient: marker,
          password: marker,
          recovery_code: marker,
        }),
      },
    );
    expect(response.status).toBe(500);
    const problem = await response.json();
    expect(response.headers.get("x-request-id")).toBe(problem.request_id);
    expect(problem.request_id).not.toBe(marker);
    expect(lines).toHaveLength(1);
    const log = JSON.parse(lines[0]);
    expect(log.request_id).toBe(problem.request_id);
    expect(log.level).toBe("error");
    expect(log.route).toBe("unmatched");
    expect(JSON.stringify({ log, problem })).not.toContain(marker);
    for (const forbidden of [
      "url",
      "body",
      "headers",
      "message",
      "stack",
      "patient",
    ])
      expect(log).not.toHaveProperty(forbidden);
  } finally {
    await closeServer(server);
  }
});
test("audit append destination is separate and failed append propagates", async () => {
  const directory = await fs.mkdtemp(path.resolve(".local/log-test-"));
  try {
    const technicalFile = path.join(directory, "technical.jsonl");
    const auditFile = path.join(directory, "audit.jsonl");
    const lines = [];
    createTechnicalLogger((line) => lines.push(line))({
      event: "api_started",
      password: "SYNTHETIC_PRIVATE_MARKER",
    });
    await fs.writeFile(technicalFile, lines.join("\n") + "\n", { mode: 0o600 });
    const input = {
      action: "ORDER_SUBMITTED",
      actorAccountId: "account-synthetic",
      objectType: "order",
      objectId: "order-synthetic",
      requestId: randomUUID(),
      revision: 0,
      patient: "SYNTHETIC_PRIVATE_MARKER",
    };
    await createAuditWriter((record) =>
      fs.appendFile(auditFile, JSON.stringify(record) + "\n", { mode: 0o600 }),
    )(input);
    await expect(
      createAuditWriter(async () => {})({
        ...input,
        requestId: "-".repeat(36),
      }),
    ).rejects.toThrow("INVALID_AUDIT_RECORD");
    const technical = await fs.readFile(technicalFile, "utf8");
    const audit = await fs.readFile(auditFile, "utf8");
    expect(technical).not.toContain("ORDER_SUBMITTED");
    expect(audit).not.toContain("api_started");
    expect(technical + audit).not.toContain("SYNTHETIC_PRIVATE_MARKER");
    await expect(
      createAuditWriter(async () => {
        throw new Error("append refused");
      })(input),
    ).rejects.toThrow("append refused");
    await expect(
      createAuditWriter(async () => {})({
        ...input,
        action: "ARBITRARY_SECRET",
      }),
    ).rejects.toThrow("INVALID_AUDIT_RECORD");
  } finally {
    await fs.rm(directory, { recursive: true });
  }
});
