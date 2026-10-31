import { DraftPayloadSchema } from "@dental-lab/contracts";
import type { OrderSubmissionSchema } from "@dental-lab/contracts";

type Input = ReturnType<typeof OrderSubmissionSchema.parse>["input"];

// The server draft is text-only. No file association is inferred from a browser ID.
export function draftMatchesSubmission(raw: unknown, input: Input): boolean {
  const stored = DraftPayloadSchema.safeParse(raw);
  const submitted = DraftPayloadSchema.safeParse({
    patient: input.patient,
    requested_delivery_date: input.requested_delivery_date,
    material: input.material_id,
    shade: input.shade_id,
    ...(input.work_type_id ? { work_type: input.work_type_id } : {}),
    ...(input.description ? { description: input.description } : {}),
    teeth: input.teeth,
  });
  if (!stored.success || !submitted.success) return false;
  const canonical = (value: typeof stored.data) =>
    JSON.stringify({
      ...value,
      teeth: [...(value.teeth ?? [])].sort((a, b) => a.fdi - b.fdi),
    });
  return canonical(stored.data) === canonical(submitted.data);
}
