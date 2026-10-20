import { test, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OrderTrackingPanel } from "../../apps/web/src/features/orders/OrderTrackingPanel.tsx";

test("ready-to-deliver shortcut is offered only to authorized laboratory users", () => {
  const render = (clinic, permissions) =>
    renderToStaticMarkup(
      createElement(OrderTrackingPanel, { clinic, permissions }),
    );
  expect(render(false, ["delivery.mark_delivered"])).toContain(
    "Punët gati për dorëzim",
  );
  expect(render(false, ["orders.read_logistics"])).not.toContain(
    "Punët gati për dorëzim",
  );
  expect(render(true, ["delivery.mark_delivered"])).not.toContain(
    "Punët gati për dorëzim",
  );
});
