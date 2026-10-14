"""Source checks only: PostgreSQL privileges, locks and rollback need a new recipe."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]


class RegistrationTermsSourceTests(unittest.TestCase):
    def test_no_legal_text_owner_or_current_version_is_seeded(self):
        sql = (ROOT / "migrations/0014_clinic_registration_terms.sql").read_text()
        self.assertNotRegex(sql, r"(?i)INSERT\s+INTO")
        self.assertNotRegex(sql, r"(?i)(CREATE\s+ROLE|ALTER\s+ROLE|SECURITY\s+DEFINER)")
        self.assertIn("CHECK(locale='sq')", sql)
        self.assertIn("CHECK(octet_length(body_sha256)=32)", sql)
        self.assertIn("CHECK(singleton=1)", sql)

    def test_app_can_lock_pointer_but_not_publish_or_rewrite_proof(self):
        sql = (ROOT / "migrations/0014_clinic_registration_terms.sql").read_text()
        grants = re.findall(r"GRANT[^;]+;", sql)
        self.assertEqual(len(grants), 3)
        self.assertIn("GRANT UPDATE(singleton) ON public.registration_current_terms TO dental_lab_app;", grants)
        self.assertIn("GRANT INSERT(account_id,terms_version_id) ON public.clinic_terms_acceptances TO dental_lab_app;", grants)
        self.assertFalse(any("DELETE" in grant or "ALL " in grant for grant in grants))
        self.assertIn("FOREIGN KEY(account_id,account_profile) REFERENCES public.accounts(id,profile)", sql)
        self.assertIn("PRIMARY KEY(account_id,terms_version_id)", sql)
