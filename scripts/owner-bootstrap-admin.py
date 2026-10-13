#!/usr/bin/python3 -I
"""Human-only supervisor; install/review separately. Never run from the checkout."""
import fcntl
import getpass
import hashlib
import json
import os
from pathlib import Path
import resource
import stat
import subprocess
import sys
import time
import uuid
import warnings

BASE = Path("/var/lib/dental-lab-owner-bootstrap-v1")
RELEASE = BASE / "release"
ADMIN = BASE / "admin"
ENV = {"PATH": "/usr/bin:/bin", "HOME": "/", "LANG": "C.UTF-8",
       "UV_THREADPOOL_SIZE": "1", "DENTAL_LAB_BOOTSTRAP_APPROVED": "private-first-owner-v1"}


def protected(path, directory=False, private=False):
    info = path.lstat()
    assert (stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode))
    assert info.st_uid == 0 and not info.st_mode & (0o077 if private else 0o022)
    if not directory:
        assert info.st_nlink == 1
    return info


def exclusive_json(path, data):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, "w") as output:
        json.dump(data, output)
        output.write("\n")
        output.flush()
        os.fsync(output.fileno())
    directory = os.open(path.parent, os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def child(user, mode, data):
    result = subprocess.run(
        ["/usr/sbin/runuser", "-u", user, "--", "/usr/bin/env", "-i",
         *[key + "=" + value for key, value in ENV.items()],
         "/usr/bin/node", "--v8-pool-size=1", "--max-old-space-size=192",
         str(RELEASE / "scripts/owner-bootstrap-worker.mjs"), mode],
        input=json.dumps(data).encode(), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        cwd=RELEASE, env={"PATH": "/usr/bin:/bin"}, timeout=30, check=False,
    )
    if result.returncode or len(result.stdout) > 8192:
        raise RuntimeError("BOOTSTRAP_CHILD_REFUSED")
    return json.loads(result.stdout)


def main():
    assert os.getuid() == os.geteuid() == 0
    assert len(sys.argv) == 1 and sys.stdin.isatty() and sys.stdout.isatty()
    assert Path(__file__).absolute() == RELEASE / "scripts/owner-bootstrap-admin.py"
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    os.umask(0o077)
    for path in [Path("/"), Path("/var"), Path("/var/lib"), BASE, RELEASE, RELEASE / "scripts"]:
        protected(path, directory=True)
    protected(ADMIN, directory=True, private=True)
    protected(RELEASE / "MANIFEST.json")
    manifest = json.loads((RELEASE / "MANIFEST.json").read_text())
    assert manifest and isinstance(manifest, dict)
    for relative, expected in manifest.items():
        part = Path(relative)
        assert not part.is_absolute() and ".." not in part.parts
        path = RELEASE / part
        for parent in path.parents:
            if parent == RELEASE:
                break
            protected(parent, directory=True)
        protected(path)
        assert hashlib.sha256(path.read_bytes()).hexdigest() == expected
    protected(ADMIN / "approval.json", private=True)
    approval = json.loads((ADMIN / "approval.json").read_text())
    assert set(approval) == {"purpose", "approvalId", "email", "expiresAt"}
    assert approval["purpose"] == "first-owner-v1"
    assert str(uuid.UUID(approval["approvalId"], version=4)) == approval["approvalId"]
    assert time.time() * 1000 < approval["expiresAt"] <= time.time() * 1000 + 3600000
    # Existing operator lock, no new delegation or migration replay.
    lock_path = Path("/var/lib/dental-lab-migrations/operator.lock")
    protected(lock_path)
    with lock_path.open("r+") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        assert not (ADMIN / "owner.pending").exists()
        assert not (ADMIN / "owner.receipt.json").exists()
        receipts = Path("/var/lib/dental-lab-migrations/receipts")
        protected(receipts, directory=True)
        assert not any(path.name.endswith(".pending") for path in receipts.iterdir())
        # Human reviewed individual receipts, backup, authority, email and isolated test.
        assert input("Validation privée préalable complète ? Saisir FIRST OWNER : ") == "FIRST OWNER"
        warnings.simplefilter("error", getpass.GetPassWarning)
        password = getpass.getpass("Mot de passe privé du propriétaire : ")
        confirmation = getpass.getpass("Confirmer le mot de passe : ")
        assert password == confirmation
        prepared = child("dental-lab-runtime", "hash", {"approval": approval, "password": password})
        password = confirmation = ""
        assert prepared.get("approval") == approval
        exclusive_json(ADMIN / "owner.pending", {
            "approvalId": approval["approvalId"], "state": "started",
            "startedAt": int(time.time() * 1000),
        })
        result = child("postgres", "commit", prepared)
        prepared.clear()
        assert set(result) == {"outcome", "approvalId", "accountId"}
        assert result["outcome"] == "committed" and result["approvalId"] == approval["approvalId"]
        assert str(uuid.UUID(result["accountId"], version=4)) == result["accountId"]
        exclusive_json(ADMIN / "owner.receipt.json", result)
        # Keep pending as permanent consumption marker; never automatically remove it.
        print("BOOTSTRAP_COMMITTED — reçu privé conservé ; vérifier avant connexion.")


if __name__ == "__main__":
    try:
        main()
    except BaseException:
        print("BOOTSTRAP_STOP — conserver pending/reçu, contrôler la base avant toute reprise.", file=sys.stderr)
        sys.exit(1)
