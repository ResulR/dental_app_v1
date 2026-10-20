export function deliveryPriorityEnabled(env: NodeJS.ProcessEnv) {
  const flag = env.DENTAL_LAB_DELIVERY_PRIORITY_ENABLED;
  if (flag === undefined || flag === "false") return false;
  if (flag !== "true" || env.DENTAL_LAB_ORDER_TRACKING_ENABLED !== "true")
    throw new Error("INVALID_DELIVERY_PRIORITY_CONFIG");
  return true;
}
