import type { StatusSchema } from "@dental-lab/contracts";

type Status = ReturnType<typeof StatusSchema.parse>;

export function showRetouchEntry(
  clinic: boolean,
  status: Status,
  orderId: string,
  openDetailId: string | undefined,
  location: "list" | "detail",
) {
  if (!clinic || status !== "delivered") return false;
  return location === "detail" || orderId !== openDetailId;
}
