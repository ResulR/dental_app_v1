import { expect, test } from "vitest";
import {
  refreshSelectedGeneral,
  refreshSelectedOrder,
} from "../../apps/web/src/features/messaging/inbox-selection.ts";

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
    items: [
      {
        id,
        clinic_id: clinic,
        clinic_name: "Klinika aktuale",
        unread_count: 4,
      },
    ],
  });
  expect(fresh).toMatchObject({
    conversation_id: id,
    clinic_name: "Klinika aktuale",
    unread_count: 4,
  });
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

const order = "91000000-0000-4000-8000-000000000003";
test("an older order conversation retains only its matching authorized identity", () => {
  const item = {
    ...selected,
    kind: "order",
    order_id: order,
    order_number: "123",
  };
  const current = {
    id,
    clinic_id: clinic,
    order_id: order,
    unread_count: 5,
    last_message_seq: 7,
    closed: true,
  };
  expect(refreshSelectedOrder(item, current)).toMatchObject({
    conversation_id: id,
    clinic_id: clinic,
    order_id: order,
    unread_count: 5,
    closed: true,
  });
  for (const field of ["id", "clinic_id", "order_id"]) {
    expect(
      refreshSelectedOrder(item, {
        ...current,
        [field]: "91000000-0000-4000-8000-000000000004",
      }),
    ).toBeNull();
  }
  expect(refreshSelectedOrder(selected, current)).toBeNull();
});
