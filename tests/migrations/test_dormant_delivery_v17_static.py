"""Offline verification only; v17 PostgreSQL execution requires separate approval."""
import hashlib
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
PG = ROOT / "tests/postgres"

class DormantDeliveryV17Static(unittest.TestCase):
    def test_isolation_and_scenarios(self):
        runner = (PG / "run-notifications-v17.sh").read_text()
        fixture = (PG / "notifications-v17-fixture.sql").read_text()
        probe = (PG / "notifications-v17.mjs").read_text()
        for token in (
            "DENTAL_NOTIFICATIONS_V17_APPROVED", ".local/notifications-v17",
            'test ! -e "$root"', "listen_addresses=''", "55447",
            "cpu.max", "memory.max", "pids.max", "trap stop_v17 EXIT",
            "V17_SQL_OK_STOPPED", "sha256sum -c", "cmp -s",
        ):
            self.assertIn(token, runner)
        self.assertIn("FRESH_ISOLATED_NOTIFICATIONS_V17_REQUIRED", fixture)
        self.assertIn(".local/notifications-v17/pgdata", fixture)
        self.assertIn("real-postgres-dormant-delivery-v17-passed", probe)
        self.assertIn("pg_stat_activity", probe)
        self.assertIn("pg_blocking_pids(pid)", probe)
        self.assertIn("activity.blockers.includes(blocker.pid)", probe)
        self.assertIn('activity.query.startsWith("SELECT o.id FROM public.outbox_events e")', probe)
        self.assertIn('lockedResult.value, "cancelled"', probe)
        self.assertIn("eq(observed, true)", probe)
        for text in ("queueA.authorize(configLease)", "queueA.authorize(grantLease)",
                     "queueA.authorize(clinicLease)", "queueA.authorize(revisionLease)",
                     "queueA.authorize(expiredLease)", "queueA.authorize(lockedLease)",
                     "queueA.authorize(pendingLease)", "queueB.recoverExpired()",
                     "runOneSyntheticDelivery"):
            self.assertIn(text, probe)
        for prior in ("v12", "v13", "v14", "v15", "v16", "55443", "55444", "55445", "55446"):
            self.assertNotIn(prior, runner + fixture + probe)
        self.assertNotIn("notifications-v17", (PG / "run-notifications-v13.sh").read_text())

    def test_manifest_matches_all_bytes(self):
        lines = (PG / "notifications-v17.sha256").read_text().splitlines()
        self.assertEqual(len(lines), 248)
        paths = []
        for line in lines:
            digest, name = line.split("  ", 1)
            self.assertEqual(hashlib.sha256((ROOT / name).read_bytes()).hexdigest(), digest)
            paths.append(name)
        self.assertEqual(len(paths), len(set(paths)))
        for file in ("tests/postgres/notifications-v17-fixture.sql",
                     "tests/postgres/notifications-v17.mjs",
                     "tests/postgres/run-notifications-v17.sh",
                     "apps/api/dist/modules/notifications/dormant-delivery.repository.js",
                     "apps/api/dist/modules/notifications/dormant-delivery.worker.js"):
            self.assertIn(file, paths)

if __name__ == "__main__":
    unittest.main()
