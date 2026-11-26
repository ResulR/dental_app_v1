import { useEffect, useRef, useState } from "react";
import type {
  LaboratoryClinicListSchema,
  LaboratoryClinicOrder,
} from "@dental-lab/contracts";
import {
  openLocalVault,
  readVault,
  createVault,
  unlockVault,
  prepareVault,
  readLaboratoryOrderIntent,
  clearLaboratoryOrderIntent,
} from "../drafts/index.js";
import type { LaboratoryOrderVault } from "../drafts/index.js";
import { Button } from "../../shared/Button.js";
import { LaboratoryLinkedWorkForm } from "./LaboratoryLinkedWorkForm.js";
import { createLaboratoryClinicClient } from "./laboratory-clinic-api.js";
const api = createLaboratoryClinicClient();
export function LaboratoryClinicOrderPanel({
  accountId,
}: {
  accountId: string;
}) {
  const [page, setPage] = useState<ReturnType<
    typeof LaboratoryClinicListSchema.parse
  > | null>(null);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef<AbortController | null>(null);
  const vault = useRef<LaboratoryOrderVault | null>(null);
  const unlocking = useRef(false);
  const [phrase, setPhrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [createMode, setCreateMode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [savedCode, setSavedCode] = useState(false);
  const prepared = useRef<Awaited<ReturnType<typeof prepareVault>> | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [recovered, setRecovered] = useState<LaboratoryClinicOrder | null>(
    null,
  );
  const [settled, setSettled] = useState<string | null>(null);
  async function inspect(context: LaboratoryOrderVault) {
    const saved = await readLaboratoryOrderIntent(context, accountId);
    setRecovered(saved?.request ?? null);
    setSettled(
      saved?.reply?.kind === "submitted"
        ? saved.reply.number
        : (saved?.reply?.kind ?? null),
    );
    setReady(true);
    setMessage(
      saved?.request
        ? "Kërkesa e ruajtur u gjet. Zgjidhni klinikën dhe rimerrni rezultatin vetëm me veprim të qartë."
        : "",
    );
  }
  async function unlock() {
    if (unlocking.current) return;
    unlocking.current = true;
    setBusy(true);
    let db: IDBDatabase | null = null;
    try {
      db = await openLocalVault();
      const envelope = await readVault(db, accountId);
      if (!envelope) throw new Error("VAULT_MISSING");
      const key = await unlockVault(envelope, accountId, phrase, "phrase");
      const context = { db, envelope, key };
      await inspect(context);
      vault.current?.db.close();
      vault.current = context;
      db = null;
      setPhrase("");
    } catch (error) {
      if (error instanceof Error && error.message === "VAULT_MISSING") {
        setCreateMode(true);
        setMessage("Krijoni kasafortën e këtij konti para dërgimit.");
      } else
        setMessage("Kasaforta nuk u hap. Kontrolloni frazën dhe llogarinë.");
    } finally {
      db?.close();
      unlocking.current = false;
      setBusy(false);
    }
  }
  async function create() {
    if (unlocking.current || phrase.length < 12 || phrase !== confirmation)
      return;
    unlocking.current = true;
    setBusy(true);
    try {
      prepared.current = await prepareVault(accountId, phrase);
      setRecoveryCode(prepared.current.recoveryCode);
      setSavedCode(false);
      setPhrase("");
      setConfirmation("");
    } catch {
      setMessage("Kasaforta nuk u përgatit.");
    } finally {
      unlocking.current = false;
      setBusy(false);
    }
  }
  async function confirmCreation() {
    if (unlocking.current || !savedCode || !prepared.current) return;
    unlocking.current = true;
    setBusy(true);
    let db: IDBDatabase | null = null;
    try {
      db = await openLocalVault();
      await createVault(db, prepared.current.envelope);
      const context = {
        db,
        envelope: prepared.current.envelope,
        key: prepared.current.active,
      };
      await inspect(context);
      vault.current?.db.close();
      vault.current = context;
      db = null;
      prepared.current = null;
      setRecoveryCode("");
      setCreateMode(false);
      setMessage("Kasaforta u krijua.");
    } catch {
      setMessage("Krijimi nuk u verifikua. Hapni kasafortën ekzistuese.");
    } finally {
      db?.close();
      unlocking.current = false;
      setBusy(false);
    }
  }
  async function clearSettled() {
    if (!vault.current || !settled || busy) return;
    setBusy(true);
    try {
      await clearLaboratoryOrderIntent(vault.current, accountId);
      setSettled(null);
      setMessage("Gjurma u hoq. Mund të përgatitni një porosi të re.");
    } catch {
      setMessage("Gjurma nuk u hoq.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
      vault.current?.db.close();
      vault.current = null;
      prepared.current = null;
    },
    [],
  );
  async function load(after?: string) {
    if (pending.current || sending) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setSelected(null);
    setPage(null);
    setMessage("");
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const next = await api.clinics(after, controller.signal);
      if (!controller.signal.aborted) setPage(next);
    } catch {
      if (pending.current === controller)
        setMessage("Klinikat nuk u verifikuan. Kontrolloni lidhjen dhe lejet.");
    } finally {
      clearTimeout(timer);
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <section aria-label="Porosi e re nga laboratori">
      <h3>Porosi për klinikën</h3>
      <p>
        Përzgjidhni një klinikë aktive. Porosia regjistrohet e pranuar me
        autorin laboratorik; klinika njoftohet brenda portalit.
      </p>
      {!ready && (
        <div>
          {!recoveryCode && (
            <>
              <label>
                Fraza e kasafortës
                <input
                  type="password"
                  autoComplete="off"
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                />
              </label>
              {createMode && (
                <label>
                  Konfirmoni frazën
                  <input
                    type="password"
                    autoComplete="off"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                  />
                </label>
              )}
              <Button
                disabled={busy || !phrase}
                onClick={() => void (createMode ? create() : unlock())}
              >
                {createMode ? "Përgatit kasafortën" : "Hap kasafortën"}
              </Button>
            </>
          )}
          {recoveryCode && (
            <>
              <p>Ruajeni kodin e rikuperimit jashtë pajisjes.</p>
              <output>{recoveryCode}</output>
              <label>
                <input
                  type="checkbox"
                  checked={savedCode}
                  onChange={(e) => setSavedCode(e.target.checked)}
                />{" "}
                E ruajta kodin
              </label>
              <Button
                disabled={busy || !savedCode}
                onClick={() => void confirmCreation()}
              >
                Krijo kasafortën
              </Button>
            </>
          )}
        </div>
      )}
      {ready && recovered && (
        <p role="status">
          Kërkesë e ruajtur për klinikën {recovered.clinic_id}. Hapni listën dhe
          përzgjidhni këtë klinikë.
        </p>
      )}
      {ready && settled && (
        <div>
          <p role="status">Rezultati i ruajtur: {settled}</p>
          <Button disabled={busy} onClick={() => void clearSettled()}>
            Hiq gjurmën e përfunduar
          </Button>
        </div>
      )}
      <Button
        disabled={!ready || !!settled || busy || sending}
        onClick={() => void load()}
      >
        Ngarko klinikat e autorizuara
      </Button>
      {page && (
        <>
          <ul>
            {page.items.map((clinic) => (
              <li key={clinic.id}>
                <Button
                  disabled={
                    busy ||
                    sending ||
                    !!settled ||
                    (!!recovered && recovered.clinic_id !== clinic.id)
                  }
                  onClick={() => setSelected(clinic)}
                >
                  {clinic.name}
                </Button>
              </li>
            ))}
          </ul>
          {page.next_after && (
            <Button
              disabled={busy || sending}
              onClick={() => void load(page.next_after ?? undefined)}
            >
              Faqja tjetër
            </Button>
          )}
        </>
      )}
      {selected && (
        <LaboratoryLinkedWorkForm
          key={selected.id}
          clinic={selected}
          accountId={accountId}
          vault={vault.current!}
          recovered={recovered?.clinic_id === selected.id ? recovered : null}
          onSettled={(value) => {
            setRecovered(null);
            setSelected(null);
            setSettled(value);
          }}
          onSendingChange={setSending}
          onFinished={(text) => {
            setSelected(null);
            setPage(null);
            setMessage(text);
          }}
        />
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
