#!/usr/bin/env python3
"""Read-only SQL inventory; never invoke PostgreSQL or a privileged launcher."""
import hashlib
import types
import json
import os
from pathlib import Path
import re
import stat

ROOT = Path(__file__).resolve().parent.parent
GATE_SHA = "698472ebcc0ca0f8a1d74151cb7331ecfa9e113d8231f9262b3ba6f535de9ea1"
HISTORICAL = {
    "0002_identity_clinics_permissions.sql": "a98661428ffaea3a999d872622cd5af088ddb3c9393253ba559a453a525a9821",
    "0001_migration_engine_probe.sql": "a40fcba1147515f7b9dd4eeceb37e876b4ec032f9d4254f5f80c3495524d1413",
    "0000_execution_probe.sql": "25e6cafc724d2b6ddd6c6be23f6fc44b4a5a21ea318cbfedac48a93bee7d1734",
    "9900_atomicity_failure_probe.sql": "f85b33d4fd07f97891b295ee8eac1dc5fa91d6638c6d4e1473c4899dedb64615",
    "9901_atomicity_success_probe.sql": "87c25620081222a9269556b22b669578fe5acd446b9764d67d155f14e132d1a8",
}
VERSION = re.compile(r"[0-9]{4}_[a-z0-9_]{1,64}\.sql")


def load_gate():
    source = ROOT / "docs/admin-proposals/dental-lab-migrate.py"
    data = source.read_bytes()
    if hashlib.sha256(data).hexdigest() != GATE_SHA:
        raise ValueError("MIGRATION_GATE_CHANGED_REVIEW_REQUIRED")
    # Execute exactly the approved bytes, not a second racy filesystem read.
    gate = types.ModuleType("reviewed_gate")
    gate.__file__ = str(source)
    exec(compile(data, str(source), "exec"), gate.__dict__)
    return gate


def inventory(folder, validate):
    # O_NOFOLLOW at directory and leaf, bounded reads, no hard links or public SQL.
    directory = os.open(folder, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    result = []
    numbers = set()
    try:
        for name in sorted(os.listdir(directory)):
            if not VERSION.fullmatch(name):
                raise ValueError("INVALID_MIGRATION_NAME")
            number = int(name[:4])
            if number in numbers:
                raise ValueError("DUPLICATE_MIGRATION_NUMBER")
            numbers.add(number)
            fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
            try:
                before = os.fstat(fd)
                if (not stat.S_ISREG(before.st_mode) or before.st_uid != os.getuid()
                        or before.st_nlink != 1 or before.st_mode & 0o077
                        or not 0 < before.st_size <= 1048576):
                    raise ValueError("INVALID_MIGRATION_FILE")
                data = b""
                while len(data) <= 1048576:
                    chunk = os.read(fd, min(65536, 1048577 - len(data)))
                    if not chunk:
                        break
                    data += chunk
                after = os.fstat(fd)
                if (before.st_size, before.st_mtime_ns, before.st_ctime_ns) != (
                        after.st_size, after.st_mtime_ns, after.st_ctime_ns):
                    raise ValueError("MIGRATION_CHANGED_DURING_READ")
            finally:
                os.close(fd)
            sha = hashlib.sha256(data).hexdigest()
            validate(name, sha, data)
            historical = name in HISTORICAL
            if historical and sha != HISTORICAL[name]:
                raise ValueError("HISTORICAL_FIXTURE_CHANGED")
            result.append({
                "version": name,
                "sha256": sha,
                "bytes": len(data),
                "purpose": "historical_fixture_do_not_run" if historical else "requires_admin_review",
            })
    finally:
        os.close(directory)
    return result


def main():
    if os.getuid() != 1002 or str(ROOT) != "/srv/dental-lab":
        raise ValueError("UNEXPECTED_PROJECT_IDENTITY")
    gate = load_gate()
    print(json.dumps({
        "database": "dental_lab",
        "mode": "source_inventory_only",
        "installed_receipts": "not_read_by_agent",
        "migrations": inventory(ROOT / "migrations", gate.validate),
    }, indent=2))


if __name__ == "__main__":
    main()
