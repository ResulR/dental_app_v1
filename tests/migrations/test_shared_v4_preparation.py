import ast,hashlib,json,subprocess,tarfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
P=ROOT/'docs/admin-proposals'
class SharedV4(unittest.TestCase):
 def test_hashes_and_no_historical_rewrite(self):
  for line in (P/'PG_RECIPE_V4_SHA256SUMS').read_text().splitlines():
   digest,name=line.split()
   path=ROOT/'.local'/name if name.endswith('.tar.gz') else P/name
   self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),digest)
  self.assertEqual(subprocess.check_output(['git','diff','98d1261','--','docs/admin-proposals/isolated-pg-recipe-v3-runner.sh','docs/admin-proposals/prepare-isolated-pg-envelope-v3.py','docs/admin-proposals/dental-pg-recipe-v3@.service'],cwd=ROOT),b'')
 def test_proposal_syntax_and_boundaries(self):
  setup=(P/'prepare-isolated-pg-envelope-v4.py').read_text()
  ast.parse(setup)
  subprocess.run(['bash','-n',str(P/'isolated-pg-recipe-v4-runner.sh')],check=True)
  unit=(P/'dental-pg-recipe-v4@.service').read_text()
  for expected in ['RootImage=/var/lib/dental-lab-pg-recipe-v4/sandbox.raw','PrivateNetwork=yes','RestrictAddressFamilies=AF_UNIX','NoNewPrivileges=yes','MemoryMax=768M','TasksMax=48','CPUQuota=50%']:self.assertIn(expected,unit)
  self.assertIn("assert not os.path.lexists(base)",setup)
  runner=(P/'isolated-pg-recipe-v4-runner.sh').read_text()
  self.assertIn("approved-test-v4",runner)
  self.assertLess(runner.index('IP_SOCKET_ALLOWED'),runner.index('"$pgbin/initdb"'))
  self.assertNotIn('owner-bootstrap-postgres-test',runner)
  self.assertNotIn('linked-works-postgres',runner)
 def test_archive_scope(self):
  with tarfile.open(ROOT/'.local/registration-shared-v4-review.tar.gz') as t:
   manifest=json.load(t.extractfile('MANIFEST.json'))
   for name,digest in manifest.items():self.assertEqual(hashlib.sha256(t.extractfile(name).read()).hexdigest(),digest)
   harness=t.extractfile('tests/postgres/catalog-registration-v4.mjs').read().decode()
   self.assertIn('shared-v4-isolated',harness)
   self.assertIn('dental-pg-recipe-v4@test.service',harness)
if __name__=='__main__':unittest.main()
