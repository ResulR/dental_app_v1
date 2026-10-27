import { test, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SubmittedOrderReceipt } from "../../apps/web/src/features/orders/ClinicOrderForm.tsx";
import { OrderTrackingPanel } from "../../apps/web/src/features/orders/OrderTrackingPanel.tsx";

test("a similarity number prefills the clinic's own tracking search without patient data", () => {
  const html = renderToStaticMarkup(
    createElement(OrderTrackingPanel, {
      clinic: true,
      permissions: ["orders.read_logistics"],
      initialSearchNumber: "123",
    }),
  );
  expect(html).toContain('id="order-tracking"');
  expect(html).toMatch(/value="123"/);
  expect(html).not.toContain("patient_reference");
});

test("a confirmed clinical submission exposes its server number and tracking link", () => {
  const html = renderToStaticMarkup(
    createElement(SubmittedOrderReceipt, {
      number: "9007199254740993",
      receivedAt: "2026-10-28T10:00:00.000Z",
    }),
  );
  expect(html).toContain("9007199254740993");
  expect(html).toContain('href="#order-tracking"');
  expect(html).toContain("Në pritje");
  expect(html).not.toContain("patient_reference");
});
