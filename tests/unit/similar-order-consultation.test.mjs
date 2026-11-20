import { test, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ClinicOrderForm,
  SubmittedOrderReceipt,
} from "../../apps/web/src/features/orders/ClinicOrderForm.tsx";
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

test("laboratory production views require their respective action permissions", () => {
  const accepted = renderToStaticMarkup(
    createElement(OrderTrackingPanel, {
      clinic: false,
      permissions: ["orders.read_logistics", "orders.start_manufacturing"],
    }),
  );
  expect(accepted).toContain("Punët e pranuara për fillim");
  expect(accepted).not.toContain("Punët në prodhim");
  const manufacturing = renderToStaticMarkup(
    createElement(OrderTrackingPanel, {
      clinic: false,
      permissions: ["orders.read_logistics", "orders.change_status"],
    }),
  );
  expect(manufacturing).toContain("Punët në prodhim");
  expect(manufacturing).not.toContain("Punët e pranuara për fillim");
  const clinic = renderToStaticMarkup(
    createElement(OrderTrackingPanel, {
      clinic: true,
      permissions: ["orders.start_manufacturing", "orders.change_status"],
    }),
  );
  expect(clinic).not.toContain("Punët në prodhim");
});

test("offline rendering disables preflight and offers no submission action", () => {
  vi.stubGlobal("navigator", { onLine: false });
  try {
    const html = renderToStaticMarkup(
      createElement(ClinicOrderForm, {
        accountId: "90000000-0000-4000-8000-000000000001",
      }),
    );
    expect(html).toContain("Jashtë linje");
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*>Kontrollo të dhënat<\/button>/,
    );
    expect(html).not.toContain("Konfirmo dhe dërgo porosinë");
  } finally {
    vi.unstubAllGlobals();
  }
});

test("duplication prefills editable fields but never old files", () => {
  vi.stubGlobal("navigator", { onLine: true });
  try {
    const source = {
      order_id: "91000000-0000-4000-8000-000000000001",
      number: "29",
      status: "rejected",
      revision: 3,
      current_version_id: "91000000-0000-4000-8000-000000000002",
      input: {
        patient: { internal_reference: "Synthetic-ref" },
        requested_delivery_date: "2026-12-04",
        material_id: "91000000-0000-4000-8000-000000000003",
        shade_id: "91000000-0000-4000-8000-000000000004",
        description: "Synthetic description",
        teeth: [{ fdi: 11, selection: "normal" }],
        file_ids: ["91000000-0000-4000-8000-000000000005"],
      },
    };
    const html = renderToStaticMarkup(
      createElement(ClinicOrderForm, {
        accountId: "91000000-0000-4000-8000-000000000006",
        duplicateSource: source,
      }),
    );
    expect(html).toContain("Porosi e re nga Nr. 29");
    expect(html).toContain('value="Synthetic-ref"');
    expect(html).toContain('value="2026-12-04"');
    expect(html).toContain("Synthetic description");
    expect(html).toContain("skedarët e vjetër nuk kopjohen");
    expect(html).not.toContain(source.input.file_ids[0]);
  } finally {
    vi.unstubAllGlobals();
  }
});
