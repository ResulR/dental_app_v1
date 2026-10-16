import { createOrderReviewRepository } from "./review.repository.js";
export function createOrderReviewService(
  database: Parameters<typeof createOrderReviewRepository>[0],
) {
  return createOrderReviewRepository(database);
}
