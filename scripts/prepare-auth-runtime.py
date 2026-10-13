#!/usr/bin/env python3
"""Build a reviewable, regular-files-only test archive. No privileged execution."""
import gzip
import hashlib
import io
import json
from pathlib import Path
import tarfile

ROOT = Path(__file__).resolve().parent.parent
assert str(ROOT) == "/srv/dental-lab"
files = {"package.json": b'{"private":true,"type":"module"}\n'}
for prefix in ["apps/api/dist", "apps/web/dist"]:
    folder=ROOT/prefix
    assert folder.is_dir() and not folder.is_symlink()
    for path in sorted(folder.rglob("*")):
        assert not path.is_symlink()
        if path.is_file(): files[str(path.relative_to(ROOT))]=path.read_bytes()
files["scripts/auth-postgres-probe.mjs"]=(ROOT/"scripts/auth-postgres-probe.mjs").read_bytes()
contract=ROOT/"packages/contracts"
files["node_modules/@dental-lab/contracts/package.json"]=(contract/"package.json").read_bytes()
for path in sorted((contract/"dist").rglob("*")):
    assert not path.is_symlink()
    if path.is_file(): files["node_modules/@dental-lab/contracts/"+str(path.relative_to(contract))]=path.read_bytes()
pending = ["pg", "express", "zod"]
seen = set()
while pending:
    name = pending.pop()
    if name in seen:
        continue
    seen.add(name)
    folder = ROOT / "node_modules" / name
    assert folder.is_dir() and not folder.is_symlink(), name
    assert folder.resolve().is_relative_to(ROOT / "node_modules")
    package = json.loads((folder / "package.json").read_text())
    assert package["name"] == name
    pending.extend(package.get("dependencies", {}))
    pending.extend(dep for dep in package.get("optionalDependencies", {})
                   if (ROOT / "node_modules" / dep).is_dir())
    for path in sorted(folder.rglob("*")):
        assert not path.is_symlink(), str(path)
        if path.is_dir():
            continue
        assert path.is_file(), str(path)
        files[str(path.relative_to(ROOT))] = path.read_bytes()

manifest = {name: hashlib.sha256(data).hexdigest() for name, data in sorted(files.items())}
files["MANIFEST.json"] = (json.dumps(manifest, indent=2) + "\n").encode()
local = ROOT / ".local"
local.mkdir(mode=0o700, exist_ok=True)
archive = local / "auth-runtime-review.tar.gz"
with archive.open("wb") as output:
    with gzip.GzipFile(fileobj=output, mode="wb", mtime=0, compresslevel=1) as zipped:
        with tarfile.open(fileobj=zipped, mode="w") as tar:
            for name, data in sorted(files.items()):
                entry = tarfile.TarInfo(name)
                entry.mode = 0o444
                entry.mtime = 0
                entry.size = len(data)
                entry.uid = entry.gid = 0
                entry.uname = entry.gname = "root"
                tar.addfile(entry, io.BytesIO(data))
archive.chmod(0o600)
report = {
    "archive": str(archive),
    "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
    "packages": sorted(seen),
    "files": manifest,
}
(ROOT / "docs/admin-proposals/AUTH_RUNTIME_ARTIFACTS.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({k: v for k, v in report.items() if k != "files"}))
