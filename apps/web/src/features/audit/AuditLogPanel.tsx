import { useEffect, useRef, useState } from "react";
import type { AuditLogPageSchema } from "@dental-lab/contracts";
import { createAuditClient } from "./audit-api.js";
import { Button } from "../../shared/Button.js";
const read = createAuditClient();
type Page = ReturnType<typeof AuditLogPageSchema.parse>;
export function AuditLogPanel() {
  const [action, setAction] = useState(""),
    [objectType, setObjectType] = useState(""),
    [page, setPage] = useState<Page | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      pending.current?.abort();
    },
    [],
  );
  async function load(before?: NonNullable<Page["next_before"]>) {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setMessage("");
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const next = await read(
        {
          ...(action.trim() ? { action: action.trim() } : {}),
          ...(objectType ? { object_type: objectType } : {}),
          ...(before ? { before } : {}),
        },
        controller.signal,
      );
      if (!controller.signal.aborted) setPage(next);
    } catch {
      if (pending.current === controller) {
        setPage(null);
        setMessage(
          "Regjistri nuk u verifikua. Kontrolloni lejet dhe provoni sërish.",
        );
      }
    } finally {
      clearTimeout(timer);
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <section aria-label="Regjistri global i auditimit">
      <h3>Regjistri global i auditimit</h3>
      <p>
        Vetëm pronari aktual. Regjistri shfaq veprimin, kohën, autorin dhe
        objektin; nuk ndryshon të dhënat.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Veprimi (kod)
            <input
              value={action}
              maxLength={80}
              autoComplete="off"
              onChange={(e) => setAction(e.target.value.toUpperCase())}
            />
          </label>
          <label>
            Lloji i objektit
            <select
              value={objectType}
              onChange={(e) => setObjectType(e.target.value)}
            >
              <option value="">Të gjitha</option>
              {[
                "order",
                "clinic",
                "account",
                "catalog_reference",
                "conversation",
                "message",
                "file",
                "draft",
                "settings",
                "process",
              ].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit">Kërko në regjistër</Button>
        </fieldset>
      </form>
      {page && (
        <ol>
          {page.items.map((row) => (
            <li key={row.id}>
              <p>
                {row.occurred_at} · {row.action} · {row.object_type}{" "}
                {row.object_id}
              </p>
              <p>
                Autori: {row.actor_id ?? row.process_code ?? "—"} · Referenca:{" "}
                {row.request_id} · Rishikimi: {row.aggregate_revision ?? "—"}
              </p>
              {row.reason_code && <p>Arsyeja: {row.reason_code}</p>}
              {row.changed_fields.length > 0 && (
                <p>Fushat: {row.changed_fields.join(", ")}</p>
              )}
            </li>
          ))}
        </ol>
      )}
      {page?.items.length === 0 && <p>Nuk u gjet asnjë ngjarje.</p>}
      {page?.next_before && (
        <Button
          disabled={busy}
          onClick={() => void load(page.next_before ?? undefined)}
        >
          Ngjarje më të vjetra
        </Button>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
