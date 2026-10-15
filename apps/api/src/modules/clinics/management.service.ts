import { createClinicProfileService } from "./profile.service.js";
import { createClinicManagementRepository } from "./management.repository.js";
import { createClinicReviewService } from "./review.service.js";
import type { ClinicDecision } from "./review.service.js";
export function createClinicManagementService(
  ...args: Parameters<typeof createClinicManagementRepository>
) {
  const [database, identity] = args;
  const store = createClinicManagementRepository(database, identity);
  const profile = createClinicProfileService({
    authorize: async (_actor, id) => !!(await store.readProfile(id)),
    readAuthorized: (_actor, id) => store.readProfile(id),
    updateAtomic: (_actor, id, input) => store.updateProfile(id, input),
  });
  const review = createClinicReviewService(store);
  return {
    readProfile: store.readProfile,
    contactHistory: store.contactHistory,
    async updateProfile(id: string, input: unknown) {
      const current = await store.readProfile(id);
      if (!current) return { kind: "denied" as const };
      return profile.update({ ...identity, clinicId: current.id }, id, input);
    },
    directory: store.directory,
    pending: store.pending,
    decide: (input: ClinicDecision) => review.decide(identity, input),
  };
}
