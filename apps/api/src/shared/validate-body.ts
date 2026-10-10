import type { RequestHandler } from "express";
import type { ContractSchema } from "@dental-lab/contracts";
import { parseContract } from "@dental-lab/contracts";
import { sendProblem } from "./problems.js";
export function validateBody<T, U>(
  schema: ContractSchema<T>,
  responseSchema: ContractSchema<U>,
  handler: (data: T) => unknown,
): RequestHandler {
  return async (req, res, next) => {
    const result = parseContract(schema, req.body);
    if (!result.success) {
      sendProblem(res, "VALIDATION_FAILED", 400, result.errors);
      return;
    }
    try {
      const output = parseContract(responseSchema, await handler(result.data));
      if (!output.success) {
        sendProblem(res, "INTERNAL_ERROR", 500);
        return;
      }
      res.json(output.data);
    } catch (error) {
      next(error);
    }
  };
}
