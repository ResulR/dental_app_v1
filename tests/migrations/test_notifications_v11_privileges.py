"""Static gate for the proposed v11 bundle; never starts PostgreSQL."""
from pathlib import Path
import hashlib
import unittest

ROOT = Path(__file__).resolve().parents[2]
PG = ROOT / "tests/postgres"


class V11Privileges(unittest.TestCase):
    def test_migration_grants_and_viewer_lock_order(self):
        grants = (ROOT / "migrations/0010_application_table_privileges.sql").read_text()
        viewer = (ROOT / "apps/api/src/modules/notifications/internal.repository.ts").read_text()
        self.assertIn("GRANT SELECT ON public.accounts,public.owner_slot", grants)
        self.assertNotIn("UPDATE ON public.owner_slot", grants)
        self.assertNotIn("UPDATE(singleton", grants)
        self.assertIn("GRANT DELETE ON public.account_grants", grants)
        self.assertIn("GRANT UPDATE(revoked_at) ON public.sessions", grants)
        self.assertNotIn("FROM public.owner_slot WHERE singleton=1 FOR SHARE", viewer)
        account = viewer.index("SELECT id FROM public.accounts WHERE id=$1 FOR SHARE")
        grants_lock = viewer.index("LOCK TABLE public.account_grants IN SHARE MODE")
        session = viewer.index("SELECT id FROM public.sessions WHERE id=$1 AND account_id=$2 FOR SHARE")
        current = viewer.index("createCurrentPermissionsRepository(tx).current(actor)")
        self.assertTrue(account < grants_lock < session < current)

    def test_v11_isolated_and_negative_privilege_assertions(self):
        runner = (PG / "run-notifications-v11.sh").read_text()
        fixture = (PG / "notifications-v11-fixture.sql").read_text()
        tester = (PG / "notifications-v11.mjs").read_text()
        for contents in (runner, fixture, tester):
            self.assertIn("notifications-v11", contents)
            self.assertNotIn("notifications-v9", contents)
            self.assertIn("55441", contents)
        self.assertIn("trap stop_v11 EXIT", runner)
        self.assertIn("test ! -e \"$root\"", runner)
        self.assertIn("sha256sum -c tests/postgres/notifications-v11.sha256", runner)
        self.assertIn("listen_addresses=''", runner)
        self.assertIn("SET CONSTRAINTS ALL IMMEDIATE", fixture)
        self.assertIn("SET LOCAL ROLE dental_lab_app", tester)
        self.assertIn('eq(error?.code, "42501")', tester)
        for table in ("owner_slot", "account_grants", "sessions", "email_category_recipients", "internal_notifications", "outbox_events"):
            self.assertIn("public." + table, tester)
        self.assertIn("real-postgres-notification-outbox-v11-passed", tester)

    def test_manifest_and_historical_manifest_unchanged(self):
        manifest = (PG / "notifications-v11.sha256").read_text().splitlines()
        self.assertEqual(len(manifest), 241)
        paths = [line.split("  ", 1)[1] for line in manifest]
        self.assertEqual(len(paths), len(set(paths)))
        self.assertTrue(all("notifications-v9" not in path for path in paths))
        self.assertTrue(all(".local/" not in path for path in paths))
        self.assertEqual(hashlib.sha256((PG / "notifications-v9.sha256").read_bytes()).hexdigest(),
                         "8685fa46aff201b90a7421d908968cae60806d0d1a0223ff4b863f5a352c7618")


if __name__ == "__main__":
    unittest.main()
