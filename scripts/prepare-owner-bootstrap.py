#!/usr/bin/env python3
"""Separate review artifact. Never replaces the already-reviewed auth bundle."""
import gzip
import hashlib
import io
import json
from pathlib import Path
import tarfile

ROOT = Path(__file__).resolve().parent.parent
assert str(ROOT) == "/srv/dental-lab"
source = ROOT / ".local/auth-runtime-review.tar.gz"
assert hashlib.sha256(source.read_bytes()).hexdigest() == "89e53eed1327110f500bae6498f35850a7a3c9d575649aec3a71799152d0c9d0"
with tarfile.open(source) as archive:
    members = archive.getmembers()
    assert len(members) == len({m.name for m in members}) == 1628
    assert all(m.isfile() and not m.name.startswith("/") and ".." not in Path(m.name).parts for m in members)
    files = {m.name: archive.extractfile(m).read() for m in members}
    original = json.loads(files.pop("MANIFEST.json"))
    assert set(original) == set(files)
    assert all(hashlib.sha256(data).hexdigest() == original[name] for name, data in files.items())
extra = ["scripts/owner-bootstrap-core.mjs", "scripts/owner-bootstrap-worker.mjs",
         "scripts/owner-bootstrap-admin.py", "scripts/owner-bootstrap-postgres-test.mjs",
         "scripts/auth-config-review.mjs", "tests/postgres/bootstrap-fixture.sql"]
extra += [str(p.relative_to(ROOT)) for p in sorted((ROOT / "migrations").glob("*.sql"))
          if "0002" <= p.name[:4] <= "0013"]
for name in extra:
    path = ROOT / name
    assert path.is_file() and not path.is_symlink()
    files[name] = path.read_bytes()
manifest = {name: hashlib.sha256(data).hexdigest() for name, data in sorted(files.items())}
files["MANIFEST.json"] = (json.dumps(manifest, indent=2) + "\n").encode()
target = ROOT / ".local/owner-bootstrap-review-v1.tar.gz"
with target.open("wb") as output:
    with gzip.GzipFile(fileobj=output, mode="wb", mtime=0, compresslevel=1) as zipped:
        with tarfile.open(fileobj=zipped, mode="w") as archive:
            for name, data in sorted(files.items()):
                entry = tarfile.TarInfo(name)
                entry.mode = 0o444
                entry.size = len(data)
                entry.mtime = entry.uid = entry.gid = 0
                entry.uname = entry.gname = "root"
                archive.addfile(entry, io.BytesIO(data))
target.chmod(0o600)
report = {"archive": str(target), "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
          "count": len(files), "baseAuthSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
          "files": manifest}
(ROOT / "docs/admin-proposals/OWNER_BOOTSTRAP_ARTIFACTS.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({k:v for k,v in report.items() if k != "files"}))
