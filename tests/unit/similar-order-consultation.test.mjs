import { test, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
