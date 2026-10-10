import { expect, test } from "vitest";
import fs from "node:fs";
import {
  ClinicSubmissionSchema,
  FDI,
  LogisticsProjectionSchema,
  PatientSchema,
  ProblemSchema,
  RevisionSchema,
  calendarDate,
  parseContract,
  submissionWarnings,
  exportJsonSchemas,
  contractVersion,
} from "@dental-lab/contracts";
const valid = {
  patient: { internal_reference: "SYNTHETIC_REF" },
  requested_delivery_date: "2026-10-20",
  material_id: "synthetic-material",
  shade_id: "synthetic-shade",
  teeth: [],
  file_ids: [],
};
test("reference or name pair or both; zero teeth/description allowed with warning", () => {
  for (const patient of [
    { internal_reference: "SYNTHETIC_REF" },
    { first_name: "FICTIVE", last_name: "EXAMPLE" },
    {
      first_name: "FICTIVE",
      last_name: "EXAMPLE",
      internal_reference: "SYNTHETIC_REF",
    },
  ])
    expect(PatientSchema.safeParse(patient).success).toBe(true);
  for (const patient of [
    {},
    { first_name: "FICTIVE" },
    { internal_reference: "   " },
  ])
    expect(PatientSchema.safeParse(patient).success).toBe(false);
  expect(ClinicSubmissionSchema.safeParse(valid).success).toBe(true);
  expect(submissionWarnings(valid)).toEqual(["NO_TEETH_OR_DESCRIPTION"]);
  expect(
    ClinicSubmissionSchema.safeParse({
      ...valid,
      file_ids: Array.from({ length: 120 }, (_, n) => "file-" + n),
    }).success,
  ).toBe(true);
});
test("FDI32, duplicate state, dates, fields and unsafe revision rejected", () => {
  expect(FDI).toHaveLength(32);
  for (const tooth of FDI)
    expect(
      ClinicSubmissionSchema.safeParse({
        ...valid,
        teeth: [{ fdi: tooth, selection: "pontic" }],
      }).success,
    ).toBe(true);
  for (const input of [
    { ...valid, teeth: [{ fdi: 19, selection: "normal" }] },
    {
      ...valid,
      teeth: [
        { fdi: 11, selection: "normal" },
        { fdi: 11, selection: "pontic" },
      ],
    },
    { ...valid, requested_delivery_date: "2026-02-30" },
    { ...valid, requested_delivery_date: "2026-2-01" },
    { ...valid, clinic_id: "forged" },
    { ...valid, status: "accepted" },
    { ...valid, material_id: " " },
    { ...valid, file_ids: ["x", "x"] },
  ])
    expect(ClinicSubmissionSchema.safeParse(input).success).toBe(false);
  expect(calendarDate("2024-02-29")).toBe(true);
  expect(calendarDate("1900-02-29")).toBe(false);
  expect(RevisionSchema.safeParse(Number.MAX_SAFE_INTEGER + 1).success).toBe(
    false,
  );
});
test("closed logistics and problem projection; validation issues never echo values or unknown field names", () => {
  const source = {
    id: "order-synthetic",
    number: "TEST-1",
    clinic_name: "SYNTHETIC",
    status: "pending",
    revision: 0,
    priority: false,
    requested_delivery_date: null,
    planned_delivery_date: null,
    delivery_mode: null,
  };
  expect(LogisticsProjectionSchema.safeParse(source).success).toBe(true);
  expect(
    LogisticsProjectionSchema.safeParse({
      ...source,
      patient: { internal_reference: "SYNTHETIC_PRIVATE_MARKER" },
    }).success,
  ).toBe(false);
  const failed = parseContract(ClinicSubmissionSchema, {
    ...valid,
    SYNTHETIC_PRIVATE_MARKER: "SYNTHETIC_PRIVATE_MARKER",
  });
  expect(failed.success).toBe(false);
  expect(JSON.stringify(failed)).not.toContain("SYNTHETIC_PRIVATE_MARKER");
  expect(
    ProblemSchema.safeParse({
      type: "/api/v1/problems/internal_error",
      title: "Gabim",
      status: 500,
      code: "INTERNAL_ERROR",
      request_id: "opaque",
      stack: "private",
    }).success,
  ).toBe(false);
});
test("runtime snapshot detects structure/version drift and design top-level fields match", () => {
  const expected = JSON.parse(
    fs.readFileSync("docs/contracts/runtime-v1.snapshot.json", "utf8"),
  );
  expect(expected.version).toBe(contractVersion);
  const actual = exportJsonSchemas();
  expect(actual).toEqual(expected.schemas);
  const design = JSON.parse(
    fs.readFileSync("docs/contracts/common.schema.json", "utf8"),
  ).$defs;
  for (const name of [
    "Patient",
    "Tooth",
    "ClinicSubmission",
    "MutationPrecondition",
    "Problem",
    "LogisticsProjection",
    "SubmissionReceipt",
  ]) {
    expect(Object.keys(actual[name].properties).sort()).toEqual(
      Object.keys(design[name].properties).sort(),
    );
    expect((actual[name].required ?? []).sort()).toEqual(
      (design[name].required ?? []).sort(),
    );
    expect(actual[name].additionalProperties).toBe(false);
  }
  expect(actual.Status.enum).toEqual(design.Status.enum);
});
