export function deliveryBatchEnabled(env: NodeJS.ProcessEnv) {
  const flag = env.DENTAL_LAB_DELIVERY_BATCH_ENABLED;
  if (flag === undefined || flag === "false") return false;
  if (
    flag !== "true" ||
    env.DENTAL_LAB_ORDER_LIFECYCLE_ENABLED !== "true" ||
    env.DENTAL_LAB_ORDER_TRACKING_ENABLED !== "true"
  )
    throw new Error("INVALID_DELIVERY_BATCH_CONFIG");
  return true;
}
