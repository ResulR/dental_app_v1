import { createClinicManagementRepository } from "./management.repository.js";
import { createClinicReviewService } from "./review.service.js";
import type { ClinicDecision } from "./review.service.js";
export function createClinicManagementService(
  ...args: Parameters<typeof createClinicManagementRepository>
) {
  const [database, identity] = args;
  const store = createClinicManagementRepository(database, identity);
  const review = createClinicReviewService(store);
  return {
    readProfile: store.readProfile,
    pending: store.pending,
    decide: (input: ClinicDecision) => review.decide(identity, input),
  };
}
