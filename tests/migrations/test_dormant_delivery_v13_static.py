"""Read-only checks for the distinct, unexecuted v13 proposal."""
import hashlib
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
V13 = ROOT / "tests/postgres"


class DormantDeliveryV13Static(unittest.TestCase):
    def test_isolated_runner_and_no_reuse(self):
        runner = (V13 / "run-notifications-v13.sh").read_text()
        fixture = (V13 / "notifications-v13-fixture.sql").read_text()
        probe = (V13 / "notifications-v13.mjs").read_text()
        for token in [
            "DENTAL_NOTIFICATIONS_V13_APPROVED", ".local/notifications-v13",
            'test ! -e "$root"', "listen_addresses=''", "55443",
            "cpu.max", "memory.max", "pids.max", "trap stop_v13 EXIT",
            "V13_SQL_OK_STOPPED", "sha256sum -c", "cmp -s",
        ]:
            self.assertIn(token, runner)
        self.assertIn("FRESH_ISOLATED_NOTIFICATIONS_V13_REQUIRED", fixture)
        self.assertIn(".local/notifications-v13/pgdata", fixture)
        self.assertIn("55443", fixture)
        self.assertIn("real-postgres-dormant-delivery-v13-passed", probe)
        self.assertNotIn(".local/notifications-v12", runner + fixture + probe)
        self.assertNotIn("notifications-v12.", runner + fixture + probe)

    def test_manifest_current_and_scenarios(self):
        lines = (V13 / "notifications-v13.sha256").read_text().splitlines()
        paths = []
        for line in lines:
            digest, name = line.split("  ", 1)
            path = ROOT / name
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), digest)
            paths.append(name)
        self.assertEqual(len(paths), len(set(paths)))
        for required in [
            "migrations/0008_events_notifications_audit.sql",
            "migrations/0010_application_table_privileges.sql",
            "tests/postgres/notifications-v13-fixture.sql",
            "tests/postgres/notifications-v13.mjs",
            "tests/postgres/run-notifications-v13.sh",
            "apps/api/dist/modules/notifications/dormant-delivery.repository.js",
            "apps/api/dist/modules/notifications/dormant-delivery.worker.js",
        ]:
            self.assertIn(required, paths)
        probe = (V13 / "notifications-v13.mjs").read_text()
        for scenario in [
            "queueB.claim()", "queueB.recoverExpired()", "queueB.preflight(other)",
            "temporary_error", "provider_accepted", "LEASE_EXPIRED",
            "email_category_recipients", "lifecycle='suspended'",
            "revision=revision+1", "runOneSyntheticDelivery",
        ]:
            self.assertIn(scenario, probe)


if __name__ == "__main__":
    unittest.main()
