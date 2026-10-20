import { z } from "zod";
import { OrderFilesPageSchema } from "@dental-lab/contracts";
import type { createApplicationDatabase } from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
import { readMessageFileMetadata } from "../files/index.js";
export const MessageFilesQuerySchema = z.strictObject({
  conversation_id: z.uuid(),
  message_id: z.uuid(),
  version_id: z.uuid(),
  after: z.uuid().optional(),
});
// Prepared read path, never exposes object keys, hashes or binary data.
export function createMessageFilesRepository(
  db: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    async list(actor: { accountId: string; sessionId: string }, raw: unknown) {
      const parsed = MessageFilesQuerySchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      const input = parsed.data;
      return db.transaction(async (tx) => {
        await tx.query("SELECT id FROM public.accounts WHERE id=$1 FOR SHARE", [
          actor.accountId,
        ]);
        await tx.query("LOCK TABLE public.account_grants IN SHARE MODE");
        await tx.query(
          "SELECT id FROM public.sessions WHERE id=$1 AND account_id=$2 FOR SHARE",
          [actor.sessionId, actor.accountId],
        );
        await tx.query(
          "SELECT id FROM public.clinics WHERE account_id=$1 FOR SHARE",
          [actor.accountId],
        );
        const identity =
          await createCurrentPermissionsRepository(tx).current(actor);
        if (!identity) return { kind: "denied" as const };
        let clinicId: string | null = null;
        if (identity.profile === "clinic") {
          const clinic = await tx.query(
            "SELECT id FROM public.clinics WHERE account_id=$1 AND review_state='approved' AND NOT suspended",
            [actor.accountId],
          );
          if (clinic.rows.length !== 1) return { kind: "denied" as const };
          clinicId = String(clinic.rows[0]!.id);
        } else if (!identity.permissions.includes("files.view")) {
          return { kind: "denied" as const };
        }
        const conversations = await tx.query(
          "SELECT id,clinic_id,kind FROM public.conversations WHERE id=$1 AND ($2::uuid IS NULL OR clinic_id=$2) FOR SHARE",
          [input.conversation_id, clinicId],
        );
        const conversation = conversations.rows[0];
        if (!conversation) return { kind: "denied" as const };
        if (identity.profile !== "clinic") {
          const permission =
            conversation.kind === "order"
              ? "messaging.order.read"
              : "messaging.general.read";
          if (!identity.permissions.includes(permission))
            return { kind: "denied" as const };
        }
        const messages = await tx.query(
          "SELECT id FROM public.messages WHERE id=$1 AND conversation_id=$2 AND clinic_id=$3 AND current_version_id=$4 AND hidden_at IS NULL FOR SHARE",
          [
            input.message_id,
            input.conversation_id,
            conversation.clinic_id,
            input.version_id,
          ],
        );
        if (messages.rows.length !== 1) return { kind: "denied" as const };
        const page = await readMessageFileMetadata(tx, {
          messageId: input.message_id,
          versionId: input.version_id,
          clinicId: String(conversation.clinic_id),
          ...(input.after ? { after: input.after } : {}),
        });
        return {
          kind: "page" as const,
          page: OrderFilesPageSchema.parse(page),
        };
      });
    },
  };
}
