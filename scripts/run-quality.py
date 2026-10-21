#!/usr/bin/env python3
"""Sequential project tools with local thread limits and bounded process groups."""
import fcntl
import glob
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
CGROUP = Path("/sys/fs/cgroup/system.slice/dental-ai-remote.service")
NODE = "/usr/bin/node"
CHILD_ENV = {"UV_THREADPOOL_SIZE": "1", "RAYON_NUM_THREADS": "1"}
TIMEOUT = 90
TASK_RESERVE = 24


def resources():
    current = int((CGROUP / "pids.current").read_text())
    maximum = int((CGROUP / "pids.max").read_text())
    memory = dict(line.split() for line in (CGROUP / "memory.stat").read_text().splitlines())
    working = int(memory["anon"]) + int(memory["kernel"])
    return current, maximum, working, int((CGROUP / "memory.max").read_text())


def admission(state):
    tasks, limit, working, memory_limit = state
    if limit - tasks < TASK_RESERVE:
        raise RuntimeError(f"Insufficient task margin: {tasks}/{limit}; reserve {TASK_RESERVE}")
    if memory_limit - working < 448 * 1024 * 1024:
        raise RuntimeError("Insufficient non-cache memory margin")


def members(group):
    result = []
    for raw in (CGROUP / "cgroup.procs").read_text().split():
        pid = int(raw)
        try:
            if Path(f"/proc/{pid}").stat().st_uid == os.getuid() and os.getpgid(pid) == group:
                result.append(pid)
        except ProcessLookupError:
            pass
        except FileNotFoundError:
            pass
    return result


def cleanup(process):
    # Only the new session/group created by this invocation; never Remote's group.
    if members(process.pid):
        os.killpg(process.pid, signal.SIGTERM)
        until = time.monotonic() + 2
        while members(process.pid) and time.monotonic() < until:
            process.poll()
            time.sleep(0.05)
        if members(process.pid):
            os.killpg(process.pid, signal.SIGKILL)
    process.wait(timeout=3)
    until = time.monotonic() + 2
    while members(process.pid) and time.monotonic() < until:
        time.sleep(0.05)
    if members(process.pid):
        raise RuntimeError("Child group remains after cleanup")


def run(command, label, timeout=TIMEOUT):
    state = resources()
    admission(state)
    print(f"START {label}: tasks={state[0]}/{state[1]}, non-cache MiB={state[2] // 1048576}", flush=True)
    start = time.monotonic()
    process = subprocess.Popen(command, cwd=ROOT, env={**os.environ, **CHILD_ENV}, start_new_session=True)
    peak = state[0]
    failure = None
    try:
        while process.poll() is None:
            state = resources()
            peak = max(peak, state[0])
            if time.monotonic() - start > timeout:
                failure = "deadline exceeded"
                break
            if state[0] >= state[1] - 10:
                failure = "task safety margin reached"
                break
            if state[2] >= state[3] - 64 * 1024 * 1024:
                failure = "memory safety margin reached"
                break
            time.sleep(0.1)
    finally:
        cleanup(process)
    result = {"step": label, "exit": process.returncode, "failure": failure,
              "seconds": round(time.monotonic() - start, 2), "peak_tasks": peak}
    print(json.dumps(result), flush=True)
    if failure or process.returncode:
        raise RuntimeError(f"{label} failed: {failure or process.returncode}")
    return result


def node(script, *args):
    heap = 256 if script == "node_modules/typescript/bin/tsc" else 192
    return [NODE, "--v8-pool-size=1", f"--max-old-space-size={heap}", script, *args]


