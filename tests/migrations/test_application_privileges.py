"""Static security policy checks only; no PostgreSQL connection or SQL execution."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]


def grants():
    sql = (ROOT / "migrations/0010_application_table_privileges.sql").read_text()
    pattern = r"GRANT (SELECT|INSERT|UPDATE|DELETE)(?:\(([^)]+)\))? ON ([a-z_.,]+) TO ([a-z_]+);"
    matches = [re.fullmatch(pattern, line) for line in sql.splitlines()]
    if not matches or not all(matches):
        raise AssertionError("Unrecognized privilege statement")
    rows = [match.groups() for match in matches]
    return [(action, set(columns.split(",")) if columns else None, set(targets.split(",")), role)
            for action, columns, targets, role in rows]


class PrivilegePolicyTests(unittest.TestCase):
    def test_only_existing_project_objects_and_application_role(self):
        objects = set()
        for path in (ROOT / "migrations").glob("000*.sql"):
            objects.update(re.findall(r"CREATE (?:TABLE|VIEW) (public\.[a-z_]+)", path.read_text()))
        for _, _, targets, role in grants():
            self.assertEqual(role, "dental_lab_app")
            self.assertTrue(targets <= objects)
            self.assertNotIn("public", targets)

    def test_history_and_audit_are_append_only(self):
        protected = {"audit_events", "outbox_events", "order_versions", "order_version_teeth",
                     "order_status_events", "order_logistics_events", "catalog_reference_snapshots",
                     "work_links", "message_versions", "draft_revisions", "draft_sync_receipts"}
        for action, _, targets, _ in grants():
            if action in {"UPDATE", "DELETE"}:
                self.assertFalse(targets & {"public." + name for name in protected})

    def test_mutations_are_scoped_to_columns_and_bootstrap_not_runtime(self):
        for action, columns, targets, _ in grants():
            if action == "UPDATE":
                self.assertIsNotNone(columns)
                self.assertFalse(columns & {"id", "clinic_id", "account_id", "profile", "received_at"})
            if action == "INSERT":
                self.assertFalse(targets & {"public.owner_slot", "public.permission_definitions"})
                if "public.orders" in targets:
                    self.assertIsNotNone(columns)
                    self.assertFalse(columns & {"number", "received_at"})

    def test_no_default_schema_role_sequence_or_grant_option(self):
        sql = (ROOT / "migrations/0010_application_table_privileges.sql").read_text()
        for token in ("ALL PRIVILEGES", "ON ALL", "DEFAULT PRIVILEGES", "GRANT OPTION",
                      "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN", "SEQUENCE", "ALTER ROLE"):
            self.assertNotIn(token, sql)


if __name__ == "__main__":
    unittest.main()
