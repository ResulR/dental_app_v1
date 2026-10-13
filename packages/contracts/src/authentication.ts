import { z } from "zod";
export const LoginRequestSchema = z.strictObject({
  email: z.string().min(1).max(320),
  password: z.string().min(1).max(1024),
});
export const EmptyAuthMutationSchema = z.strictObject({});
export const SessionIdentitySchema = z.strictObject({
  account_id: z.uuid(),
  profile: z.enum(["owner", "admin", "employee", "clinic"]),
});