def plan(name):
    tsc = "node_modules/typescript/bin/tsc"
    formats = ["apps", "packages", "tests", *sorted(glob.glob("scripts/*.mjs")), *sorted(glob.glob("*.json")), *sorted(glob.glob("*.mjs"))]
    commands = {
        "build:packages": [(node(tsc, "-p", f"{p}/tsconfig.json"), f"build {p}") for p in ["packages/contracts", "apps/api"]],
        "typecheck": [(node(tsc, "--noEmit", "-p", f"{p}/tsconfig.json"), f"typecheck {p}") for p in ["packages/contracts", "apps/api", "apps/web"]],
        "lint": [(node("node_modules/eslint/bin/eslint.js", "apps", "packages", "tests", *sorted(glob.glob("scripts/*.mjs")), *sorted(glob.glob("*.mjs"))), "lint")],
        "format": [(node("node_modules/prettier/bin/prettier.cjs", "--write", *formats), "format")],
        "format:check": [(node("node_modules/prettier/bin/prettier.cjs", "--check", *formats), "format check")],
        "check:boundaries": [(node("scripts/check-boundaries.mjs"), "boundaries")],
        "check:workspace": [(node("scripts/check-workspace.mjs"), "workspace")],
    }
    if name == "format:changed":
        paths = subprocess.check_output(["git", "diff", "--name-only", "HEAD", "-z"], cwd=ROOT).split(b"\0")
        paths += subprocess.check_output(["git", "ls-files", "--others", "--exclude-standard", "-z"], cwd=ROOT).split(b"\0")
        selected = sorted({p.decode() for p in paths if p and
                           p.decode().startswith(("apps/", "packages/", "tests/")) and
                           Path(p.decode()).suffix in (".ts", ".tsx", ".mjs", ".json") and
                           Path(p.decode()).is_file()})
        if not selected:
            raise RuntimeError("No changed application/test files to format")
        return [(node("node_modules/prettier/bin/prettier.cjs", "--write", *selected), "format changed application files")]
    commands["test:shared-v4-preparation"] = [(["/usr/bin/python3", "tests/migrations/test_shared_v4_preparation.py"], "shared v4 static tests only")]
    commands["prepare:shared-v4"] = [(["/usr/bin/python3", "scripts/prepare-shared-v4.py"], "prepare shared v4 proposals only")]
    commands["test:current-permissions"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/current-permissions.test.mjs", "tests/integration/current-permissions-http.test.mjs", "tests/unit/permissions.test.mjs", "tests/unit/auth-readiness.test.mjs", "tests/unit/auth-web-client.test.mjs", "tests/integration/auth-runtime-composition.test.mjs", "tests/integration/authentication-http.test.mjs"), "targeted effective permissions and authentication") ]
    commands["test:laboratory-settings"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/laboratory-settings.test.mjs", "tests/integration/laboratory-settings-http.test.mjs", "tests/integration/auth-runtime-composition.test.mjs"), "targeted laboratory settings")]
    commands["test:message-submission"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/message-submission.test.mjs", "tests/integration/message-submission-http.test.mjs"), "targeted prepared message submission")]
    commands["test:general-messaging"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/general-messaging.test.mjs", "tests/unit/message-submission.test.mjs", "tests/unit/clinic-registration-repository.test.mjs", "tests/integration/general-messaging-http.test.mjs"), "targeted text-only general messaging") ]
    commands["test:message-files"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/message-files.test.mjs", "tests/integration/message-files-http.test.mjs"), "targeted prepared message metadata")]
    commands["test:delivery-plan"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/delivery-plan.test.mjs", "tests/integration/delivery-plan-http.test.mjs"), "targeted versioned delivery planning")]
    commands["test:delivery-priority"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/delivery-priority.test.mjs", "tests/integration/delivery-priority-http.test.mjs", "tests/unit/delivery-plan.test.mjs"), "targeted priority and planning interaction")]
    commands["test:delivery-urgency"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/delivery-urgency.test.mjs", "tests/unit/order-tracking.test.mjs"), "targeted date warning and tracking regression")]
    commands["test:delivery-calendar"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/delivery-calendar.test.mjs", "tests/unit/order-tracking.test.mjs", "tests/integration/order-tracking-http.test.mjs"), "targeted calendar and tracking permissions")]
    commands["test:audit-read"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/audit-read.test.mjs", "tests/integration/audit-read-http.test.mjs"), "targeted owner audit read")]
    commands["test:delivery-batch"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/delivery-batch.test.mjs", "tests/integration/delivery-batch-http.test.mjs"), "targeted delivery batch transaction doubles and HTTP")]
    commands["test:ready-delivery"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/ready-delivery-view.test.mjs", "tests/unit/order-lifecycle.test.mjs"), "targeted ready view and individual delivery lifecycle")]
    commands["test:upload-pipeline"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/upload-pipeline.test.mjs", "tests/unit/transfer-limits.test.mjs"), "targeted streaming upload pipeline")]
    commands["test:transfer-limits"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/transfer-limits.test.mjs"), "targeted bounded transfer limits")]
    commands["test:logo-pipeline"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/logo-pipeline.test.mjs"), "targeted fail-closed logo pipeline")]
    commands["test:linked-work-tracking"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/linked-work-tracking.test.mjs", "tests/integration/linked-work-tracking-http.test.mjs"), "targeted scoped linked work tracking")]
    commands["test:action-inbox"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/action-inbox.test.mjs", "tests/integration/action-inbox-http.test.mjs", "tests/integration/order-review-http.test.mjs"), "targeted action inbox and review route regression")]
    commands["test:laboratory-linked"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/laboratory-linked.test.mjs", "tests/integration/laboratory-linked-http.test.mjs"), "targeted laboratory linked creation")]
    commands["test:retouch"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/retouch.test.mjs", "tests/integration/retouch-http.test.mjs"), "targeted clinical retouch submission")]
    commands["test:order-modification"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/order-edit.test.mjs", "tests/unit/order-modification.test.mjs", "tests/integration/order-modification-http.test.mjs"), "targeted modification requests")]
    commands["test:order-edit"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/order-edit.test.mjs", "tests/integration/order-edit-http.test.mjs"), "targeted versioned order editing")]
    commands["test:order-requests"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/order-requests.test.mjs", "tests/integration/order-requests-http.test.mjs"), "targeted cancellation requests")]
    commands["test:order-lifecycle"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/order-lifecycle.test.mjs", "tests/integration/order-lifecycle-http.test.mjs"), "targeted order lifecycle")]
    commands["test:order-tracking"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/order-tracking.test.mjs", "tests/integration/order-tracking-http.test.mjs"), "targeted order tracking")]
    commands["test:order-review"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/order-review.test.mjs", "tests/integration/order-review-http.test.mjs"), "targeted order review integration")]
    commands["test:order-decision"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/order-decision.test.mjs", "tests/integration/order-decision-http.test.mjs"), "targeted order decisions")]
    commands["test:order-submission"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/order-submission.test.mjs", "tests/integration/order-submission-http.test.mjs"), "targeted clinical submission")]
    commands["test:order-preflight"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/order-preflight.test.mjs", "tests/integration/order-preflight-http.test.mjs"), "targeted clinical order preflight")]
    commands["test:catalog-management"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/catalog-management.test.mjs", "tests/integration/catalog-management-http.test.mjs", "tests/unit/catalog-runtime.test.mjs"), "targeted catalogue management")]
    commands["test:catalog"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/catalog-runtime.test.mjs", "tests/integration/catalog-http.test.mjs", "tests/integration/auth-runtime-composition.test.mjs"), "targeted catalogue read integration")]
    commands["test:private-invitation-mail"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/private-invitation-mail.test.mjs"), "targeted private invitation persistence")]
    commands["test:private-mail"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/private-mail-codec.test.mjs", "tests/unit/account-email.test.mjs"), "private account mail codec and templates")]
    commands["test:admin-runtime"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/admin-runtime.test.mjs", "tests/unit/admin-governance.test.mjs", "tests/integration/admin-http.test.mjs", "tests/integration/auth-runtime-composition.test.mjs"), "targeted administrator governance")]
    commands["test:account-email"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/account-email.test.mjs"), "targeted account email preparation")]
    commands["test:account-state-runtime"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/account-state-runtime.test.mjs", "tests/unit/account-state.test.mjs", "tests/integration/account-state-http.test.mjs", "tests/integration/auth-runtime-composition.test.mjs"), "targeted account state runtime")]
    commands["test:delegation"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/delegation-runtime.test.mjs", "tests/unit/employee-delegation.test.mjs", "tests/integration/delegation-http.test.mjs", "tests/integration/auth-runtime-composition.test.mjs"), "targeted delegation and runtime tests")]
    commands["test:clinic-directory"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/clinic-directory.test.mjs", "tests/integration/clinic-directory-http.test.mjs", "tests/unit/clinic-profile-persistence.test.mjs"), "targeted clinic directory and history")]
    commands["test:clinic-profile"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/clinic-profile-persistence.test.mjs", "tests/unit/clinic-management.test.mjs", "tests/integration/clinic-management-http.test.mjs", "tests/integration/clinic-profile-http.test.mjs"), "targeted profile persistence and HTTP")]
    commands["test:clinic-management"] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/unit/clinic-management.test.mjs", "tests/integration/clinic-management-http.test.mjs", "tests/unit/registration-runtime.test.mjs", "tests/integration/registration-runtime-http.test.mjs"), "targeted clinic tests")]
    commands["prepare:registration-v4"] = [(["/usr/bin/python3", "scripts/prepare-registration-v4.py"], "prepare registration v4 bundle only")]
    commands["check:delivery-batch-v5"] = [(["/bin/bash", "-n", "tests/postgres/run-delivery-batch-v5.sh"], "v5 shell syntax only"), (node("--check", "tests/postgres/delivery-batch-v5.mjs"), "v5 JavaScript syntax only")]
    commands["check:registration-recipe"] = [(["/bin/bash", "-n", "tests/postgres/run-registration-v4.sh"], "v4 shell syntax"), (node("--check", "tests/postgres/catalog-registration-v4.mjs"), "v4 JavaScript syntax")]
    commands["check:migrations"] = [(["/usr/bin/python3", "scripts/migration-catalog.py"], "migration source inventory")]
    commands["test:migrations"] = [
        (["/usr/bin/python3", "-m", "unittest", "discover", "-s", "tests/migrations", "-p", "test_*.py", "-v"], "migration engine offline tests"),
        (["/usr/bin/python3", "docs/admin-proposals/test_migration_gate.py"], "unchanged gate regression tests"),
    ]
    commands["snapshot:prepare"] = [(node("scripts/prepare-contract-snapshot.mjs"), "prepare new contract snapshot")]
    commands["check:contracts"] = [(node("scripts/check-contracts.mjs"), "contract snapshot")]
    commands["build:web"] = [(node("scripts/build-web.mjs"), "build web")]
    for kind in ("unit", "integration"):
        commands["test:" + kind] = [(node("node_modules/vitest/vitest.mjs", "run", "tests/" + kind), "test " + kind)]
    commands["test:e2e-api"] = [(node("node_modules/@playwright/test/cli.js", "test", "--config=playwright.config.mjs"), "test e2e API")]
    for workspace in ("packages/contracts", "apps/api", "apps/web"):
        suffix = workspace.split("/")[-1]
        commands["typecheck:" + suffix] = [(node(tsc, "--noEmit", "-p", workspace + "/tsconfig.json"), "typecheck " + workspace)]
        if suffix != "web":
            commands["build:" + suffix] = [(node(tsc, "-p", workspace + "/tsconfig.json"), "build " + workspace)]
    if name == "quality":
        return [step for key in ("build:packages", "typecheck", "lint", "format:check", "check:boundaries", "check:workspace") for step in commands[key]]
    if name not in commands:
        raise RuntimeError("Unknown project command")
    return commands[name]


def interrupted(signum, frame):
    raise KeyboardInterrupt(f"signal {signum}")


def main():
    os.chdir(ROOT)
    if os.getuid() != 1002 or str(ROOT) != "/srv/dental-lab":
        raise RuntimeError("Unexpected project identity/path")
    actual = Path("/proc/self/cgroup").read_text().strip()
    if actual != "0::/system.slice/dental-ai-remote.service":
        raise RuntimeError("Unexpected cgroup")
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    local = ROOT / ".local"
    local.mkdir(mode=0o700, exist_ok=True)
    with (local / "quality.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError("Another project tool is running")
        results = [run(cmd, label) for cmd, label in plan(sys.argv[1] if len(sys.argv) == 2 else "quality")]
        (local / "quality-last.json").write_text(json.dumps(results, indent=2) + "\n")
    print("All requested steps succeeded", flush=True)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, KeyboardInterrupt, subprocess.TimeoutExpired) as error:
        print(f"FAILED: {error}", file=sys.stderr, flush=True)
        sys.exit(1)
