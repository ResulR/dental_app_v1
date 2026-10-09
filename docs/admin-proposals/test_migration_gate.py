import hashlib
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
from contextlib import ExitStack
from contextlib import redirect_stdout
import io
import os
import subprocess
import tempfile

spec = importlib.util.spec_from_file_location('gate', Path(__file__).with_name('dental-lab-migrate.py'))
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class SafetyTests(unittest.TestCase):
    def check(self, sql, version='0000_execution_probe.sql', sha=None):
        data = sql.encode()
        gate.validate(version, sha or hashlib.sha256(data).hexdigest(), data)

    def test_valid_readonly_probe(self):
        self.check("SELECT current_database(), session_user, current_user;\n")

    def test_case_end_and_nested_case_accepted(self):
        for sql in ['SELECT CASE WHEN true THEN 1 ELSE 0 END;',
                    'SELECT CASE 1 WHEN 1 THEN CASE WHEN true THEN 1 ELSE 0 END ELSE 0 END;',
                    "SELECT CASE WHEN true THEN 'it''s CASE END' ELSE 'x' END;",
                    'SELECT CASE/* outer /* nested */ comment */WHEN true THEN 1 ELSE 0 END;',
                    'SELECT CASE WHEN true THEN $$CASE END;$$ ELSE $tag$x$tag$ END;']:
            with self.subTest(sql=sql):
                self.check(sql)

    def test_end_transaction_variants_refused(self):
        for sql in ['END;', 'END WORK;', 'END TRANSACTION;', 'END AND CHAIN;',
                    'END AND NO CHAIN;', 'eNd/*x*/WORK;',
                    'SELECT CASE WHEN true THEN 1 ELSE 0 END; END;',
                    "SELECT 'CASE'; END;", 'SELECT "CASE"; END;',
                    '/* CASE */ END;', '-- CASE\nEND;', '-- CASE\rEND;',
                    'SELECT $$CASE$$; END;', 'SELECT $tag$CASE$tag$; END;',
                    'SELECT CASE WHEN true THEN 1; END;', 'SELECT CASE WHEN true THEN 1;']:
            with self.subTest(sql=sql), self.assertRaises(ValueError):
                self.check(sql)

    def test_other_transaction_and_session_controls_refused(self):
        for sql in ['BEGIN;', 'START TRANSACTION;', 'COMMIT;', 'ROLLBACK;',
                    'ABORT;', 'SAVEPOINT x;', 'RELEASE SAVEPOINT x;',
                    "PREPARE TRANSACTION 'x';", 'SET/**/ROLE postgres;',
                    'SET LOCAL ROLE postgres;', 'SET SESSION AUTHORIZATION postgres;',
                    'RESET ROLE;', 'DISCARD ALL;']:
            with self.subTest(sql=sql), self.assertRaises(ValueError):
                self.check(sql)

    def test_unclosed_lexical_constructs_refused(self):
        for sql in ["SELECT 'x", 'SELECT "x', 'SELECT $$x', 'SELECT $tag$x', '/* x',
                    'SELECT $é$ CASE $é$;', 'SELECT $1;']:
            with self.subTest(sql=sql), self.assertRaises(ValueError):
                self.check(sql)

    def test_all_three_real_fixtures_accepted(self):
        folder = Path(__file__).resolve().parents[2] / 'migrations'
        for name in ['0000_execution_probe.sql', '9900_atomicity_failure_probe.sql',
                     '9901_atomicity_success_probe.sql']:
            data = (folder / name).read_bytes()
            with self.subTest(fixture=name):
                gate.validate(name, hashlib.sha256(data).hexdigest(), data)

    def test_unreviewed_bytes(self):
        with self.assertRaises(ValueError):
            self.check('SELECT 1;', sha='0' * 64)

    def test_destination_injection(self):
        for name in ['../../x.sql', '/tmp/x.sql', 'x;id.sql', '0000_x.sql -d other']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                self.check('SELECT 1;', version=name)

    def test_connection_shell_transaction_escape(self):
        for sql in ['\\connect other', '\\! id', 'COMMIT; SELECT 1;', 'RESET ROLE;',
                    'SET ROLE postgres;', 'PREPARE TRANSACTION \'x\';', 'SELECT 1;\x00']:
            with self.subTest(sql=sql), self.assertRaises(ValueError):
                self.check(sql)

    def test_obfuscated_session_and_nontransactional_effects(self):
        for sql in ['SET/**/ROLE postgres;', 'SET/*x*/TRANSACTION READ ONLY;',
                    "SELECT nextval('s');", "SELECT set_config('role','postgres',false);",
                    'CALL x();', "COPY x TO PROGRAM 'id';"]:
            with self.subTest(sql=sql), self.assertRaises(ValueError):
                self.check(sql)

    def test_sql_file_transaction_contract(self):
        args = gate.migration_psql_args('/immutable/0000_probe.sql')
        self.assertIn('--single-transaction', args)
        self.assertEqual(args.count('-c'), 2)
        self.assertEqual(args[args.index('-f') + 1], '/immutable/0000_probe.sql')
        self.assertIn('ON_ERROR_STOP=1', args)
        self.assertEqual(args[args.index('-d') + 1], 'dental_lab')
        self.assertEqual(args[args.index('-U') + 1], 'dental-migrate')

    def test_nonroot_never_calls_privileged_operations(self):
        with patch.object(gate.os, 'geteuid', return_value=1002), patch.object(gate, 'admin') as admin:
            with self.assertRaises(SystemExit):
                gate.main()
            admin.assert_not_called()

    def test_admin_accepts_only_fixed_literals(self):
        with patch.object(gate.subprocess, 'run') as run:
            with self.assertRaises(ValueError):
                gate.admin('DROP DATABASE dental_lab;')
            run.assert_not_called()

    def test_invalid_bytes_size_and_version_length(self):
        for data in [b'', b'\xff', b'a' * 1048577, b'\xef\xbb\xbfSELECT 1;']:
            with self.subTest(size=len(data)), self.assertRaises((ValueError, UnicodeDecodeError)):
                gate.validate('0000_probe.sql', hashlib.sha256(data).hexdigest(), data)
        with self.assertRaises(ValueError):
            self.check('SELECT 1;', version='0000_' + 'a' * 65 + '.sql')

    def test_symlink_and_writable_control_rejected(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as folder:
            path = Path(folder) / 'bad'
            path.symlink_to('/dev/null')
            with self.assertRaises(ValueError):
                gate.protected(path)
            path.unlink()
            path.write_text('test')
            path.chmod(0o666)
            with self.assertRaises(ValueError):
                gate.protected(path)

    def lifecycle(self, failed_sql=False, failed_close=False):
        data = b'SELECT 1;\n'
        sha = hashlib.sha256(data).hexdigest()
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as folder, ExitStack() as stack:
            stack.enter_context(redirect_stdout(io.StringIO()))
            base = Path(folder)
            (base / 'receipts').mkdir(mode=0o700)
            stack.enter_context(patch.object(gate, 'BASE', base))
            stack.enter_context(patch.object(gate, 'INSTALLED', Path(gate.__file__).absolute()))
            stack.enter_context(patch.object(gate.os, 'geteuid', return_value=0))
            stack.enter_context(patch.object(gate, 'protected'))
            stack.enter_context(patch.object(gate, 'protected_tree'))
            stack.enter_context(patch.object(gate.os, 'chown'))
            stack.enter_context(patch.object(gate.os, 'fchown'))
            stack.enter_context(patch.object(gate.signal, 'signal'))
            stack.enter_context(patch.object(gate.sys, 'argv', ['gate', '0000_probe.sql', sha]))

            def execute(args, **kwargs):
                if args[0] == '/usr/sbin/runuser':
                    return subprocess.CompletedProcess(args, 0, stdout=data)
                if failed_sql:
                    raise subprocess.CalledProcessError(3, args)
                return subprocess.CompletedProcess(args, 0)

            stack.enter_context(patch.object(gate.subprocess, 'run', side_effect=execute))
            stack.enter_context(patch('grp.getgrnam', return_value=type('Group', (), {'gr_gid': os.getgid()})()))

            def administration(sql):
                if failed_close and sql == 'ALTER ROLE "dental-migrate" NOLOGIN;':
                    raise RuntimeError('Fermeture simulée indisponible')

            admin = stack.enter_context(patch.object(gate, 'admin', side_effect=administration))
            if failed_sql or failed_close:
                with self.assertRaises((subprocess.CalledProcessError, RuntimeError)):
                    gate.main()
                self.assertTrue((base / 'receipts/0000_probe.sql.pending').exists())
                self.assertFalse((base / 'receipts/0000_probe.sql').exists())
                if failed_sql:
                    calls = len(admin.call_args_list)
                    with patch.object(gate.sys, 'argv', ['gate', '0001_next.sql', sha]):
                        with self.assertRaises(SystemExit):
                            gate.main()
                    self.assertEqual(len(admin.call_args_list), calls)
            else:
                gate.main()
                self.assertFalse((base / 'receipts/0000_probe.sql.pending').exists())
                self.assertTrue((base / 'receipts/0000_probe.sql').exists())
            self.assertIn(unittest.mock.call('ALTER ROLE "dental-migrate" NOLOGIN;'), admin.call_args_list)
            marker = base / 'receipts' / ('0000_probe.sql.pending' if failed_sql or failed_close else '0000_probe.sql')
            import json
            snapshot = Path(json.loads(marker.read_text())['snapshot'])
            self.assertEqual(snapshot.read_bytes(), data)
            if not failed_close:
                self.assertEqual(admin.call_args_list[-1], unittest.mock.call(gate.CLOSED))

    def test_sql_failure_keeps_pending_and_closes_role(self):
        self.lifecycle(failed_sql=True)

    def test_cleanup_failure_never_produces_success_receipt(self):
        self.lifecycle(failed_close=True)

    def test_receipt_requires_sql_success_and_verified_closure(self):
        self.lifecycle()


if __name__ == '__main__':
    unittest.main()
