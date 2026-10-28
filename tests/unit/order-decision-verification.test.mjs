import { test, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DecisionVerification } from "../../apps/web/src/features/orders/OrderReviewPanel.tsx";

test("laboratory can see a re-read rejection and its recorded reason", () => {
  const html = renderToStaticMarkup(
    createElement(DecisionVerification, {
      detail: {
        order: { number: "123", status: "rejected" },
        history: [
          {
            aggregate_revision: 2,
            next_status: "rejected",
            occurred_at: "2026-10-28T12:00:00.000Z",
            reason: "Synthetic reason",
          },
        ],
        next_before_revision: null,
      },
    }),
  );
  expect(html).toContain("Porosia nr. 123");
  expect(html).toContain("Synthetic reason");
  expect(html).toContain("r2");
  expect(html).not.toContain("patient");
});
