import { useEffect, useRef, useState } from "react";
import type {
  OrderLifecycleContextSchema,
  DeliveryBatchCommand,
} from "@dental-lab/contracts";
import { createOrderLifecycleClient } from "./lifecycle-api.js";
import { createDeliveryBatchClient } from "./delivery-batch-api.js";
import {
  openLocalVault,
  readVault,
  createVault,
  unlockVault,
  prepareVault,
} from "../drafts/index.js";
import type { LaboratoryOrderVault } from "../drafts/index.js";
import {
  readBatchIntent,
  storeBatchIntent,
  settleBatchIntent,
  clearBatchIntent,
  matchesBatchReceipt,
  matchesStoredBatchReceipt,
  type BatchIntent,
} from "../drafts/delivery-batch-intent.js";
import { Button } from "../../shared/Button.js";

const contextClient = createOrderLifecycleClient();
const batchClient = createDeliveryBatchClient();
const explanations = {
  catalog_missing: "Referencat e katalogut kërkojnë verifikim.",
  catalog_forbidden: "Një referencë e katalogut është e ndaluar.",
  security_block: "Një porosi ka bllokim sigurie.",
  files_not_ready: "Skedarët e një porosie nuk janë verifikuar.",
  pending_request: "Një porosi ka kërkesë në pritje.",
};
type Context = ReturnType<typeof OrderLifecycleContextSchema.parse>;

