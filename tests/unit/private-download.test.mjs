import { test, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, chmod, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createPrivateObjectStore } from "../../apps/api/src/modules/files/private-object-store.ts";
import { createOrderFileDownloadRepository } from "../../apps/api/src/modules/orders/file-download.repository.ts";

const actor = { accountId: randomUUID(), sessionId: randomUUID() };
const clinicId = randomUUID();
const input = {
  order_id: randomUUID(),
  version_id: randomUUID(),
  file_id: randomUUID(),
};
function database({
  profile = "employee",
  grants = [
    "orders.read_logistics",
    "orders.read_details",
    "files.view",
    "files.download",
  ],
  foreign = false,
  state = "ready",
  wrongVersion = false,
} = {}) {
  return {
    transaction: (fn) =>
      fn({
        query: async (sql, values = []) => {
          if (sql.startsWith("SELECT a.profile"))
            return {
              rows: [
                {
                  profile,
                  lifecycle: "active",
                  sessionValid: true,
                  securityLocked: false,
                  resetRequired: false,
                  ownerCurrent: false,
                  clinicId: profile === "clinic" ? clinicId : null,
                  clinicSuspended: false,
                  grants,
                },
              ],
            };
          if (
            sql.startsWith(
              "SELECT id FROM public.clinics WHERE account_id=$1 AND",
            )
          )
            return { rows: [{ id: clinicId }] };
          if (sql.startsWith("SELECT f.object_key")) {
            expect(sql).toContain("u.state='ready'");
            expect(sql).toContain("b.version_id=o.current_version_id");
            return {
              rows:
                foreign ||
                state !== "ready" ||
                wrongVersion ||
                values[1] !== input.version_id
                  ? []
                  : [
                      {
                        object_key: "a".repeat(64),
                        sha256: "b".repeat(64),
                        size_bytes: "3",
                      },
                    ],
            };
          }
          return { rows: [] };
        },
      }),
  };
}
test("download grant is distinct and SQL receipt requires current scoped association and ready state", async () => {
  const authorized = createOrderFileDownloadRepository(database());
  expect((await authorized.authorize(actor, input)).kind).toBe("authorized");
  for (const scenario of [
    { grants: ["orders.read_logistics", "orders.read_details", "files.view"] },
    { foreign: true },
    { state: "verifying" },
    { wrongVersion: true },
  ])
    expect(
      (
        await createOrderFileDownloadRepository(database(scenario)).authorize(
          actor,
          input,
        )
      ).kind,
    ).toBe("denied");
  expect(
    (await authorized.authorize(actor, { ...input, file_id: "bad" })).kind,
  ).toBe("invalid");
  expect(
    (
      await createOrderFileDownloadRepository(
        database({ profile: "clinic" }),
      ).authorize(actor, input)
    ).kind,
  ).toBe("authorized");
});
test("private sealed read streams bounded bytes, fails before yielding a tampered object", async () => {
  const root = await mkdtemp(
    path.join(process.cwd(), ".local", "dental-download-synthetic-"),
  );
  try {
    await chmod(root, 0o700);
    for (const name of ["quarantine", "objects"])
      await mkdir(path.join(root, name), { mode: 0o700 });
    const store = await createPrivateObjectStore(root, [
      path.join(root, "public"),
    ]);
    const target = await store.create();
    await target.write(Buffer.from("abc"));
    const sealed = await target.seal();
    const chunks = [];
    for await (const bytes of store.readSealed(
      sealed.objectKey,
      sealed.sizeBytes,
      sealed.sha256,
    ))
      chunks.push(bytes);
    expect(Buffer.concat(chunks).toString()).toBe("abc");
    const name = path.join(root, "objects", sealed.objectKey);
    await chmod(name, 0o600);
    await writeFile(name, "xyz");
    const iterator = store.readSealed(
      sealed.objectKey,
      sealed.sizeBytes,
      sealed.sha256,
    );
    await expect(iterator.next()).rejects.toThrow("PRIVATE_OBJECT_INTEGRITY");
    expect(chunks).toHaveLength(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
