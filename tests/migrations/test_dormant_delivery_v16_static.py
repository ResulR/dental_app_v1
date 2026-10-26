"""Offline verification only; v16 PostgreSQL execution requires separate approval."""
import hashlib
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
PG = ROOT / "tests/postgres"

class DormantDeliveryV16Static(unittest.TestCase):
    def test_isolation_and_scenarios(self):
        runner = (PG / "run-notifications-v16.sh").read_text()
        fixture = (PG / "notifications-v16-fixture.sql").read_text()
        probe = (PG / "notifications-v16.mjs").read_text()
        for token in (
            "DENTAL_NOTIFICATIONS_V16_APPROVED", ".local/notifications-v16",
            'test ! -e "$root"', "listen_addresses=''", "55446",
            "cpu.max", "memory.max", "pids.max", "trap stop_v16 EXIT",
            "V16_SQL_OK_STOPPED", "sha256sum -c", "cmp -s",
        ):
            self.assertIn(token, runner)
        self.assertIn("FRESH_ISOLATED_NOTIFICATIONS_V16_REQUIRED", fixture)
        self.assertIn(".local/notifications-v16/pgdata", fixture)
        self.assertIn("real-postgres-dormant-delivery-v16-passed", probe)
        self.assertIn("pg_stat_activity", probe)
        self.assertIn("eq(observed, true)", probe)
        for text in ("queueA.authorize(configLease)", "queueA.authorize(grantLease)",
                     "queueA.authorize(clinicLease)", "queueA.authorize(revisionLease)",
                     "queueA.authorize(expiredLease)", "queueA.authorize(lockedLease)",
                     "queueA.authorize(pendingLease)", "queueB.recoverExpired()",
                     "runOneSyntheticDelivery"):
            self.assertIn(text, probe)
        for prior in ("v12", "v13", "v14", "v15", "55443", "55444", "55445"):
            self.assertNotIn(prior, runner + fixture + probe)
        self.assertNotIn("notifications-v16", (PG / "run-notifications-v13.sh").read_text())

    def test_manifest_matches_all_bytes(self):
        lines = (PG / "notifications-v16.sha256").read_text().splitlines()
        self.assertEqual(len(lines), 248)
        paths = []
        for line in lines:
            digest, name = line.split("  ", 1)
            self.assertEqual(hashlib.sha256((ROOT / name).read_bytes()).hexdigest(), digest)
            paths.append(name)
        self.assertEqual(len(paths), len(set(paths)))
        for file in ("tests/postgres/notifications-v16-fixture.sql",
                     "tests/postgres/notifications-v16.mjs",
                     "tests/postgres/run-notifications-v16.sh",
                     "apps/api/dist/modules/notifications/dormant-delivery.repository.js",
                     "apps/api/dist/modules/notifications/dormant-delivery.worker.js"):
            self.assertIn(file, paths)

if __name__ == "__main__":
    unittest.main()
