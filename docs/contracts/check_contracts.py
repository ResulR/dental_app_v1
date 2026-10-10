"""Design contract checks only; synthetic fixtures, no API/DB/browser access."""
from pathlib import Path
from copy import deepcopy
import json
from jsonschema import Draft202012Validator, FormatChecker

root = Path(__file__).resolve().parent
schema = json.loads((root / "common.schema.json").read_text())
consumers = json.loads((root / "consumers.json").read_text())
Draft202012Validator.check_schema(schema)
assert consumers["design_only"] is True
assert consumers["consumers"]["web"] == consumers["consumers"]["api"]
for refs in consumers["consumers"].values():
    for ref in refs.values():
        name = ref.split("#/$defs/")[1]
        assert name in schema["$defs"]
        assert ref.startswith("common.schema.json#/$defs/")

def validate(name, value, valid):
    local = {"$schema": schema["$schema"], "$defs": schema["$defs"], "$ref": "#/$defs/" + name}
    errors = list(Draft202012Validator(local, format_checker=FormatChecker()).iter_errors(value))
    assert (not errors) == valid, (name, valid, [e.validator for e in errors])

submission = {
    "patient": {"internal_reference": "REFERENCE-FICTIVE"},
    "requested_delivery_date": "2026-10-20",
    "material_id": "material-fictif", "shade_id": "teinte-fictive",
    "teeth": [], "file_ids": []
}
validate("ClinicSubmission", submission, True)
names = deepcopy(submission)
names["patient"] = {"first_name": "PrenomFictif", "last_name": "NomFictif"}
validate("ClinicSubmission", names, True)
both = deepcopy(names)
both["patient"]["internal_reference"] = "REFERENCE-FICTIVE"
validate("ClinicSubmission", both, True)
empty_description = deepcopy(submission)
empty_description["description"] = ""
validate("ClinicSubmission", empty_description, True)
for bad in [{}, {"first_name": "PrenomFictif"}]:
    fixture = deepcopy(submission)
    fixture["patient"] = bad
    validate("ClinicSubmission", fixture, False)
for injected in ["clinic_id", "status", "number", "actor_account_id"]:
    fixture = deepcopy(submission)
    fixture[injected] = "forged"
    validate("ClinicSubmission", fixture, False)
bad_date = deepcopy(submission)
bad_date["requested_delivery_date"] = "2026-02-30"
validate("ClinicSubmission", bad_date, False)
invalid_tooth = deepcopy(submission)
invalid_tooth["teeth"] = [{"fdi": 19, "selection": "normal"}]
validate("ClinicSubmission", invalid_tooth, False)
multi_material = deepcopy(submission)
multi_material["material_id"] = ["m1", "m2"]
validate("ClinicSubmission", multi_material, False)
duplicate_files = deepcopy(submission)
duplicate_files["file_ids"] = ["file-fictif", "file-fictif"]
validate("ClinicSubmission", duplicate_files, False)

logistics = {
    "id": "travail-fictif", "number": "NUMERO-FICTIF", "clinic_name": "Clinique fictive",
    "status": "accepted", "revision": 1, "priority": False,
    "requested_delivery_date": "2026-10-20", "planned_delivery_date": None,
    "delivery_mode": None
}
validate("LogisticsProjection", logistics, True)
for forbidden in ["patient", "description", "teeth", "material_id", "filename"]:
    fixture = deepcopy(logistics)
    fixture[forbidden] = "doit-etre-refuse"
    validate("LogisticsProjection", fixture, False)
validate("MutationPrecondition", {"expected_revision": 0}, True)
validate("MutationPrecondition", {"expected_revision": -1}, False)
problem = {
    "type": "/api/v1/problems/revision_conflict",
    "title": "Të dhënat kanë ndryshuar", "status": 409,
    "code": "REVISION_CONFLICT", "request_id": "requete-fictive"
}
validate("Problem", problem, True)
for forbidden in ["stack", "sql", "password", "recovery_code"]:
    fixture = deepcopy(problem)
    fixture[forbidden] = "valeur-fictive-refusee"
    validate("Problem", fixture, False)
print("OK: metaschema, shared web/API refs, clinical alternatives/empty teeth, authority injection, dates/FDI/files, logistics privacy, revisions and safe error shapes.")
print("Scope: design schemas only; no React/Express/API/DB/browser test executed.")
