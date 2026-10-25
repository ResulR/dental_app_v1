"""Offline verification only; v15 PostgreSQL execution requires separate approval."""
import hashlib
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
PG = ROOT / "tests/postgres"

class DormantDeliveryV15Static(unittest.TestCase):
    def test_isolation_and_scenarios(self):
        runner = (PG / "run-notifications-v15.sh").read_text()
        fixture = (PG / "notifications-v15-fixture.sql").read_text()
        probe = (PG / "notifications-v15.mjs").read_text()
        for token in (
            "DENTAL_NOTIFICATIONS_V15_APPROVED", ".local/notifications-v15",
            'test ! -e "$root"', "listen_addresses=''", "55445",
            "cpu.max", "memory.max", "pids.max", "trap stop_v15 EXIT",
            "V15_SQL_OK_STOPPED", "sha256sum -c", "cmp -s",
        ):
            self.assertIn(token, runner)
        self.assertIn("FRESH_ISOLATED_NOTIFICATIONS_V15_REQUIRED", fixture)
        self.assertIn(".local/notifications-v15/pgdata", fixture)
        self.assertIn("real-postgres-dormant-delivery-v15-passed", probe)
        for text in ("queueA.authorize(configLease)", "queueA.authorize(grantLease)",
                     "queueA.authorize(clinicLease)", "queueA.authorize(revisionLease)",
                     "queueA.authorize(expiredLease)", "queueA.authorize(lockedLease)",
                     "queueA.authorize(pendingLease)", "queueB.recoverExpired()",
                     "runOneSyntheticDelivery"):
            self.assertIn(text, probe)
        for prior in ("v12", "v13", "v14", "55443", "55444"):
            self.assertNotIn(prior, runner + fixture + probe)
        self.assertNotIn("notifications-v15", (PG / "run-notifications-v13.sh").read_text())

    def test_manifest_matches_all_bytes(self):
        lines = (PG / "notifications-v15.sha256").read_text().splitlines()
        self.assertEqual(len(lines), 248)
        paths = []
        for line in lines:
            digest, name = line.split("  ", 1)
            self.assertEqual(hashlib.sha256((ROOT / name).read_bytes()).hexdigest(), digest)
            paths.append(name)
        self.assertEqual(len(paths), len(set(paths)))
        for file in ("tests/postgres/notifications-v15-fixture.sql",
                     "tests/postgres/notifications-v15.mjs",
                     "tests/postgres/run-notifications-v15.sh",
                     "apps/api/dist/modules/notifications/dormant-delivery.repository.js",
                     "apps/api/dist/modules/notifications/dormant-delivery.worker.js"):
            self.assertIn(file, paths)

if __name__ == "__main__":
    unittest.main()
