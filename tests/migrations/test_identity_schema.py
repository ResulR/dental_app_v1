"""Offline permission-graph checks; not PostgreSQL constraint integration."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]


def graph():
    sql = (ROOT / "migrations/0002_identity_clinics_permissions.sql").read_text()
    seed = sql.split("INSERT INTO public.permission_definitions(code,prerequisite_key) VALUES\n", 1)[1].split(";", 1)[0]
    pairs = re.findall(r"\('([a-z_.]+)','([a-z_.]*)'\)", seed)
    if len(dict(pairs)) != len(pairs):
        raise ValueError("duplicate permission")
    return dict(pairs)


def prerequisites(code, definitions):
    found = set()
    while definitions[code]:
        code = definitions[code]
        if code in found:
            raise ValueError("permission cycle")
        found.add(code)
    return found


class PermissionGraphTests(unittest.TestCase):
    def test_actions_require_the_business_projection(self):
        definitions = graph()
        for action in ["accept", "reject", "request_correction", "edit_instructions",
                       "start_manufacturing", "create_for_clinic"]:
            required = prerequisites("orders." + action, definitions)
            self.assertTrue({"orders.read_details", "orders.read_logistics"}.issubset(required))
        for action in ["plan", "set_priority", "mark_delivered", "correct"]:
            required = prerequisites("delivery." + action, definitions)
            self.assertIn("orders.read_logistics", required)
            self.assertNotIn("orders.read_details", required)

    def test_content_rights_are_distinct_and_owner_authority_not_delegable(self):
        definitions = graph()
        self.assertEqual(prerequisites("files.view", definitions), set())
        self.assertEqual(prerequisites("files.download", definitions), set())
        self.assertEqual(prerequisites("messaging.general.reply", definitions),
                         {"messaging.general.read"})
        self.assertEqual(prerequisites("messaging.order.reply", definitions),
                         {"messaging.order.read", "orders.read_logistics"})
        self.assertNotIn("audit.read", definitions)
        self.assertNotIn("admins.manage", definitions)
        for code in definitions:
            prerequisites(code, definitions)  # Every path terminates within the closed registry.

    def test_cycle_detection_rejects_a_mutated_graph(self):
        with self.assertRaisesRegex(ValueError, "cycle"):
            prerequisites("a", {"a": "b", "b": "a"})


if __name__ == "__main__":
    unittest.main()
