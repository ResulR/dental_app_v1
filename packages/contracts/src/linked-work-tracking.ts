import { z } from "zod";
import { StatusSchema } from "./schemas.js";
export const LinkedWorkQuerySchema = z.strictObject({
  order_id: z.uuid(),
  after: z.uuid().optional(),
});
const Order = z.strictObject({
  id: z.uuid(),
  number: z.string().regex(/^[1-9][0-9]*$/),
  status: StatusSchema,
});
const Page = z.strictObject({
  order: Order,
  can_read_details: z.boolean(),
  items: z
    .array(
      z.strictObject({
        id: z.uuid(),
        kind: z.enum(["retouch", "replacement", "supplement", "resubmission"]),
        intervention_kind: z.enum(["retouch", "remanufacture"]).nullable(),
        source: Order,
        child: Order,
        created_at: z.iso.datetime(),
      }),
    )
    .max(50),
  next_after: z.uuid().nullable(),
});
export type LinkedWorkPage = z.output<typeof Page>;
export const LinkedWorkPageSchema: z.ZodType<LinkedWorkPage> = Page;
