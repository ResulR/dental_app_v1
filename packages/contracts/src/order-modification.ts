import { z } from "zod";
import { RevisionSchema } from "./schemas.js";
import { OrderInstructionsSchema, OrderEditViewSchema } from "./order-edit.js";
const base = {
  order_id: z.uuid(),
  expected_version_id: z.uuid(),
  expected_revision: RevisionSchema.min(1),
};
const Proposal = z.strictObject({
  ...base,
  action: z.literal("propose_modification"),
  input: OrderInstructionsSchema,
  confirmed_warnings: z.boolean(),
});
export type OrderModificationProposal = z.output<typeof Proposal>;
export const OrderModificationProposalSchema: z.ZodType<OrderModificationProposal> =
  Proposal;
const Decision = z.discriminatedUnion("action", [
  z.strictObject({
    ...base,
    request_id: z.uuid(),
    expected_request_revision: RevisionSchema.min(1),
    action: z.literal("accept_modification"),
    confirmed_warnings: z.boolean(),
  }),
  z.strictObject({
    ...base,
    request_id: z.uuid(),
    expected_request_revision: RevisionSchema.min(1),
    action: z.literal("reject_modification"),
    reason: z.string().trim().min(1).max(2000),
  }),
]);
export type OrderModificationDecision = z.output<typeof Decision>;
export const OrderModificationDecisionSchema: z.ZodType<OrderModificationDecision> =
  Decision;
const Context = z.strictObject({
  base: OrderEditViewSchema,
  proposal: OrderEditViewSchema,
  request_id: z.uuid(),
  request_revision: RevisionSchema.min(1),
});
export type OrderModificationContext = z.output<typeof Context>;
export const OrderModificationContextSchema: z.ZodType<OrderModificationContext> =
  Context;
