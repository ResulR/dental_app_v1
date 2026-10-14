"""Offline-only v3 isolation recipe checks. Never starts PostgreSQL or uses root."""
from pathlib import Path
import hashlib, json, subprocess, tarfile, unittest

ROOT=Path(__file__).resolve().parents[2]
ADMIN=ROOT/"docs/admin-proposals"
ARCHIVE=ROOT/".local/owner-bootstrap-review-v3.tar.gz"
V2=ROOT/".local/owner-bootstrap-review-v2.tar.gz"

class V3RecipeOffline(unittest.TestCase):
    def test_archive_delta_only(self):
        with tarfile.open(V2) as a,tarfile.open(ARCHIVE) as b:
            old={m.name:a.extractfile(m).read() for m in a.getmembers()}
            new={m.name:b.extractfile(m).read() for m in b.getmembers()}
        self.assertEqual(len(old),1648)
        self.assertEqual(len(new),1650)
        additions={"scripts/linked-works-postgres-v3.mjs","tests/postgres/linked-works-v3-seed.sql"}
        self.assertEqual(set(new)-set(old),additions)
        self.assertEqual({k for k in old if old[k]!=new[k]},{"MANIFEST.json"})
        manifest=json.loads(new["MANIFEST.json"])
        self.assertEqual(set(manifest),set(new)-{"MANIFEST.json"})
        for name,sha in manifest.items():
            self.assertEqual(hashlib.sha256(new[name]).hexdigest(),sha)
        self.assertNotIn(b"current_setting('data_directory')",new["tests/postgres/linked-works-v3-seed.sql"])
        self.assertIn(b"current_setting('data_directory')",new["scripts/linked-works-postgres-v3.mjs"])
        self.assertIn(b"current_setting('data_directory')",old["tests/postgres/linked-works-v2-seed.sql"])

    def test_manifest_matches_all_staged_files(self):
        sums=(ADMIN/"PG_RECIPE_V3_SHA256SUMS").read_text().splitlines()
        names=set()
        for line in sums:
            sha,name=line.split("  ",1)
            self.assertNotIn(name,names);names.add(name)
            path=ARCHIVE if name==ARCHIVE.name else ADMIN/name
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),sha)
        self.assertEqual(names,{"owner-bootstrap-review-v3.tar.gz",
            "prepare-isolated-pg-envelope-v3.py","isolated-pg-recipe-v3-runner.sh",
            "dental-pg-recipe-v3@.service","reception-v3-common.sh",
            "reception-v3-a.sh","reception-v3-b.sh"})

    def test_syntax(self):
        for n in ("isolated-pg-recipe-v3-runner.sh","reception-v3-common.sh","reception-v3-a.sh","reception-v3-b.sh"):
            subprocess.run(["bash","-n",str(ADMIN/n)],check=True)
        import ast
        ast.parse((ADMIN/"prepare-isolated-pg-envelope-v3.py").read_text())
        subprocess.run(["node","--check",str(ROOT/"scripts/linked-works-postgres-v3.mjs")],check=True)

    def test_isolation_boundaries(self):
        runner=(ADMIN/"isolated-pg-recipe-v3-runner.sh").read_text()
        service=(ADMIN/"dental-pg-recipe-v3@.service").read_text()
        common=(ADMIN/"reception-v3-common.sh").read_text()
        a=(ADMIN/"reception-v3-a.sh").read_text()
        b=(ADMIN/"reception-v3-b.sh").read_text()
        self.assertIn("PrivateNetwork=yes",service)
        self.assertIn("RestrictAddressFamilies=AF_UNIX",service)
        self.assertIn("RootImage=/var/lib/dental-lab-pg-recipe-v3/sandbox.raw",service)
        self.assertIn("MemoryMax=768M",service)
        self.assertIn("Restart=no",service)
        self.assertIn("dental-pg-test-v3",runner)
        self.assertIn("linked-works-postgres-v3.mjs",runner)
        self.assertIn("linked_works_postgres_v3",runner)
        self.assertIn("v1_stopped",a)
        self.assertIn("v2_stopped",a)
        self.assertIn("v2_stopped",b)
        self.assertIn("A_V3_OK_NO_POSTGRES_STARTED",b)
        self.assertIn("B_V3_TECHNICAL_CHECKS_OK",b)
        self.assertIn("set -C",a)
        self.assertIn("set -C",b)
        self.assertIn("dental-pg-recipe-v3@test.service",common)
        self.assertNotIn("systemctl reset-failed",common+b+a)
        self.assertNotIn("rm -",common+b+a)

if __name__=="__main__":
    unittest.main()
