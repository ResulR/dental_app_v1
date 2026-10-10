#!/usr/bin/env python3
"""R18: admission, local environment and complete timeout cleanup regressions."""
import fcntl
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("quality", root / "scripts/run-quality.py")
quality = importlib.util.module_from_spec(spec)
spec.loader.exec_module(quality)
assert os.getuid() == 1002
initial_env = os.environ.get("UV_THREADPOOL_SIZE")
quality.admission((48, 100, 220 * 1048576, 1024 * 1048576))
for state in [(77, 100, 220 * 1048576, 1024 * 1048576),
              (48, 100, 600 * 1048576, 1024 * 1048576)]:
    try:
        quality.admission(state)
    except RuntimeError:
        pass
    else:
        raise AssertionError("Unsafe admission accepted")
quality.run(quality.node("--input-type=module", "-e",
    "import fs from 'node:fs/promises'; await fs.readFile('package.json'); "
    "if(process.env.UV_THREADPOOL_SIZE!=='1'||process.env.RAYON_NUM_THREADS!=='1')process.exit(1); "
    "console.log((await fs.readFile('/proc/self/status','utf8')).split('\\n').find(x=>x.startsWith('Threads:')));"),
    "local thread limits", timeout=10)
assert os.environ.get("UV_THREADPOOL_SIZE") == initial_env
(root / ".local").mkdir(mode=0o700, exist_ok=True)
with tempfile.TemporaryDirectory(dir=root / ".local") as directory:
    marker = Path(directory) / "child"
    child = "import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(20)"
    parent = ("import subprocess,time,pathlib; "
              f"p=subprocess.Popen([{sys.executable!r},'-c',{child!r}]); "
              f"pathlib.Path({str(marker)!r}).write_text(str(p.pid)); "
              "time.sleep(20)")
    try:
        quality.run([sys.executable, "-c", parent], "intentional timeout", timeout=1)
    except RuntimeError as error:
        assert "deadline exceeded" in str(error), str(error)
    else:
        raise AssertionError("Timed out process declared successful")
    pid = int(marker.read_text())
    assert not (quality.CGROUP / "cgroup.procs").read_text().split().count(str(pid))
    print("Timeout: resistant child removed from project cgroup")
quality.run(quality.node("--input-type=module", "-e",
    "import assert from 'node:assert/strict'; import {allowed} from './scripts/check-boundaries.mjs'; "
    "assert.equal(allowed('apps/web/src/shared/a.ts','apps/web/src/features/orders/index.ts'),false); "
    "assert.equal(allowed('apps/api/src/modules/orders/routes.ts','apps/api/src/modules/orders/repository.ts'),false); "
    "assert.equal(allowed('apps/web/src/app/a.ts','apps/web/src/features/orders/index.ts'),true); "
    "assert.equal(allowed('apps/api/src/app/a.ts','apps/web/src/app/a.ts'),false); "
    "assert.equal(allowed('apps/web/src/features/a/a.ts','apps/web/src/features/b/private.ts'),false); "
    "console.log('Boundary refusals/public entry regression OK');"),
    "boundary regression", timeout=15)
with (root / ".local/quality.lock").open("a") as lock:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    refusal = subprocess.run([sys.executable, str(root / "scripts/run-quality.py"), "lint"], capture_output=True, text=True, timeout=10)
    assert refusal.returncode == 1 and "Another project tool is running" in refusal.stderr
assert quality.plan("typecheck:web")[0][0][-1] == "apps/web/tsconfig.json"
print("Exclusive lock and workspace scope OK")
print("R18 regression checks OK")
