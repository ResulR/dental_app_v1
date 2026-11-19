import { useEffect, useState } from "react";
import {
  EmailRecipientCategorySchema,
  EmailRecipientCommandSchema,
  EmailRecipientResultSchema,
  EmailRecipientsSchema,
} from "@dental-lab/contracts";
import { Button } from "../../shared/Button.js";

const names: Record<
  (typeof EmailRecipientCategorySchema.options)[number],
  string
> = {
  order_submitted: "Porosi e re",
  clinic_registered: "Regjistrim klinike",
  modification_requested: "Kërkesë ndryshimi",
  cancellation_requested: "Kërkesë anulimi",
  retouch_requested: "Kërkesë retushi",
  correction_resubmitted: "Korrigjim i ridërguar",
};
export function EmailRecipientsPanel({ accountId }: { accountId: string }) {
  const [selected, setSelected] = useState<ReturnType<
    typeof EmailRecipientsSchema.parse
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [status, setStatus] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          "/api/v1/notifications/email-recipients/" + accountId,
          {
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          },
        );
        if (response.status !== 200) throw new Error("READ_DENIED");
        const data = EmailRecipientsSchema.parse(await response.json());
        if (!controller.signal.aborted) setSelected(data);
      } catch {
        if (!controller.signal.aborted)
          setStatus("Destinatarët nuk u verifikuan.");
      }
    })();
    return () => controller.abort();
  }, [accountId, reload]);
  async function change(
    category: (typeof EmailRecipientCategorySchema.options)[number],
  ) {
    if (!selected || busy) return;
    const expected = selected.includes(category);
    const command = EmailRecipientCommandSchema.parse({
      category,
      expected_selected: expected,
      selected: !expected,
    });
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(
        "/api/v1/notifications/email-recipients/" + accountId,
        {
          method: "PUT",
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(command),
        },
      );
      if (![200, 403, 409].includes(response.status))
        throw new Error("WRITE_UNCERTAIN");
      const result = EmailRecipientResultSchema.parse(await response.json());
      if (
        response.status !==
        (result.kind === "applied" ? 200 : result.kind === "denied" ? 403 : 409)
      )
        throw new Error("WRITE_UNCERTAIN");
      if (result.kind !== "applied") throw new Error("WRITE_DENIED");
      setSelected(
        (previous) =>
          previous &&
          (command.selected
            ? [...previous, category]
            : previous.filter((value) => value !== category)),
      );
      setStatus("Përzgjedhja u ruajt. Dërgimi i e-mail-eve nuk niset këtu.");
    } catch {
      // A lost response may have committed. Never retry blindly.
      setSelected(null);
      setStatus(
        "Rezultati nuk është i sigurt. Rihapni llogarinë për të verifikuar gjendjen.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Marrësit e e-mail-eve">
      <h5>Marrësit e e-mail-eve</h5>
      <p>
        Vetëm pronari zgjedh administratorët për secilën kategori. Asnjë e-mail
        nuk dërgohet nga këtu.
      </p>
      {selected &&
        EmailRecipientCategorySchema.options.map((category) => (
          <label key={category} style={{ display: "block" }}>
            <input
              type="checkbox"
              checked={selected.includes(category)}
              disabled={busy}
              onChange={() => void change(category)}
            />
            {names[category]}
          </label>
        ))}
      {status && <p role="status">{status}</p>}
      {!selected && !status && <p>Po kontrollohen marrësit…</p>}
      <Button
        disabled={busy}
        onClick={() => {
          setSelected(null);
          setStatus("");
          setReload((value) => value + 1);
        }}
      >
        Rifresko marrësit
      </Button>
    </section>
  );
}
