import { permissionPrerequisites } from "./registry.js";
import type { PermissionCode } from "./registry.js";
export { permissionPrerequisites } from "./registry.js";
export type { PermissionCode } from "./registry.js";
// Trusted CURRENT server context only; never decode this from request body/JWT grants.
export type PermissionContext = {
  profile: "owner" | "admin" | "employee" | "clinic";
  lifecycle: "active" | "invited" | "suspended";
  sessionValid: boolean;
  securityLocked: boolean;
  resetRequired: boolean;
  ownerCurrent?: boolean;
  clinicId?: string;
  clinicSuspended?: boolean;
  grants: readonly string[];
};
const adminOnly = new Set<PermissionCode>([
  "delivery.correct",
  "employees.create",
  "employees.suspend",
  "employees.manage_permissions",
]);
const codes = Object.freeze(
  Object.keys(permissionPrerequisites) as PermissionCode[],
);
export function isPermissionCode(value: unknown): value is PermissionCode {
  return (
    typeof value === "string" && Object.hasOwn(permissionPrerequisites, value)
  );
}
function active(context: PermissionContext) {
  return (
    context.sessionValid === true &&
    context.lifecycle === "active" &&
    context.securityLocked === false &&
    context.resetRequired === false &&
    (context.profile !== "clinic" || context.clinicSuspended === false)
  );
}
function roleAllowed(profile: "admin" | "employee", code: PermissionCode) {
  return profile === "admin" || !adminOnly.has(code);
}
function knownSet(input: unknown): input is PermissionCode[] {
  return (
    Array.isArray(input) &&
    input.length <= codes.length &&
    input.every(isPermissionCode) &&
    new Set(input).size === input.length
  );
}
export function validateGrantSet(
  input: unknown,
  targetProfile: "admin" | "employee",
): boolean {
  if (!["admin", "employee"].includes(targetProfile) || !knownSet(input))
    return false;
  const granted = new Set(input);
  return input.every(
    (code) =>
      roleAllowed(targetProfile, code) &&
      (permissionPrerequisites[code] === null ||
        granted.has(permissionPrerequisites[code] as PermissionCode)),
  );
}
export function isCurrentOwner(context: PermissionContext): boolean {
  return (
    active(context) &&
    context.profile === "owner" &&
    context.ownerCurrent === true
  );
}
export function effectivePermissionCodes(
  context: PermissionContext,
): readonly PermissionCode[] {
  if (!active(context)) return Object.freeze([]);
  if (isCurrentOwner(context)) return codes;
  if (
    (context.profile !== "admin" && context.profile !== "employee") ||
    !knownSet(context.grants)
  )
    return Object.freeze([]);
  const profile = context.profile;
  const granted = new Set(context.grants);
  function allowed(code: PermissionCode): boolean {
    if (!granted.has(code) || !roleAllowed(profile, code)) return false;
    const parent = permissionPrerequisites[code];
    return parent === null || allowed(parent);
  }
  // Dropped prerequisites immediately invalidate dependents; no implicit additions.
  return Object.freeze(codes.filter(allowed));
}
export function hasEffectivePermission(
  context: PermissionContext,
  code: unknown,
): boolean {
  return (
    isPermissionCode(code) && effectivePermissionCodes(context).includes(code)
  );
}
export function clinicOwnsResource(
  context: PermissionContext,
  resourceClinicId: string,
): boolean {
  // Ownership predicate only: endpoints still require approval/workflow/category checks.
  return (
    active(context) &&
    context.profile === "clinic" &&
    !!resourceClinicId &&
    context.clinicId === resourceClinicId
  );
}
