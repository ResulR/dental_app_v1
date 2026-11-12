import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const run = promisify(execFile);
const HASH = /^[a-f0-9]{40}$/;

export function evaluateReleaseState(
  { branch, head, upstream, status },
  expectedHead,
) {
  if (
    branch !== "main" ||
    !HASH.test(head) ||
    !HASH.test(upstream) ||
    head !== upstream ||
    status.trim() ||
    (expectedHead !== undefined && expectedHead !== head)
  )
    throw new Error("RELEASE_CANDIDATE_NOT_READY");
  return { head, branch };
}

// Read-only local Git gate. It never tags, fetches, builds or deploys.
// origin/main is the last locally observed tracking ref, not remote proof.
export async function checkReleaseCandidate(root, expectedHead) {
  if (expectedHead !== undefined && !HASH.test(expectedHead))
    throw new Error("RELEASE_CANDIDATE_NOT_READY");
  const git = async (...args) =>
    (await run("git", args, { cwd: root })).stdout.trim();
  return evaluateReleaseState(
    {
      branch: await git("branch", "--show-current"),
      head: await git("rev-parse", "HEAD"),
      upstream: await git("rev-parse", "refs/remotes/origin/main"),
      status: await git("status", "--porcelain", "--untracked-files=normal"),
    },
    expectedHead,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    if (process.argv.length > 3) throw new Error("RELEASE_CANDIDATE_NOT_READY");
    const result = await checkReleaseCandidate(
      fileURLToPath(new URL("..", import.meta.url)),
      process.argv[2],
    );
    process.stdout.write(JSON.stringify(result) + "\n");
  } catch {
    process.stderr.write("Release candidate Git state not ready\n");
    process.exitCode = 1;
  }
}
