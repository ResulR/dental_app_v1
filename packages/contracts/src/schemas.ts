import { z } from "zod";
const nonBlank = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0);
export const ObjectIdSchema = nonBlank.max(128);
export const RevisionSchema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);
export const StatusSchema = z.enum([
  "pending",
  "correction_requested",
  "rejected",
  "accepted",
  "manufacturing",
  "completed",
  "delivered",
  "cancelled",
]);
export const FDI = [
  11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33,
  34, 35, 36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48,
] as const;
export const ToothSchema = z.strictObject({
  fdi: z.literal(FDI),
  selection: z.enum(["normal", "pontic"]),
});
export function calendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year as number, (month as number) - 1, day);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}
export const DateSchema = z.iso.date().refine(calendarDate);
export const PatientSchema = z
  .strictObject({
    first_name: nonBlank.optional(),
    last_name: nonBlank.optional(),
    internal_reference: nonBlank.optional(),
  })
  .refine(
    (patient) =>
      patient.internal_reference !== undefined ||
      (patient.first_name !== undefined && patient.last_name !== undefined),
  );
export const ClinicSubmissionSchema = z.strictObject({
  patient: PatientSchema,
  requested_delivery_date: DateSchema,
  material_id: ObjectIdSchema,
  shade_id: ObjectIdSchema,
  work_type_id: ObjectIdSchema.optional(),
  description: z.string().optional(),
  teeth: z
    .array(ToothSchema)
    .max(32)
    .refine(
      (teeth) => new Set(teeth.map((tooth) => tooth.fdi)).size === teeth.length,
    ),
  file_ids: z
    .array(ObjectIdSchema)
    .refine((ids) => new Set(ids).size === ids.length),
});
export const MutationPreconditionSchema = z.strictObject({
  expected_revision: RevisionSchema,
});
export const ProblemCodeSchema = z.enum([
  "VALIDATION_FAILED",
  "AUTHENTICATION_REQUIRED",
  "FORBIDDEN",
  "RESOURCE_NOT_FOUND",
  "REVISION_CONFLICT",
  "STATE_CONFLICT",
  "REQUEST_ALREADY_PENDING",
  "CATALOG_FORBIDDEN",
  "CATALOG_UNAVAILABLE",
  "FILE_NOT_READY",
  "FILE_TOO_LARGE",
  "UPLOAD_EXPIRED",
  "IDEMPOTENCY_CONFLICT",
  "RATE_LIMITED",
  "MAINTENANCE",
  "STORAGE_UNAVAILABLE",
  "DEPENDENCY_UNAVAILABLE",
  "INTERNAL_ERROR",
]);
export const ProblemSchema = z
  .strictObject({
    type: z.string().regex(/^\/api\/v1\/problems\/[a-z_]+$/),
    title: z.string(),
    status: z.number().int().min(400).max(599),
    code: ProblemCodeSchema,
    request_id: ObjectIdSchema,
    errors: z
      .array(
        z.strictObject({
          pointer: z.string().regex(/^\//),
          code: z.string().regex(/^[A-Z_]+$/),
        }),
      )
      .optional(),
    retry_after_seconds: z.number().int().min(0).optional(),
  })
  .refine(
    (problem) =>
      problem.type === "/api/v1/problems/" + problem.code.toLowerCase(),
  );
export const LogisticsProjectionSchema = z.strictObject({
  id: ObjectIdSchema,
  number: nonBlank,
  clinic_name: nonBlank,
  status: StatusSchema,
  revision: RevisionSchema,
  priority: z.boolean(),
  requested_delivery_date: DateSchema.nullable(),
  planned_delivery_date: DateSchema.nullable(),
  delivery_mode: z
    .enum(["laboratory_delivery", "clinic_pickup", "external_courier"])
    .nullable(),
});
export const SubmissionReceiptSchema = z.strictObject({
  order_id: ObjectIdSchema,
  number: nonBlank,
  committed_at: z.iso
    .datetime()
    .refine((value) => calendarDate(value.slice(0, 10))),
  revision: RevisionSchema,
});
export const HealthSchema = z.strictObject({ status: z.literal("ok") });
export type ClinicSubmission = z.infer<typeof ClinicSubmissionSchema>;
export type Problem = z.infer<typeof ProblemSchema>;
export type ProblemCode = z.infer<typeof ProblemCodeSchema>;
export type LogisticsProjection = z.infer<typeof LogisticsProjectionSchema>;
export type ContractSchema<T> = z.ZodType<T>;
export type FieldIssue = { pointer: string; code: string };
export function parseContract<T>(
  schema: ContractSchema<T>,
  input: unknown,
): { success: true; data: T } | { success: false; errors: FieldIssue[] } {
  const result = schema.safeParse(input);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: result.error.issues.slice(0, 25).map((issue) => ({
      pointer:
        "/" +
        issue.path
          .map((key) => String(key).replaceAll("~", "~0").replaceAll("/", "~1"))
          .join("/"),
      code:
        issue.code === "unrecognized_keys"
          ? "UNRECOGNIZED_FIELDS"
          : "INVALID_FIELD",
    })),
  };
}
export function submissionWarnings(input: ClinicSubmission): readonly string[] {
  return input.teeth.length === 0 && !input.description?.trim()
    ? ["NO_TEETH_OR_DESCRIPTION"]
    : [];
}
export function exportJsonSchemas() {
  const schemas = {
    ObjectId: ObjectIdSchema,
    Revision: RevisionSchema,
    Status: StatusSchema,
    Patient: PatientSchema,
    Tooth: ToothSchema,
    ClinicSubmission: ClinicSubmissionSchema,
    MutationPrecondition: MutationPreconditionSchema,
    Problem: ProblemSchema,
    LogisticsProjection: LogisticsProjectionSchema,
    SubmissionReceipt: SubmissionReceiptSchema,
    Health: HealthSchema,
  };
  return Object.fromEntries(
    Object.entries(schemas).map(([name, schema]) => [
      name,
      z.toJSONSchema(schema, { target: "draft-2020-12", io: "input" }),
    ]),
  );
}
