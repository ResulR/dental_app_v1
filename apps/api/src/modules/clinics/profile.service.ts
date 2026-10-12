import {
  ClinicContactUpdateSchema,
  ClinicProfileSchema,
} from "@dental-lab/contracts";
import type { ClinicContactUpdate, ClinicProfile } from "@dental-lab/contracts";
type Actor = {
  accountId: string;
  profile: "owner" | "admin" | "employee" | "clinic";
  clinicId?: string;
};
function inScope(actor: Actor, clinicId: string) {
  return actor.profile !== "clinic" || actor.clinicId === clinicId;
}
type Ports = {
  // Current session/account status and ownership or current clinics.manage grant.
  // This port must never trust a clinic ID/profile supplied by the request body.
  authorize: (
    actor: Actor,
    clinicId: string,
    action: "clinics.manage",
  ) => Promise<boolean>;
  readAuthorized: (
    actor: Actor,
    clinicId: string,
  ) => Promise<ClinicProfile | null>;
  // Recheck authorization, active account and ownership/grant in the SAME transaction
  // as revision CAS, contact update and append-only audit (changed field names only).
  // Preserve account email, approval, suspension, security flags and all old events.
  updateAtomic: (
    actor: Actor,
    clinicId: string,
    input: ClinicContactUpdate,
  ) => Promise<"applied" | "stale" | "denied">;
};
export function createClinicProfileService(ports: Ports) {
  return {
    async read(
      actor: Actor,
      clinicId: string,
    ): Promise<{ kind: "found"; profile: ClinicProfile } | { kind: "denied" }> {
      if (
        !clinicId ||
        !inScope(actor, clinicId) ||
        !(await ports.authorize(actor, clinicId, "clinics.manage"))
      )
        return { kind: "denied" };
      const profile = await ports.readAuthorized(actor, clinicId);
      if (!profile || profile.id !== clinicId) return { kind: "denied" };
      const parsed = ClinicProfileSchema.safeParse(profile);
      if (!parsed.success) throw new Error("CLINIC_PROFILE_CONTRACT_MISMATCH");
      return { kind: "found", profile: parsed.data };
    },
    async update(
      actor: Actor,
      clinicId: string,
      input: unknown,
    ): Promise<{ kind: "applied" | "conflict" | "denied" | "invalid" }> {
      const parsed = ClinicContactUpdateSchema.safeParse(input);
      if (!clinicId || !parsed.success) return { kind: "invalid" };
      if (
        !inScope(actor, clinicId) ||
        !(await ports.authorize(actor, clinicId, "clinics.manage"))
      )
        return { kind: "denied" };
      const result = await ports.updateAtomic(actor, clinicId, parsed.data);
      return { kind: result === "stale" ? "conflict" : result };
    },
  };
}
