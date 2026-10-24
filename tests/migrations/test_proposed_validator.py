"""Offline tests for a proposal; no database or privileged launcher."""
import hashlib
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


proposal = load("scripts/proposed-migration-validator.py", "proposal")
catalog = load("scripts/migration-catalog.py", "catalog")
legacy = catalog.load_gate()


class ProposedValidatorTests(unittest.TestCase):
    def test_exact_reviewed_migrations_only(self):
        for name in proposal.EXCEPTIONS:
            data = (ROOT / "migrations" / name).read_bytes()
            self.assertTrue(proposal.validate(name, hashlib.sha256(data).hexdigest(),
                                              data, legacy.validate))
            self.assertTrue(proposal.statements(data.decode()))

    def test_historical_policy_remains_the_default(self):
        sql = b"SELECT 1;"
        self.assertIsNone(proposal.validate("0024_plain.sql",
                          hashlib.sha256(sql).hexdigest(), sql, legacy.validate))
        for sql in (b"BEGIN; SELECT 1;", b"SELECT set_config('x','y',true);",
                    b"DO $$ BEGIN NULL; END $$;", b"COPY public.accounts TO STDOUT;"):
            with self.subTest(sql=sql), self.assertRaises(ValueError):
                proposal.validate("0024_plain.sql", hashlib.sha256(sql).hexdigest(),
                                  sql, legacy.validate)

    def test_exception_rejects_changed_bytes_even_when_expected_hash_is_changed(self):
        for name in proposal.EXCEPTIONS:
            original = (ROOT / "migrations" / name).read_bytes()
            for altered in (original + b"\n", original + b"BEGIN;",
                            original.replace(b"DO NOTHING", b"DO UPDATE"),
                            original.replace(b"SET search_path", b"SET ROLE"),
                            original.replace(b"pending", b"delivered")):
                if altered == original:
                    continue
                with self.subTest(name=name), self.assertRaisesRegex(
                    ValueError, "EXCEPTION_BYTES_NOT_REVIEWED"
                ):
                    proposal.validate_exception(name, hashlib.sha256(altered).hexdigest(),
                                                altered)
            with self.assertRaisesRegex(ValueError, "EXCEPTION_BYTES_NOT_REVIEWED"):
                proposal.validate_exception(name, "0" * 64, original)
        with self.assertRaisesRegex(ValueError, "NOT_EXCEPTION"):
            proposal.validate_exception("0024_plain.sql", "0" * 64, b"SELECT 1;")

    def test_structural_policy_still_rejects_forbidden_sql_if_a_hash_were_revised(self):
        # Unit-only re-pin exercises the lexical policy; no shipped pin is changed.
        cases = {
            "0022_delivery_batch_receipts.sql": [
                (b"\nBEGIN;", "FORBIDDEN_TOP_LEVEL_TOKEN"),
                (b"\nSET ROLE postgres;", "UNREVIEWED_STATEMENT_SHAPE"),
            ],
            "0023_conversation_read_markers_backfill.sql": [
                (b"\nCOPY public.accounts TO STDOUT;", "FORBIDDEN_TOP_LEVEL_TOKEN"),
                (b"\nDO $$ BEGIN NULL; END $$;", "UNREVIEWED_BACKFILL_SHAPE"),
            ],
        }
        for name, alterations in cases.items():
            original = (ROOT / "migrations" / name).read_bytes()
            for suffix, reason in alterations:
                changed = original + suffix
                digest = hashlib.sha256(changed).hexdigest()
                saved = proposal.EXCEPTIONS[name]
                try:
                    proposal.EXCEPTIONS[name] = digest
                    with self.subTest(name=name, suffix=suffix), self.assertRaisesRegex(ValueError, reason):
                        proposal.validate_exception(name, digest, changed)
                finally:
                    proposal.EXCEPTIONS[name] = saved

    def test_lexer_keeps_quoted_bodies_opaque_and_rejects_truncation(self):
        self.assertEqual(proposal.statements(
            "/* nested /* ; */ */ CREATE FUNCTION f() RETURNS void AS $body$ "
            "BEGIN; SET ROLE postgres; END; $body$ LANGUAGE plpgsql; -- tail\n"
        )[0].count("BODY"), 1)
        self.assertEqual(len(proposal.statements("SELECT ';'; SELECT $$;$$;")), 2)
        for sql in ("/* unclosed", "SELECT 'unclosed", "SELECT $tag$unclosed;",
                    "SELECT $1;", "SELECT 1", "SELECT 1;;", "SELECT 1;\\evil"):
            with self.subTest(sql=sql), self.assertRaises(ValueError):
                proposal.statements(sql)


if __name__ == "__main__":
    unittest.main()
