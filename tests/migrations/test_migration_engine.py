"""Offline engine regressions. No PostgreSQL, privileged calls or fixture replay."""
import contextlib
import fcntl
import hashlib
import importlib.util
import io
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("catalog", ROOT / "scripts/migration-catalog.py")
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)
gate = catalog.load_gate()


class CatalogTests(unittest.TestCase):
    def sql(self, folder, name="0002_example.sql", data=b"SELECT 1;"):
        path = Path(folder) / name
        path.write_bytes(data)
        path.chmod(0o600)
        return path

    def test_real_inventory_keeps_registered_probes_out_of_execution_plan(self):
        rows = catalog.inventory(ROOT / "migrations", gate.validate)
        self.assertTrue(set(catalog.HISTORICAL).issubset({row["version"] for row in rows}))
        for row in rows:
            self.assertEqual(row["purpose"], "historical_fixture_do_not_run"
                             if row["version"] in catalog.HISTORICAL else "requires_admin_review")

    def test_checksum_and_numeric_order(self):
        with tempfile.TemporaryDirectory(dir=ROOT / ".local") as folder:
            self.sql(folder, "0003_after.sql")
            self.sql(folder, "0002_before.sql")
            rows = catalog.inventory(folder, gate.validate)
            self.assertEqual([r["version"][:4] for r in rows], ["0002", "0003"])
            self.assertEqual(rows[0]["sha256"], hashlib.sha256(b"SELECT 1;").hexdigest())

    def test_duplicate_version_number_rejected(self):
        with tempfile.TemporaryDirectory(dir=ROOT / ".local") as folder:
            self.sql(folder, "0002_a.sql"); self.sql(folder, "0002_b.sql")
            with self.assertRaisesRegex(ValueError, "DUPLICATE"):
                catalog.inventory(folder, gate.validate)

    def test_symlink_hardlink_public_file_and_non_sql_refused(self):
        for kind in ["symlink", "hardlink", "public", "name"]:
            with self.subTest(kind=kind), tempfile.TemporaryDirectory(dir=ROOT / ".local") as folder:
                path = self.sql(folder)
                if kind == "symlink":
                    path.unlink(); path.symlink_to(ROOT / "migrations/0001_migration_engine_probe.sql")
                elif kind == "hardlink":
                    os.link(path, Path(folder) / "0003_link.sql")
                elif kind == "public":
                    path.chmod(0o644)
                else:
                    path.rename(Path(folder) / "not_sql.txt")
                with self.assertRaises((ValueError, OSError)):
                    catalog.inventory(folder, gate.validate)

    def test_empty_oversized_invalid_sql_and_historical_mutation_refused(self):
        cases = [("0002_example.sql", b""), ("0002_example.sql", b"a" * 1048577),
                 ("0002_example.sql", b"COMMIT;"),
                 ("0000_execution_probe.sql", b"SELECT 2;")]
        for name, data in cases:
            with self.subTest(name=name, size=len(data)), tempfile.TemporaryDirectory(dir=ROOT / ".local") as folder:
                self.sql(folder, name, data)
                with self.assertRaises(ValueError):
                    catalog.inventory(folder, gate.validate)

    def test_directory_symlink_refused(self):
        with tempfile.TemporaryDirectory(dir=ROOT / ".local") as folder:
            link = Path(folder) / "link"
            link.symlink_to(ROOT / "migrations", target_is_directory=True)
            with self.assertRaises(OSError):
                catalog.inventory(link, gate.validate)


class EngineTests(unittest.TestCase):
    def refusal(self, marker):
        data = b"SELECT 1;"
        sha = hashlib.sha256(data).hexdigest()
        with tempfile.TemporaryDirectory(dir=ROOT / ".local") as folder, contextlib.ExitStack() as stack:
            base = Path(folder)
            (base / "receipts").mkdir()
            (base / "receipts" / marker).write_text("synthetic-test-only")
            stack.enter_context(patch.object(gate, "BASE", base))
            stack.enter_context(patch.object(gate, "INSTALLED", Path(gate.__file__).absolute()))
            stack.enter_context(patch.object(gate.os, "geteuid", return_value=0))
            stack.enter_context(patch.object(gate, "protected"))
            stack.enter_context(patch.object(gate, "protected_tree"))
            stack.enter_context(patch.object(gate.sys, "argv", ["gate", "0001_probe.sql", sha]))
            run = stack.enter_context(patch.object(gate.subprocess, "run",
                        return_value=subprocess.CompletedProcess([], 0, stdout=data)))
            admin = stack.enter_context(patch.object(gate, "admin"))
            with self.assertRaisesRegex(SystemExit, "Version exécutée ou état incertain"):
                gate.main()
            admin.assert_not_called()
            self.assertEqual(run.call_count, 1)  # Mock source read only; no SQL command.
            self.assertEqual((base / "receipts" / marker).read_text(), "synthetic-test-only")

    def test_replay_success_receipt_refused_before_login(self):
        self.refusal("0001_probe.sql")

    def test_rollback_archive_never_replayed(self):
        self.refusal("0001_probe.sql.rollback-verified")

    def test_pending_same_or_other_version_blocks_all(self):
        for marker in ["0001_probe.sql.pending", "0000_other.sql.pending"]:
            with self.subTest(marker=marker):
                self.refusal(marker)

    def test_flock_blocks_second_operator_before_any_source_or_sql_call(self):
        with tempfile.TemporaryDirectory(dir=ROOT / ".local") as folder, contextlib.ExitStack() as stack:
            base = Path(folder); (base / "receipts").mkdir()
            held = stack.enter_context((base / "operator.lock").open("a"))
            fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
            stack.enter_context(patch.object(gate, "BASE", base))
            stack.enter_context(patch.object(gate, "INSTALLED", Path(gate.__file__).absolute()))
            stack.enter_context(patch.object(gate.os, "geteuid", return_value=0))
            stack.enter_context(patch.object(gate, "protected"))
            stack.enter_context(patch.object(gate, "protected_tree"))
            stack.enter_context(patch.object(gate.sys, "argv", ["gate", "0001_probe.sql", "a" * 64]))
            run = stack.enter_context(patch.object(gate.subprocess, "run"))
            admin = stack.enter_context(patch.object(gate, "admin"))
            with self.assertRaises(BlockingIOError):
                gate.main()
            run.assert_not_called(); admin.assert_not_called()

    def test_transactional_lock_and_psql_file_contract_preserved(self):
        args = gate.migration_psql_args("/protected/snapshot.sql")
        self.assertIn("--single-transaction", args)
        self.assertEqual(args.count("-c"), 2)
        self.assertIn("-f", args)
        self.assertIn("pg_advisory_xact_lock(28467789)", gate.PREAMBLE)
        self.assertEqual(args[args.index("-d") + 1], "dental_lab")
        self.assertEqual(args[args.index("-U") + 1], "dental-migrate")


if __name__ == "__main__":
    unittest.main()
