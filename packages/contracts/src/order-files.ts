import { z } from "zod";
const Query = z.strictObject({
  order_id: z.uuid(),
  version_id: z.uuid(),
  after: z.uuid().optional(),
});
const Page = z.strictObject({
  version_id: z.uuid(),
  items: z
    .array(
      z.strictObject({
        id: z.uuid(),
        filename: z.string().min(1),
        format: z.enum(["stl", "ply", "obj", "jpg", "png", "heic", "pdf"]),
        size_bytes: z.number().int().positive().max(200_000_000),
      }),
    )
    .max(50),
  next_after: z.uuid().nullable(),
  download_available: z.literal(false),
});
export type OrderFilesQuery = z.output<typeof Query>;
export const OrderFilesQuerySchema: z.ZodType<OrderFilesQuery> = Query;
export type OrderFilesPage = z.output<typeof Page>;
export const OrderFilesPageSchema: z.ZodType<OrderFilesPage> = Page;
