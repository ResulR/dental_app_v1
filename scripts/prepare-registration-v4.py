#!/usr/bin/env python3
"""Prepare an independent review bundle. Never starts PostgreSQL or changes services."""
import hashlib
import io
import json
import os
from pathlib import Path
import tarfile

ROOT = Path(__file__).resolve().parent.parent
assert os.getuid() == 1002 and str(ROOT) == "/srv/dental-lab"
source = ROOT / ".local/owner-bootstrap-review-v3.tar.gz"
raw = source.read_bytes()
assert hashlib.sha256(raw).hexdigest() == "488be4f1277fbc933157252f270f0cc7e3c66b8218535265b87c809ecba365dd"
files = {}
with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as archive:
    for member in archive.getmembers():
        assert member.isfile() and not member.name.startswith("/") and ".." not in Path(member.name).parts
        if member.name != "MANIFEST.json":
            files[member.name] = archive.extractfile(member).read()
# Reuse frozen dependency BYTES only. Never reuse the v3 cluster/image/evidence.
for folder in ["apps/api/dist", "packages/contracts/dist"]:
    for p in (ROOT / folder).rglob("*"):
        if p.is_file():
            relative = p.relative_to(ROOT).as_posix()
            files[relative] = p.read_bytes()
            if relative.startswith("packages/contracts/"):
                files[relative.replace("packages/contracts/", "node_modules/@dental-lab/contracts/")] = p.read_bytes()
for name in ["migrations/0014_clinic_registration_terms.sql", "tests/postgres/catalog-registration-v4.mjs",
             "tests/postgres/catalog-registration-v4-fixture.sql", "tests/postgres/run-registration-v4.sh",
             "tests/migrations/catalog_constraints.sql"]:
    files[name] = (ROOT / name).read_bytes()
manifest = {name: hashlib.sha256(data).hexdigest() for name, data in sorted(files.items())}
files["MANIFEST.json"] = (json.dumps(manifest, indent=2) + "\n").encode()
target = ROOT / ".local/registration-v4-review.tar.gz"
with target.open("xb") as out:
    with tarfile.open(fileobj=out, mode="w:gz") as archive:
        for name, data in sorted(files.items()):
            info = tarfile.TarInfo(name)
            info.size = len(data)
            info.mode = 0o444
            info.mtime = 0
            archive.addfile(info, io.BytesIO(data))
digest = hashlib.sha256(target.read_bytes()).hexdigest()
report = {"archive": target.name, "sha256": digest, "entries": len(files), "manifest": manifest,
          "execution": "not_executed", "dependency_source": source.name}
with (ROOT / "docs/admin-proposals/REGISTRATION_V4_ARTIFACTS.json").open("x") as out:
    json.dump(report, out, indent=2); out.write("\n")
print(json.dumps({k: v for k, v in report.items() if k != "manifest"}))
