import { z } from "zod";
import { OrderPreflightInputSchema } from "./order-preflight.js";

// A hint only: never an authority to stop submission or identify a patient.
export const OrderSimilarityInputSchema = OrderPreflightInputSchema;
export const OrderSimilarityResultSchema = z.strictObject({
  matches: z
    .array(
      z.strictObject({
        order_id: z.uuid(),
        number: z.string().regex(/^[1-9][0-9]*$/),
        signal: z.enum(["same_reference_and_work", "same_name_and_work"]),
      }),
    )
    .max(3),
});
