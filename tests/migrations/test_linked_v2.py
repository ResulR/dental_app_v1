"""Offline regressions: no SQL execution and no privileged operation."""
import hashlib,json,re,subprocess,tarfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
class LinkedV2Tests(unittest.TestCase):
 def test_split_keys_and_active_index(self):
  sql=(ROOT/'migrations/0005_requests_linked_works.sql').read_text()
  self.assertIn("child_kind text GENERATED ALWAYS",sql)
  self.assertRegex(sql,r'work_links_child_kind_fk FOREIGN KEY\(child_order_id,clinic_id,child_kind\)\s+REFERENCES public.orders\(id,clinic_id,kind\) ON UPDATE NO ACTION')
  self.assertRegex(sql,r'work_links_child_status_fk FOREIGN KEY\(child_order_id,clinic_id,child_current_status\)\s+REFERENCES public.orders\(id,clinic_id,status\) ON UPDATE CASCADE')
  self.assertNotIn('orders_id_clinic_kind_status_unique',sql)
  self.assertIn("WHERE kind='retouch' AND child_current_status IN ('pending','correction_requested','accepted','manufacturing','completed')",sql)
 def test_only_reviewed_migration_changed_since_v1(self):
  for p in (ROOT/'migrations').glob('*.sql'):
   if not '0002'<=p.name[:4]<='0013' or p.name.startswith('0005_'):continue
   old=subprocess.check_output(['git','show','a9d0123:migrations/'+p.name],cwd=ROOT)
   self.assertEqual(old,p.read_bytes(),p.name)
 def test_old_composite_has_no_remaining_migration_dependents(self):
  others='\n'.join(p.read_text() for p in (ROOT/'migrations').glob('*.sql') if not p.name.startswith('0005_'))
  self.assertNotRegex(others,r'orders_id_clinic_kind_status_unique|REFERENCES\s+public\.orders\s*\(\s*id\s*,\s*clinic_id\s*,\s*kind\s*,\s*status\s*\)')
 def test_generated_fk_actions(self):
  # Corpus-specific lint, not a general SQL parser.
  for p in (ROOT/'migrations').glob('*.sql'):
   for statement in p.read_text().split(';'):
    generated=set(re.findall(r'(\w+)\s+\w+\s+GENERATED\s+ALWAYS\s+AS\s*\(',statement,re.I))
    for fk in re.finditer(r'FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES\s+[\w.]+\s*\([^)]+\)([^,;]*)',statement,re.I):
     if generated.intersection(x.strip() for x in fk[1].split(',')):
      self.assertNotRegex(fk[2],r'(?i)ON UPDATE\s+(?:CASCADE|SET NULL|SET DEFAULT)|ON DELETE\s+(?:SET NULL|SET DEFAULT)',p.name)
 def test_v1_artifacts_preserved(self):
  for name in ['prepare-isolated-pg-envelope.py','isolated-pg-recipe-runner.sh','dental-pg-recipe@.service','SHARED_VPS_POSTGRES_RECEPTION.md','OWNER_BOOTSTRAP_ARTIFACTS.json']:
   path='docs/admin-proposals/'+name
   self.assertEqual((ROOT/path).read_bytes(),subprocess.check_output(['git','show','a9d0123:'+path],cwd=ROOT))
  self.assertEqual(hashlib.sha256((ROOT/'.local/owner-bootstrap-review-v1.tar.gz').read_bytes()).hexdigest(),'961ac181518d132a6d25c43c4a7d989d31024bcf58606834c31205a8912a8a00')
 def test_v2_bundle_manifest_and_exact_deltas(self):
  report=json.loads((ROOT/'docs/admin-proposals/OWNER_BOOTSTRAP_V2_ARTIFACTS.json').read_text())
  target=ROOT/'.local/owner-bootstrap-review-v2.tar.gz'
  self.assertEqual(hashlib.sha256(target.read_bytes()).hexdigest(),report['sha256'])
  with tarfile.open(target) as t:files={m.name:t.extractfile(m).read() for m in t.getmembers()}
  self.assertEqual(len(files),report['count'])
  manifest=json.loads(files.pop('MANIFEST.json'))
  self.assertEqual(manifest,{k:hashlib.sha256(v).hexdigest() for k,v in files.items()})
  with tarfile.open(ROOT/'.local/owner-bootstrap-review-v1.tar.gz') as t:old={m.name:t.extractfile(m).read() for m in t.getmembers() if m.name!='MANIFEST.json'}
  self.assertEqual(set(old)-set(files),set())
  self.assertEqual({k for k in files if old.get(k)!=files[k]},set(report['deltas']))
  for k in report['deltas']:self.assertEqual(files[k],(ROOT/k).read_bytes())
if __name__=='__main__':unittest.main()
