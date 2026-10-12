import { expect, test } from "vitest";
import fs from "node:fs";
import {
  permissionPrerequisites,
  validateGrantSet,
  hasEffectivePermission,
  effectivePermissionCodes,
  isCurrentOwner,
  clinicOwnsResource,
} from "../../apps/api/dist/modules/permissions/index.js";
const base = {
  profile: "admin",
  lifecycle: "active",
  sessionValid: true,
  securityLocked: false,
  resetRequired: false,
  grants: [],
};
function chain(code) {
  const parent = permissionPrerequisites[code];
  return parent ? [...chain(parent), code] : [code];
}
test("closed 29-code registry and acyclic prerequisites exactly match received immutable migration", () => {
  const sql = fs.readFileSync(
    "migrations/0002_identity_clinics_permissions.sql",
    "utf8",
  );
  const source = sql.slice(
    sql.indexOf("INSERT INTO public.permission_definitions"),
    sql.indexOf("CREATE VIEW public.permission_prerequisites"),
  );
  const rows = Array.from(
    source.matchAll(/\('([a-z_.]+)','([a-z_.]*)'\)/g),
    (m) => [m[1], m[2] || null],
  );
  expect(rows).toHaveLength(29);
  expect(permissionPrerequisites).toEqual(Object.fromEntries(rows));
  for (const code of Object.keys(permissionPrerequisites))
    expect(new Set(chain(code)).size).toBe(chain(code).length);
});
test("every capability denied by default, known valid chains allowed without adding missing rights", () => {
  for (const code of Object.keys(permissionPrerequisites)) {
    expect(hasEffectivePermission(base, code)).toBe(false);
    const grants = chain(code);
    expect(validateGrantSet(grants, "admin")).toBe(true);
    expect(hasEffectivePermission({ ...base, grants }, code)).toBe(true);
    if (grants.length > 1) {
      expect(validateGrantSet([code], "admin")).toBe(false);
      expect(hasEffectivePermission({ ...base, grants: [code] }, code)).toBe(
        false,
      );
    }
  }
  for (const invalid of [
    ["unknown"],
    ["orders.read_logistics", "orders.read_logistics"],
    ["toString"],
    ["audit.read"],
    ["owner"],
    "clinics.manage",
  ])
    expect(validateGrantSet(invalid, "admin")).toBe(false);
});
test("logistics cannot open detailed patient data, files or chat; file view/download independent", () => {
  const context = { ...base, grants: ["orders.read_logistics"] };
  for (const code of [
    "orders.read_details",
    "files.view",
    "files.download",
    "messaging.order.read",
    "messaging.general.read",
  ])
    expect(hasEffectivePermission(context, code)).toBe(false);
  expect(
    hasEffectivePermission(
      { ...base, grants: ["files.view"] },
      "files.download",
    ),
  ).toBe(false);
  expect(
    hasEffectivePermission(
      { ...base, grants: ["files.download"] },
      "files.view",
    ),
  ).toBe(false);
});
test("general/order/read/reply independent and removed prerequisite drops only its dependents", () => {
  const general = {
    ...base,
    grants: ["messaging.general.read", "messaging.general.reply"],
  };
  expect(hasEffectivePermission(general, "messaging.general.reply")).toBe(true);
  expect(hasEffectivePermission(general, "messaging.order.read")).toBe(false);
  const grants = [
    "orders.read_logistics",
    "messaging.order.read",
    "messaging.order.reply",
    "files.view",
  ];
  expect(
    hasEffectivePermission({ ...base, grants }, "messaging.order.reply"),
  ).toBe(true);
  expect(
    effectivePermissionCodes({
      ...base,
      grants: grants.filter((c) => c !== "orders.read_logistics"),
    }),
  ).toEqual(["files.view"]);
});
test("session/account/security flags deny owner as well; no client global-audit/admin capability", () => {
  const owner = { ...base, profile: "owner", ownerCurrent: true };
  expect(isCurrentOwner(owner)).toBe(true);
  expect(effectivePermissionCodes(owner)).toHaveLength(29);
  expect(isCurrentOwner({ ...owner, ownerCurrent: false })).toBe(false);
  expect(
    hasEffectivePermission({ ...owner, ownerCurrent: false }, "clinics.manage"),
  ).toBe(false);
  expect(hasEffectivePermission(owner, "audit.read")).toBe(false);
  for (const patch of [
    { sessionValid: false },
    { lifecycle: "suspended" },
    { lifecycle: "invited" },
    { securityLocked: true },
    { resetRequired: true },
  ])
    expect(effectivePermissionCodes({ ...owner, ...patch })).toEqual([]);
});
test("employee cannot gain employee-administration or exceptional-delivery authority by a grant", () => {
  for (const code of [
    "delivery.correct",
    "employees.create",
    "employees.suspend",
    "employees.manage_permissions",
  ]) {
    expect(validateGrantSet(chain(code), "employee")).toBe(false);
    expect(
      hasEffectivePermission(
        { ...base, profile: "employee", grants: chain(code) },
        code,
      ),
    ).toBe(false);
  }
  expect(validateGrantSet(["orders.read_logistics"], "employee")).toBe(true);
});
test("clinic intrinsic ownership is isolated and cannot acquire lab capabilities by forged grants", () => {
  const clinic = {
    ...base,
    profile: "clinic",
    clinicId: "fixture-clinic",
    clinicSuspended: false,
    grants: Object.keys(permissionPrerequisites),
  };
  expect(effectivePermissionCodes(clinic)).toEqual([]);
  expect(clinicOwnsResource(clinic, "fixture-clinic")).toBe(true);
  expect(clinicOwnsResource(clinic, "other")).toBe(false);
  expect(
    clinicOwnsResource({ ...clinic, clinicSuspended: true }, "fixture-clinic"),
  ).toBe(false);
  expect(
    clinicOwnsResource(
      { ...clinic, clinicSuspended: undefined },
      "fixture-clinic",
    ),
  ).toBe(false);
  expect(
    clinicOwnsResource({ ...clinic, sessionValid: false }, "fixture-clinic"),
  ).toBe(false);
});
