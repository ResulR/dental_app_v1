"""Static only: never starts PostgreSQL or rewrites frozen bundles."""
from pathlib import Path
import hashlib
import unittest

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "tests/postgres"


class FixtureOrdering(unittest.TestCase):
    def test_immediate_manufacturing_fk_is_satisfied_after_version_insert(self):
        schema = (ROOT / "migrations/0004_orders_versions.sql").read_text()
        self.assertIn("orders_current_version_fk", schema)
        self.assertIn("REFERENCES public.order_versions(order_id,id) DEFERRABLE INITIALLY DEFERRED", schema)
        self.assertIn("orders_manufacturing_version_fk", schema)
        self.assertIn("FOREIGN KEY(id,manufacturing_version_id) REFERENCES public.order_versions(order_id,id);", schema)
        fixture = (BASE / "notifications-v9-fixture.sql").read_text()
        inserts = fixture.index("INSERT INTO public.orders(id,clinic_id,kind,origin,created_by,status,current_version_id,manufacturing_version_id)")
        versions = fixture.index("INSERT INTO public.order_versions(id,order_id,clinic_id", inserts)
        manufacture = fixture.index("UPDATE public.orders SET manufacturing_version_id=current_version_id,status='manufacturing',revision=2", versions)
        completed = fixture.index("UPDATE public.orders SET status='completed',revision=3", manufacture)
        delivered = fixture.index("UPDATE public.orders SET status='delivered',revision=4", completed)
        link = fixture.index("INSERT INTO public.work_links", delivered)
        self.assertTrue(inserts < versions < manufacture < completed < delivered < link)
        self.assertIn(" 'accepted',\n ('76000000", fixture[inserts:versions])
        self.assertIn(" NULL::uuid\n FROM generate_series(1,4) n;", fixture[inserts:versions])
        self.assertIn("'retouch','retouch','accepted',4,'delivered'", fixture[link:])

    def test_historical_fixtures_still_contain_the_defect_and_are_not_rewritten(self):
        for name in ("messaging-v6", "notifications-v7", "notifications-v8"):
            fixture = (BASE / f"{name}-fixture.sql").read_text()
            self.assertIn("CASE WHEN n=3 THEN 'delivered' ELSE 'accepted' END", fixture)
            self.assertIn("CASE WHEN n=3 THEN ('76000000", fixture)
        self.assertEqual(hashlib.sha256((BASE / "notifications-v8.sha256").read_bytes()).hexdigest(),
                         "85c8697eb03b91bd5f4abea0131282b53969d974409b86a98c83d9c442605bb8")

    def test_v9_isolation_names_are_distinct(self):
        runner = (BASE / "run-notifications-v9.sh").read_text()
        fixture = (BASE / "notifications-v9-fixture.sql").read_text()
        tester = (BASE / "notifications-v9.mjs").read_text()
        for contents in (runner, fixture, tester):
            self.assertIn("notifications-v9", contents)
            self.assertNotIn("notifications-v8", contents)
            self.assertIn("55439", contents)
        self.assertIn("FOR SHARE OF o", tester)
        self.assertIn("source_revision: 4", tester)
        self.assertIn("trap stop_v9 EXIT", runner)
        self.assertIn("sha256sum -c tests/postgres/notifications-v9.sha256", runner)


if __name__ == "__main__":
    unittest.main()
