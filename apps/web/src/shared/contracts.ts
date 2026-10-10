import {
  ClinicSubmissionSchema,
  HealthSchema,
  ProblemSchema,
  parseContract,
} from "@dental-lab/contracts";
import type { ContractSchema } from "@dental-lab/contracts";
export function validateClinicSubmission(input: unknown) {
  return parseContract(ClinicSubmissionSchema, input);
}
export function decodeResponse<T>(
  schema: ContractSchema<T>,
  input: unknown,
): T {
  const result = parseContract(schema, input);
  if (!result.success) throw new Error("API_CONTRACT_MISMATCH");
  return result.data;
}
export function decodeHealth(input: unknown) {
  return decodeResponse(HealthSchema, input);
}
export function decodeProblem(input: unknown) {
  return decodeResponse(ProblemSchema, input);
}
