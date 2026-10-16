import {
  OrderLifecycleContextQuerySchema,
  OrderLifecycleContextSchema,
} from "@dental-lab/contracts";
import type { createApplicationDatabase } from "../../shared/database.js";
import { trackingAuthority } from "./tracking-auth.js";
export function createLifecycleContextRepository(
  db: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    async context(
      actor: { accountId: string; sessionId: string },
      raw: unknown,
    ) {
      const input = OrderLifecycleContextQuerySchema.safeParse(raw);
      if (!input.success) return { kind: "invalid" as const };
      return db.transaction(async (tx) => {
        const auth = await trackingAuthority(tx, actor);
        if (!auth) return { kind: "denied" as const };
        const r = await tx.query(
          "SELECT id AS order_id,number::text,status,current_version_id AS version_id,revision::text FROM public.orders WHERE id=$1 AND ($2::uuid IS NULL OR clinic_id=$2)",
          [input.data.order_id, auth.clinicId],
        );
        if (r.rows.length !== 1) return { kind: "denied" as const };
        return {
          kind: "result" as const,
          result: OrderLifecycleContextSchema.parse({
            ...r.rows[0],
            revision: Number(r.rows[0]!.revision),
          }),
        };
      });
    },
  };
}
