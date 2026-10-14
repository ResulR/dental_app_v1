"""Unprivileged R1 tests: mocked commands only, no server/image operations."""
import importlib.util,json,os,subprocess,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2]
D=ROOT/'docs/admin-proposals'
spec=importlib.util.spec_from_file_location('attestor',D/'accept-a-v2-r1.py')
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
class ShellTests(unittest.TestCase):
 def shell(self,script,requested=0):
  pre="""set -Eeuo pipefail
source "$1"
requested=$2
unit=dental-pg-recipe-v2@test.service
systemctl(){ printf 'MOCK_SYSTEMCTL %s\\n' "$*"; }
journalctl(){ printf 'MOCK_JOURNAL\\n'; }
install_error_handler
"""
  return subprocess.run(['bash','--noprofile','--norc','-c',pre+script,'r1',str(D/'reception-v2-common-r1.sh'),str(requested)],capture_output=True,text=True,timeout=5)
 def test_no_mount_no_false_stop(self):
  r=self.shell("findmnt(){ printf '/\\n/run\\n'; }; no_mount_at /absent; echo OK",1)
  self.assertEqual(r.returncode,0);self.assertEqual(r.stdout,"OK\n");self.assertEqual(r.stderr,"")
 def test_mount_present_refused(self):
  r=self.shell("findmnt(){ echo /target; }; no_mount_at /target; echo WRONG")
  self.assertNotEqual(r.returncode,0);self.assertNotIn("WRONG",r.stdout)
 def test_nested_mount_refused(self):
  r=self.shell("findmnt(){ echo /target/child; }; no_mount_at /target")
  self.assertNotEqual(r.returncode,0)
 def test_findmnt_failure_not_absence(self):
  r=self.shell("findmnt(){ return 1; }; no_mount_at /absent")
  self.assertEqual(r.returncode,1);self.assertIn("COMMAND_FAILED",r.stderr)
 def test_no_loop(self):
  r=self.shell("losetup(){ return 0; }; no_loop_for /image; echo OK")
  self.assertEqual(r.returncode,0);self.assertEqual(r.stderr,"")
 def test_loop_error_not_absence(self):
  r=self.shell("losetup(){ return 2; }; no_loop_for /image")
  self.assertEqual(r.returncode,2)
 def test_loop_present(self):
  r=self.shell("losetup(){ echo /dev/loop7; }; no_loop_for /image")
  self.assertNotEqual(r.returncode,0)
 def test_pgrep_one_is_normal(self):
  r=self.shell("getent(){ echo account; }; pgrep(){ return 1; }; no_processes test; echo OK",1)
  self.assertEqual(r.returncode,0);self.assertEqual(r.stderr,"")
 def test_pgrep_error(self):
  r=self.shell("getent(){ echo account; }; pgrep(){ return 2; }; no_processes test")
  self.assertNotEqual(r.returncode,0)
 def test_missing_user_is_error(self):
  r=self.shell("getent(){ return 2; }; pgrep(){ return 1; }; no_processes test")
  self.assertEqual(r.returncode,2)
 def test_capture_failure_preserves_code_and_stops_only_in_parent(self):
  r=self.shell("capture value bash -c 'exit 7'; echo WRONG",1)
  self.assertEqual(r.returncode,7);self.assertEqual(r.stdout,"")
  self.assertEqual(r.stderr.count("MOCK_SYSTEMCTL stop "),1)
  self.assertIn("line=",r.stderr);self.assertIn("command=",r.stderr)
 def test_subshell_handler_has_no_service_action_or_stdout(self):
  # Assignment propagates rc; child reports, parent alone handles service.
  r=self.shell("value=$(false); echo WRONG",1)
  self.assertEqual(r.returncode,1);self.assertEqual(r.stdout,"")
  self.assertEqual(r.stderr.count("MOCK_SYSTEMCTL stop "),1)
 def test_no_stop_before_request(self):
  r=self.shell("false",0)
  self.assertEqual(r.returncode,1);self.assertNotIn("MOCK_SYSTEMCTL",r.stderr)
 def test_inventory_failure_never_reaches_diff(self):
  r=self.shell("state(){ return 9; }; diff(){ echo DIFF_CALLED; }; compare_output baseline state")
  self.assertEqual(r.returncode,9);self.assertNotIn("DIFF_CALLED",r.stdout)
 def test_different_inventory_refused(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'baseline';p.write_text("expected\n")
   r=self.shell("state(){ echo changed; }; compare_output "+str(p)+" state")
   self.assertEqual(r.returncode,1)
class EvidenceTests(unittest.TestCase):
 def test_successful_service(self):
  a.successful_service("ActiveState=inactive\nSubState=dead\nResult=success\nExecMainStatus=0\n")
 def test_missing_or_failed_service_proof(self):
  for text in ["","ActiveState=inactive\n","ActiveState=inactive\nSubState=dead\nResult=exit-code\nExecMainStatus=1\n"]:
   with self.assertRaises(a.Refused):a.successful_service(text)
 def test_exact_journal_match(self):
  proof={'result':'isolation-passed','uid':992,'mode':'isolation'}
  a.journal_matches("prefix "+json.dumps(proof),proof)
  with self.assertRaises(a.Refused):a.journal_matches("prefix "+json.dumps({**proof,'uid':993}),proof)
 def test_missing_attestation_not_accepted(self):
  with self.assertRaises(a.Refused):a.compare_receipt({}, {'image':{'sha256':'abc'}})
 def test_stale_image_or_evidence_refused(self):
  observed={'image':{'sha256':'new'},'evidence':{'journal':'same'}}
  receipt={'validated_at_utc':'2026-01-01T00:00:00+00:00','validation':{'image':{'sha256':'old'},'evidence':{'journal':'same'}}}
  with self.assertRaises(a.Refused):a.compare_receipt(receipt,observed)
  receipt['validation']=observed
  a.compare_receipt(receipt,observed)
 def test_symlink_proof_refused(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'file';p.write_text('proof');q=Path(d)/'link';q.symlink_to(p)
   with self.assertRaises(OSError):a.read(q,owner=os.getuid())
 def test_debugfs_internal_error_with_zero_exit_refused(self):
  fake=subprocess.CompletedProcess([],0,"","debugfs 1.47\nFile not found by ext2_lookup\n")
  with patch.object(a,'run',return_value=fake):
   with self.assertRaises(a.Refused):a.debug('cat /proof')
class AttestationWriteTests(unittest.TestCase):
 def test_validation_failure_writes_nothing(self):
  with tempfile.TemporaryDirectory() as d:
   receipt=Path(d)/'A-v2-attestation-r1.json'
   with patch.object(a,'ATTESTATION',receipt),patch.object(a,'CONTROL',Path(d)),patch.object(a,'validate',side_effect=a.Refused('bad evidence')),patch.object(a.sys,'argv',['validator','attest']):
    with self.assertRaises(a.Refused):a.main()
   self.assertEqual(list(Path(d).iterdir()),[])
 def test_validated_attestation_is_exclusive_and_never_a_ok(self):
  with tempfile.TemporaryDirectory() as d:
   receipt=Path(d)/'A-v2-attestation-r1.json'
   with patch.object(a,'ATTESTATION',receipt),patch.object(a,'CONTROL',Path(d)),patch.object(a,'validate',return_value={'proof':'verified mock'}),patch.object(a.sys,'argv',['validator','attest']),patch('builtins.print'):
    a.main()
    self.assertEqual(receipt.stat().st_mode & 0o777,0o400)
    self.assertEqual(json.loads(receipt.read_text())['validation'],{'proof':'verified mock'})
    with self.assertRaises(a.Refused):a.main()
   self.assertEqual([x.name for x in Path(d).iterdir()],['A-v2-attestation-r1.json'])
class PreservationTests(unittest.TestCase):
 def test_historical_admin_files_unchanged(self):
  names=subprocess.check_output(['git','ls-tree','-r','--name-only','105d443','docs/admin-proposals'],cwd=ROOT,text=True).splitlines()
  for name in names:
   self.assertEqual((ROOT/name).read_bytes(),subprocess.check_output(['git','show','105d443:'+name],cwd=ROOT),name)
 def test_b_has_only_independent_receipt_gate(self):
  s=(D/'reception-v2-b-r1.sh').read_text()
  self.assertIn('accept-a-v2-r1.py verify',s)
  self.assertNotIn('A.ok',s)
  self.assertNotIn('source ./reception-v2-common.sh',s)
  self.assertNotIn('<(',s)
  self.assertLess(s.index('accept-a-v2-r1.py verify'),s.index('mount -o'))
 def test_no_process_substitution_in_new_library(self):
  self.assertNotIn('<(',(D/'reception-v2-common-r1.sh').read_text())
 def test_attestor_has_no_mutating_admin_commands(self):
  source=(D/'accept-a-v2-r1.py').read_text()
  for forbidden in ["['mount'","['umount'","'systemctl','start'","'systemctl','stop'","'initdb'","'psql'","A.ok').open"]:
   self.assertNotIn(forbidden,source)
if __name__=='__main__':unittest.main()
