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
    return [NODE, "--v8-pool-size=1", "--max-old-space-size=192", script, *args]


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
