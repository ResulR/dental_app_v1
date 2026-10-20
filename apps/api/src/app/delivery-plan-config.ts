export function deliveryPlanEnabled(env: NodeJS.ProcessEnv) {
  const flag = env.DENTAL_LAB_DELIVERY_PLAN_ENABLED;
  if (flag === undefined || flag === "false") return false;
  if (flag !== "true" || env.DENTAL_LAB_ORDER_TRACKING_ENABLED !== "true")
    throw new Error("INVALID_DELIVERY_PLAN_CONFIG");
  return true;
}