export function ReadyDeliveryBatch({
  rows,
  onFinished,
  accountId,
}: {
  rows: { id: string; number: string; status: string }[];
  onFinished: (message: string) => void;
  accountId: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [prepared, setPrepared] = useState<Context[] | null>(null);
  const [mode, setMode] = useState<
    DeliveryBatchCommand["items"][number]["mode"]
  >("laboratory_delivery");
  const [confirmed, setConfirmed] = useState(false);
  const [intent, setIntent] = useState<BatchIntent | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [phrase, setPhrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [createMode, setCreateMode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [savedCode, setSavedCode] = useState(false);
  const [ready, setReady] = useState(false);
  const vault = useRef<LaboratoryOrderVault | null>(null);
  const preparedVault = useRef<Awaited<ReturnType<typeof prepareVault>> | null>(
    null,
  );
  const pending = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      pending.current?.abort();
      vault.current?.db.close();
      vault.current = null;
      preparedVault.current = null;
    },
    [],
  );

  async function unlock() {
    if (busy || pending.current) return;
    setBusy(true);
    let db: IDBDatabase | null = null;
    try {
      db = await openLocalVault();
      const envelope = await readVault(db, accountId);
      if (!envelope) throw new Error("VAULT_MISSING");
      const key = await unlockVault(envelope, accountId, phrase, "phrase");
      const next = { db, envelope, key };
      const saved = await readBatchIntent(next, accountId);
      vault.current?.db.close();
      vault.current = next;
      db = null;
      setIntent(saved);
      setReady(true);
      setPhrase("");
      setMessage(
        saved
          ? "U gjet loti i ruajtur. Kontrolloni faturën me veprim të qartë."
          : "",
      );
    } catch (error) {
      if (error instanceof Error && error.message === "VAULT_MISSING") {
        setCreateMode(true);
        setMessage("Krijoni kasafortën e këtij konti para dorëzimit.");
      } else
        setMessage("Kasaforta nuk u hap. Kontrolloni frazën dhe llogarinë.");
    } finally {
      db?.close();
      setBusy(false);
    }
  }
  async function create() {
    if (busy || phrase.length < 12 || phrase !== confirmation) return;
    setBusy(true);
    try {
      preparedVault.current = await prepareVault(accountId, phrase);
      setRecoveryCode(preparedVault.current.recoveryCode);
      setSavedCode(false);
      setPhrase("");
      setConfirmation("");
    } catch {
      setMessage("Kasaforta nuk u përgatit.");
    } finally {
      setBusy(false);
    }
  }
  async function confirmCreation() {
    if (busy || !savedCode || !preparedVault.current) return;
    setBusy(true);
    let db: IDBDatabase | null = null;
    try {
      db = await openLocalVault();
      await createVault(db, preparedVault.current.envelope);
      const next = {
        db,
        envelope: preparedVault.current.envelope,
        key: preparedVault.current.active,
      };
      vault.current?.db.close();
      vault.current = next;
      db = null;
      preparedVault.current = null;
      setRecoveryCode("");
      setReady(true);
      setCreateMode(false);
      setMessage("Kasaforta u krijua.");
    } catch {
      setMessage("Krijimi nuk u verifikua. Hapni kasafortën ekzistuese.");
    } finally {
      db?.close();
      setBusy(false);
    }
  }
  function change(id: string, checked: boolean) {
    if (intent) return;
    setSelected((ids) =>
      checked ? [...ids, id] : ids.filter((value) => value !== id),
    );
    setPrepared(null);
    setConfirmed(false);
  }
  async function run(work: (signal: AbortSignal) => Promise<void>) {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setMessage("");
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      await work(controller.signal);
    } catch {
      if (pending.current === controller)
        setMessage(
          "Rezultati nuk u verifikua. Hapni kasafortën dhe kontrolloni faturën; mos krijoni lot të ri.",
        );
    } finally {
      clearTimeout(timer);
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  async function prepare() {
    if (!ready || intent || selected.length < 2 || selected.length > 10) return;
    await run(async (signal) => {
      const contexts: Context[] = [];
      for (const id of selected) {
        const context = await contextClient.context(id, signal);
        if (context.status !== "completed" || context.order_id !== id) {
          setPrepared(null);
          setMessage("Një porosi nuk është më gati. Ringarkoni listën.");
          return;
        }
        contexts.push(context);
      }
      if (!signal.aborted) {
        setPrepared(contexts);
        setConfirmed(false);
      }
    });
  }
  function describe(kind: string, reason?: keyof typeof explanations) {
    if (kind === "conflict")
      return "Një porosi ndryshoi. Asnjë dorëzim në këtë lot; ringarkoni listën.";
    if (kind === "blocked")
      return (
        (reason ? explanations[reason] : "Një porosi u bllokua.") +
        " Asnjë dorëzim në këtë lot."
      );
    if (kind === "receipt_mismatch")
      return "Identifikuesi i faturës i përket një përmbajtjeje tjetër. Lotin e ruajtur nuk mund ta ndryshoni.";
    return "Fatura nuk u gjet. Mund të provoni sërish vetëm të njëjtin lot të ruajtur.";
  }
  async function verifyResult(
    command: DeliveryBatchCommand,
    response: Awaited<ReturnType<typeof batchClient.deliver>>,
  ) {
    if (response.kind === "delivered") {
      if (!matchesBatchReceipt(command, response)) {
        setMessage("Fatura nuk përputhet me lotin e ruajtur. Nuk u pranua.");
        return;
      }
      const current = await readBatchIntent(vault.current!, accountId);
      if (
        !current ||
        JSON.stringify(current.command) !== JSON.stringify(command)
      )
        throw new Error("BATCH_INTENT_CONFLICT");
      if (
        current.state === "settled" &&
        (!current.reply || !matchesStoredBatchReceipt(current.reply, response))
      ) {
        setMessage(
          "Fatura e serverit bie ndesh me faturën e ruajtur. Kontaktoni administratorin.",
        );
        return;
      }
      const saved =
        current.state === "settled"
          ? current
          : await settleBatchIntent(
              vault.current!,
              accountId,
              command,
              response,
            );
      setIntent(saved);
      setMissing(false);
      setPrepared(null);
      onFinished(
        "Dorëzimi u verifikua: " +
          response.items.length +
          " porosi. Fatura: " +
          response.receipt_id,
      );
    } else {
      setMessage(
        describe(
          response.kind,
          response.kind === "blocked" ? response.reason : undefined,
        ),
      );
    }
  }
  async function deliver() {
    if (!vault.current || !prepared || !confirmed || intent || pending.current)
      return;
    const command: DeliveryBatchCommand = {
      receipt_id: crypto.randomUUID(),
      confirmed: true,
      items: prepared.map((row) => ({
        order_id: row.order_id,
        expected_version_id: row.version_id,
        expected_revision: row.revision,
        mode,
      })),
    };
    await run(async (signal) => {
      const saved = await storeBatchIntent(vault.current!, accountId, command);
      setIntent(saved);
      // Persistence must complete before the first network request.
      if (signal.aborted) return;
      await verifyResult(command, await batchClient.deliver(command, signal));
    });
  }
  async function lookup() {
    if (!vault.current || !intent || pending.current) return;
    await run(async (signal) => {
      const current = await readBatchIntent(vault.current!, accountId);
      if (!current || current.command.receipt_id !== intent.command.receipt_id)
        throw new Error("BATCH_INTENT_CONFLICT");
      const response = await batchClient.receipt(
        current.command.receipt_id,
        signal,
      );
      if (response.kind === "receipt_missing") {
        setMissing(current.state === "uncertain");
        setMessage(
          current.state === "settled"
            ? "Fatura e ruajtur dhe serveri nuk përputhen. Kontaktoni administratorin."
            : describe(response.kind),
        );
      } else await verifyResult(current.command, response);
    });
  }
  async function replay() {
    if (
      !vault.current ||
      !intent ||
      intent.state !== "uncertain" ||
      !missing ||
      pending.current
    )
      return;
    await run(async (signal) => {
      const current = await readBatchIntent(vault.current!, accountId);
      if (
        !current ||
        current.state !== "uncertain" ||
        JSON.stringify(current.command) !== JSON.stringify(intent.command)
      )
        throw new Error("BATCH_INTENT_CONFLICT");
      setMissing(false);
      await verifyResult(
        current.command,
        await batchClient.deliver(current.command, signal),
      );
    });
  }
  async function clear() {
    if (!vault.current || intent?.state !== "settled" || busy) return;
    setBusy(true);
    try {
      await clearBatchIntent(vault.current, accountId);
      setIntent(null);
      setSelected([]);
      setPrepared(null);
      setConfirmed(false);
      setMessage("Gjurma e përfunduar u hoq.");
    } catch {
      setMessage("Gjurma nuk u hoq.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Dorëzim në grup">
      <h4>Dorëzim në grup</h4>
      <p>
        Zgjidhni 2 deri në 10 porosi të gatshme. Lotin e konfirmuar e ruajmë të
        koduar për rikuperim.
      </p>
      {!ready && (
        <div>
          {!recoveryCode ? (
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
          ) : (
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
      {ready && intent && (
        <div role="status">
          <p>
            Loti i ruajtur: {intent.command.items.length} porosi. Fatura:{" "}
            {intent.command.receipt_id}.
          </p>
          <p>
            Porositë:{" "}
            {intent.command.items.map((row) => row.order_id).join(", ")}
          </p>
          {intent.state === "settled" && (
            <p>Fatura u konfirmua më {intent.reply?.delivered_at}.</p>
          )}
          <Button disabled={busy} onClick={() => void lookup()}>
            Kontrollo faturën e lotit
          </Button>
          {intent.state === "uncertain" && missing && (
            <Button disabled={busy} onClick={() => void replay()}>
              Riprovo të njëjtin lot
            </Button>
          )}
          {intent.state === "settled" && (
            <Button disabled={busy} onClick={() => void clear()}>
              Hiq gjurmën e përfunduar
            </Button>
          )}
        </div>
      )}
      {ready && !intent && (
        <>
          <p>{selected.length} porosi të zgjedhura nga kjo faqe.</p>
          {rows
            .filter((row) => row.status === "completed")
            .map((row) => (
              <label key={row.id}>
                <input
                  type="checkbox"
                  disabled={
                    busy ||
                    (!selected.includes(row.id) && selected.length >= 10)
                  }
                  checked={selected.includes(row.id)}
                  onChange={(e) => change(row.id, e.target.checked)}
                />
                Nr. {row.number}
              </label>
            ))}
          <Button
            disabled={busy || selected.length < 2}
            onClick={() => void prepare()}
          >
            Verifiko përzgjedhjen
          </Button>
          {prepared && (
            <fieldset disabled={busy}>
              <legend>Konfirmim i daljes fizike</legend>
              <p>
                {prepared
                  .map(
                    (row) => "Nr. " + row.number + " (r" + row.revision + ")",
                  )
                  .join(", ")}
              </p>
              <label>
                Mënyra e dorëzimit për të gjithë lotin
                <select
                  value={mode}
                  onChange={(e) => {
                    setMode(e.target.value as typeof mode);
                    setConfirmed(false);
                  }}
                >
                  <option value="laboratory_delivery">
                    Dorëzim nga laboratori
                  </option>
                  <option value="clinic_pickup">Tërheqje nga klinika</option>
                  <option value="external_courier">Korrier i jashtëm</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Konfirmoj daljen fizike të të gjitha porosive. Nuk dërgohet
                e-mail.
              </label>
              <Button disabled={!confirmed} onClick={() => void deliver()}>
                Dorëzo të gjithë lotin
              </Button>
            </fieldset>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
