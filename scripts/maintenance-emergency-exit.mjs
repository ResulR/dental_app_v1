import { stdin, stdout, stderr } from "node:process";
import { pathToFileURL } from "node:url";

const cookieName = "__Host-dental_session";
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export async function exitMaintenance({
  origin,
  token,
  expectedRevision,
  request = fetch,
}) {
  const url = new URL(origin);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("INVALID_ORIGIN");
  if (
    !tokenPattern.test(token) ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 0
  )
    throw new Error("INVALID_INPUT");
  const headers = { cookie: `${cookieName}=${token}`, origin: url.origin };
  async function state() {
    const response = await request(new URL("/api/v1/maintenance/state", url), {
      headers,
      redirect: "error",
      signal: globalThis.AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error(`STATE_HTTP_${response.status}`);
    const value = await response.json();
    if (
      !Number.isSafeInteger(value.revision) ||
      typeof value.active !== "boolean"
    )
      throw new Error("INVALID_STATE");
    return value;
  }
  const before = await state();
  if (before.revision !== expectedRevision)
    throw new Error("REVISION_CONFLICT");
  if (!before.active)
    return { kind: "already_inactive", revision: before.revision };
  let response;
  try {
    response = await request(new URL("/api/v1/maintenance/state", url), {
      method: "PUT",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        expected_revision: expectedRevision,
        active: false,
        message: before.message,
        planned_at: before.planned_at,
        planned_message: before.planned_message,
      }),
      redirect: "error",
      signal: globalThis.AbortSignal.timeout(7000),
    });
  } catch {
    // An uncertain response is reconciled by reading the durable state.
    // Never repeat the PUT automatically.
    const after = await state();
    return {
      kind: after.active ? "uncertain_active" : "uncertain_inactive",
      revision: after.revision,
    };
  }
  if (!response.ok) throw new Error(`UPDATE_HTTP_${response.status}`);
  const result = await response.json();
  const after = await state();
  if (
    result.kind !== "applied" ||
    after.active ||
    after.revision !== expectedRevision + 1
  )
    throw new Error("RESULT_UNCONFIRMED");
  return { kind: "confirmed", revision: after.revision };
}

async function readHiddenToken() {
  if (!stdin.isTTY || !stdin.setRawMode)
    throw new Error("INTERACTIVE_TERMINAL_REQUIRED");
  stdout.write("Jeton de session propriétaire (saisie masquée) : ");
  stdin.setRawMode(true);
  stdin.resume();
  try {
    return await new Promise((resolve, reject) => {
      let input = "";
      const onData = (bytes) => {
        for (const byte of bytes) {
          if (byte === 3) {
            stdin.off("data", onData);
            reject(new Error("CANCELLED"));
            return;
          }
          if (byte === 13 || byte === 10) {
            stdin.off("data", onData);
            stdout.write("\n");
            resolve(input);
            return;
          }
          if (byte === 127) input = input.slice(0, -1);
          else if (byte >= 33 && byte <= 126 && input.length < 200)
            input += String.fromCharCode(byte);
        }
      };
      stdin.on("data", onData);
    });
  } finally {
    stdin.setRawMode(false);
    stdin.pause();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const match = /^--expected-revision=(0|[1-9][0-9]*)$/.exec(
    process.argv[2] ?? "",
  );
  if (process.argv.length !== 3 || !match || !process.env.DENTAL_LAB_ORIGIN) {
    stderr.write(
      "Usage: DENTAL_LAB_ORIGIN=https://... node scripts/maintenance-emergency-exit.mjs --expected-revision=N\n",
    );
    process.exitCode = 2;
  } else {
    try {
      const token = await readHiddenToken();
      const result = await exitMaintenance({
        origin: process.env.DENTAL_LAB_ORIGIN,
        token,
        expectedRevision: Number(match[1]),
      });
      stdout.write(
        `Résultat: ${result.kind}; révision: ${result.revision}. Vérifiez l'historique propriétaire.\n`,
      );
      if (result.kind !== "confirmed" && result.kind !== "already_inactive")
        process.exitCode = 1;
    } catch (error) {
      stderr.write(`Sortie non confirmée: ${error.message}\n`);
      process.exitCode = 1;
    }
  }
}
