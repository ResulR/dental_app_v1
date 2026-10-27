import { test, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DeliveryCalendar } from "../../apps/web/src/features/orders/DeliveryCalendar.tsx";
import {
  calendarPeriod,
  laboratoryToday,
  shiftCalendar,
} from "../../apps/web/src/features/orders/calendar-period.ts";
import { createOrderTrackingService } from "../../apps/api/dist/modules/orders/index.js";

const id = "91000000-0000-4000-8000-000000000001";
test("week starts Monday, month covers all days, including leap and year boundaries", () => {
  expect(calendarPeriod("week", "2026-10-21")).toMatchObject({
    from: "2026-10-19",
    to: "2026-10-25",
  });
  expect(calendarPeriod("month", "2026-10-21")).toMatchObject({
    from: "2026-09-28",
    to: "2026-11-01",
  });
  expect(calendarPeriod("month", "2028-02-08").days).toContain("2028-02-29");
  expect(shiftCalendar("month", "2026-12-21", 1)).toBe("2027-01-01");
  expect(shiftCalendar("week", "2026-12-28", 1)).toBe("2027-01-04");
  expect(laboratoryToday(new Date("2026-10-19T22:30:00Z"))).toBe("2026-10-20");
});

test("effective calendar search is scoped and asks SQL to prefer planned date", async () => {
  const calls = [];
  const db = {
    transaction: async (fn) =>
      fn({
        query: async (sql, args = []) => {
          calls.push([sql, args]);
          if (sql.startsWith("SELECT a.profile"))
            return {
              rows: [
                {
                  profile: "employee",
                  lifecycle: "active",
                  securityLocked: false,
                  resetRequired: false,
                  sessionValid: true,
                  ownerCurrent: true,
                  clinicId: null,
                  clinicSuspended: false,
                  grants: ["orders.read_logistics"],
                },
              ],
            };
          return { rows: [] };
        },
      }),
  };
  const result = await createOrderTrackingService(db).search(
    { accountId: id, sessionId: id },
    { date_kind: "effective", from: "2026-10-19", to: "2026-10-25" },
  );
  expect(result.page).toMatchObject({ can_read_details: false, items: [] });
  const [sql, args] = calls.find(([statement]) =>
    statement.startsWith("SELECT o.id,o.number"),
  );
  expect(args).toEqual([
    null,
    null,
    "",
    null,
    null,
    "effective",
    "2026-10-19",
    "2026-10-25",
    "active",
  ]);
  expect(
    sql.match(
      /COALESCE\(l\.planned_delivery_date,v\.requested_delivery_date\)/g,
    ),
  ).toHaveLength(2);
  expect(sql).not.toContain("patient_");
  expect(sql).toContain("ORDER BY o.id LIMIT 51");
});

test("calendar planning affordance is gated while read-only calendar remains available", () => {
  const render = (allowPlan) =>
    renderToStaticMarkup(
      createElement(DeliveryCalendar, { onOpen: () => {}, allowPlan }),
    );
  expect(render(false)).toContain("Kalendari i punëve");
  expect(render(false)).not.toContain("tërhiqni punën");
  expect(render(true)).toContain("tërhiqni punën");
  expect(render(true)).toContain("Ndrysho datën");
});
