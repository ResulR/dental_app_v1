import { test, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import { createLogoPipeline } from "../../apps/api/dist/modules/files/index.js";
const actor = { accountId: "synthetic", sessionId: "synthetic" },
  policy = {
    maxUploadBytes: 64,
    maxNormalizedBytes: 64,
    maxPixels: 16,
    maxChunks: 4,
  };
async function* source(bytes = Buffer.from("synthetic")) {
  yield bytes;
}
function fixture(patch = {}) {
  const image = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(image);
  image.writeUInt32BE(13, 8);
  image.write("IHDR", 12);
  image.writeUInt32BE(2, 16);
  image.writeUInt32BE(2, 20);
  // A trusted inspector DOUBLE, not proof this synthetic header is a decoded PNG.
  const ports = {
    authorize: vi.fn(async () => true),
    reserve: vi.fn(async () => "synthetic-reservation"),
    quarantine: vi.fn(async () => {}),
    inspect: vi.fn(async (input) => ({
      bytes: image,
      mime: "image/png",
      width: 2,
      height: 2,
      sourceSha256: input.sha256,
      scannerVersion: "synthetic-scan",
      decoderVersion: "synthetic-decoder",
    })),
    publish: vi.fn(async () => "published"),
    retain: vi.fn(async () => {}),
    ...patch,
  };
  return { ports, pipeline: createLogoPipeline(policy, ports), image };
}
test("authorization and capacity precede source consumption; missing prerequisites never fall back", async () => {
  for (const patch of [
    { authorize: vi.fn(async () => false) },
    { reserve: vi.fn(async () => null) },
  ]) {
    const f = fixture(patch),
      receive = vi.fn();
    const stream = {
      async *[Symbol.asyncIterator]() {
        receive();
        yield Buffer.from("synthetic");
      },
    };
    expect(["denied", "capacity"]).toContain(
      (await f.pipeline.prepareAndPublish(actor, 1, stream)).kind,
    );
    expect(receive).not.toHaveBeenCalled();
    expect(f.ports.inspect).not.toHaveBeenCalled();
  }
  expect(() => createLogoPipeline({ ...policy, maxPixels: 0 }, {})).toThrow(
    "POLICY_REQUIRED",
  );
  expect(() => createLogoPipeline(policy, {})).toThrow("DEPENDENCIES_REQUIRED");
});
test("ordered quarantine inspection reauthorization and publication carry exact content hashes and revision", async () => {
  const f = fixture();
  expect(await f.pipeline.prepareAndPublish(actor, 3, source())).toEqual({
    kind: "published",
  });
  expect(f.ports.reserve).toHaveBeenCalledWith(128);
  expect(f.ports.authorize).toHaveBeenCalledTimes(2);
  expect(f.ports.quarantine.mock.invocationCallOrder[0]).toBeLessThan(
    f.ports.inspect.mock.invocationCallOrder[0],
  );
  expect(f.ports.inspect.mock.invocationCallOrder[0]).toBeLessThan(
    f.ports.publish.mock.invocationCallOrder[0],
  );
  expect(f.ports.publish.mock.calls[0][0]).toMatchObject({
    actor,
    expectedRevision: 3,
    sha256: createHash("sha256").update(f.image).digest("hex"),
  });
  expect(f.ports.retain).not.toHaveBeenCalled();
});
test("oversize empty and fragmented source fail before inspection and preserve reservation evidence", async () => {
  for (const bytes of [Buffer.alloc(65), Buffer.alloc(0)]) {
    const f = fixture();
    await expect(
      f.pipeline.prepareAndPublish(actor, 1, source(bytes)),
    ).rejects.toThrow("PIPELINE_FAILED");
    expect(f.ports.inspect).not.toHaveBeenCalled();
    expect(f.ports.publish).not.toHaveBeenCalled();
    expect(f.ports.retain).toHaveBeenCalledTimes(1);
  }
  const f = fixture();
  async function* chunks() {
    for (let n = 0; n < 5; n++) yield Buffer.from("x");
  }
  await expect(
    f.pipeline.prepareAndPublish(actor, 1, chunks()),
  ).rejects.toThrow("PIPELINE_FAILED");
  expect(f.ports.publish).not.toHaveBeenCalled();
});
test("failed scan wrong hash oversized pixels or missing inspection provenance can never publish", async () => {
  for (const patch of [
    { sourceSha256: "wrong" },
    { width: 17 },
    { scannerVersion: "" },
    { decoderVersion: "" },
    { mime: "image/svg+xml" },
    { bytes: Buffer.from("<script>bad</script>") },
  ]) {
    const f = fixture(),
      base = f.ports.inspect.getMockImplementation();
    f.ports.inspect.mockImplementation(async (input) => ({
      ...(await base(input)),
      ...patch,
    }));
    await expect(
      f.pipeline.prepareAndPublish(actor, 1, source()),
    ).rejects.toThrow("PIPELINE_FAILED");
    expect(f.ports.publish).not.toHaveBeenCalled();
  }
  const f = fixture({
    inspect: vi.fn(async () => {
      throw new Error("scan unavailable");
    }),
  });
  await expect(
    f.pipeline.prepareAndPublish(actor, 1, source()),
  ).rejects.toThrow("PIPELINE_FAILED");
  expect(f.ports.publish).not.toHaveBeenCalled();
});
test("revoked permission prevents publication; uncertain commit preserves evidence and never retries", async () => {
  const f = fixture();
  f.ports.authorize.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  expect(await f.pipeline.prepareAndPublish(actor, 1, source())).toEqual({
    kind: "denied",
  });
  expect(f.ports.publish).not.toHaveBeenCalled();
  const uncertain = fixture({
    publish: vi.fn(async () => {
      throw new Error("connection lost");
    }),
  });
  await expect(
    uncertain.pipeline.prepareAndPublish(actor, 1, source()),
  ).rejects.toThrow("PIPELINE_FAILED");
  expect(uncertain.ports.publish).toHaveBeenCalledTimes(1);
  expect(uncertain.ports.retain.mock.calls[0][0].outcome).toBe("uncertain");
});
test("retention failure is explicit and not retried; admission serializes one pipeline instance", async () => {
  const f = fixture({
    publish: vi.fn(async () => "conflict"),
    retain: vi.fn(async () => {
      throw new Error("retention failed");
    }),
  });
  await expect(
    f.pipeline.prepareAndPublish(actor, 1, source()),
  ).rejects.toThrow("RETENTION_FAILED");
  expect(f.ports.retain).toHaveBeenCalledTimes(1);
  let release;
  const paused = fixture({
    reserve: vi.fn(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    ),
  });
  const first = paused.pipeline.prepareAndPublish(actor, 1, source());
  await Promise.resolve();
  expect(await paused.pipeline.prepareAndPublish(actor, 1, source())).toEqual({
    kind: "busy",
  });
  release(null);
  await first;
});
