#!/usr/bin/env python3
"""Build NEW proposal files/archive only. No privileged action or PostgreSQL."""
import hashlib,io,json,os,tarfile
from pathlib import Path
r=Path(__file__).resolve().parent.parent
assert os.getuid()==1002 and str(r)=='/srv/dental-lab'
p=r/'docs/admin-proposals'
source=r/'.local/registration-v4-review.tar.gz'
assert hashlib.sha256(source.read_bytes()).hexdigest()=='5f9221df52a9285079fd6cc8dd42eda7d668f58bce8980bd1ba1a6451ae651c7'
with tarfile.open(source) as t:
 files={m.name:t.extractfile(m).read() for m in t if m.isfile()}
manifest=json.loads(files.pop('MANIFEST.json'))
assert set(files)==set(manifest)
assert all(hashlib.sha256(v).hexdigest()==manifest[n] for n,v in files.items())
name='tests/postgres/catalog-registration-v4.mjs'
s=files[name].decode().replace('independent-empty-vm','shared-v4-isolated')
s=s.replace('assert.ok(!os.hostname().startsWith("vps-28bf7789"));', '''assert.equal(os.hostname(), "vps-28bf7789");
  const identity=JSON.parse(await readFile("/etc/reception-identity.json","utf8"));
  assert.equal(process.getuid(),identity.uid);
  const proof=JSON.parse(await readFile(root+"/test.pending","utf8"));
  assert.equal(proof.result,"isolation-passed");
  assert.equal(proof.cgroup,"dental-pg-recipe-v4@test.service");
  assert.equal(proof.uid,process.getuid());''')
files[name]=s.encode()
files['MANIFEST.json']=(json.dumps({n:hashlib.sha256(v).hexdigest() for n,v in sorted(files.items())},indent=2)+'\n').encode()
target=r/'.local/registration-shared-v4-review.tar.gz'
with target.open('xb') as out:
 with tarfile.open(fileobj=out,mode='w:gz') as t:
  for n,v in sorted(files.items()):
   info=tarfile.TarInfo(n);info.size=len(v);info.mode=0o444;t.addfile(info,io.BytesIO(v))
archive_sha=hashlib.sha256(target.read_bytes()).hexdigest()
unit=(p/'dental-pg-recipe-v3@.service').read_text().replace('v3','v4').replace('/var/lib/dental-lab-bootstrap-reception','/var/lib/dental-lab-reception-v4')
runner=(p/'isolated-pg-recipe-v3-runner.sh').read_text().split('# No automatic retry;')[0]
runner=runner.replace('v3','v4').replace('/var/lib/dental-lab-bootstrap-reception','/var/lib/dental-lab-reception-v4').replace('/var/lib/dental-lab-owner-bootstrap-v1/release','/opt/dental-registration-v4')
tail=(r/'tests/postgres/run-registration-v4.sh').read_text().split('test ! -e "$root/attempt"')[1]
tail=tail.replace('recipe dental-v4 postgres','recipe dental-pg-test-v4 postgres')
runner+='export DENTAL_RECEPTION_V4_APPROVED=shared-v4-isolated\npgbin=/usr/lib/postgresql/17/bin\ntest ! -e "$root/attempt"'+tail
# The runner performs isolation checks before the SQL harness is reachable.
setup=(p/'prepare-isolated-pg-envelope-v3.py').read_text().replace('v3','v4')
setup=setup.replace('/var/lib/dental-lab-bootstrap-reception','/var/lib/dental-lab-reception-v4').replace('/var/lib/dental-lab-owner-bootstrap-v1/release','/opt/dental-registration-v4')
setup=setup.replace("'var/lib/dental-lab-owner-bootstrap-v1'","'opt'")
setup=setup.replace('owner-bootstrap-review-v4.tar.gz','registration-shared-v4-review.tar.gz')
setup=setup.replace('488be4f1277fbc933157252f270f0cc7e3c66b8218535265b87c809ecba365dd',archive_sha)
setup=setup.replace('2ab6f7bada821c5be680ad4262d912b3497c716141283c23cac8d19080596b10',hashlib.sha256(runner.encode()).hexdigest())
setup=setup.replace('b4c4433e7f5f5dd7f007d5e0d2c13e8b30405c7372373d8e645f0301a7e74ef0',hashlib.sha256(unit.encode()).hexdigest())
setup=setup.replace('==1650','=='+str(len(files)))
for n,v in [('isolated-pg-recipe-v4-runner.sh',runner),('dental-pg-recipe-v4@.service',unit),('prepare-isolated-pg-envelope-v4.py',setup)]:
 with (p/n).open('x') as f:f.write(v)
checks={n:hashlib.sha256((p/n).read_bytes()).hexdigest() for n in ['isolated-pg-recipe-v4-runner.sh','dental-pg-recipe-v4@.service','prepare-isolated-pg-envelope-v4.py']}
checks[target.name]=archive_sha
with (p/'PG_RECIPE_V4_SHA256SUMS').open('x') as f:
 for n,h in checks.items():f.write(h+'  '+n+'\n')
print(json.dumps(checks,indent=2))
