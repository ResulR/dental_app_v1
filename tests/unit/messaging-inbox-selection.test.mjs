import { expect, test } from "vitest";
import { refreshSelectedGeneral } from "../../apps/web/src/features/messaging/inbox-selection.ts";

const id = "91000000-0000-4000-8000-000000000001";
const clinic = "91000000-0000-4000-8000-000000000002";
const selected = {
  conversation_id: id,
  clinic_id: clinic,
  kind: "general",
  unread_count: 1,
  activity_at: "2026-11-18T10:00:00.000Z",
  closed: false,
};
test("older selected conversation gets its current unread count", () => {
  const fresh = refreshSelectedGeneral(selected, {
    items: [{ id, clinic_id: clinic, unread_count: 4 }],
  });
  expect(fresh).toMatchObject({ conversation_id: id, unread_count: 4 });
  expect(selected.unread_count).toBe(1);
});
test("missing or foreign scoped conversation is not retained", () => {
  expect(refreshSelectedGeneral(selected, { items: [] })).toBeNull();
  expect(
    refreshSelectedGeneral(selected, {
      items: [{ id, clinic_id: id, unread_count: 2 }],
    }),
  ).toBeNull();
});
