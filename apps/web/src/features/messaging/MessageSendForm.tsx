import { useEffect, useRef, useState } from "react";
import {
  MessageSubmissionSchema,
  type MessageSubmission,
  type MessageSubmissionResult,
} from "@dental-lab/contracts";
import { Button } from "../../shared/Button.js";
import { confirmsMessageReceipt } from "./message-receipt.js";
import {
  openLocalVault,
  readVault,
  createVault,
  unlockVault,
  prepareVault,
} from "../drafts/index.js";
import type { LaboratoryOrderVault } from "../drafts/index.js";
import {
  readMessageSendIntent,
  storeMessageSendIntent,
  settleMessageSendIntent,
  clearMessageSendIntent,
  type MessageSendIntent,
} from "../drafts/message-send-intent.js";
import {
  generalConversations,
  orderConversation,
  generalMessages,
  orderMessages,
  sendGeneralMessage,
  sendOrderMessage,
} from "./general-api.js";

export function MessageSendForm({
  accountId,
  conversationId,
  clinicId,
  orderId,
  canReply,
  closed,
  onSent,
}: {
  accountId: string;
  conversationId: string;
  clinicId: string;
  orderId?: string;
  canReply: boolean;
  closed: boolean;
  onSent: () => void;
}) {
  const kind = orderId ? "order" : "general";
  const [body, setBody] = useState("");
  const [phrase, setPhrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [createMode, setCreateMode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [savedCode, setSavedCode] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [intent, setIntent] = useState<MessageSendIntent | null>(null);
  const vault = useRef<LaboratoryOrderVault | null>(null);
  const prepared = useRef<Awaited<ReturnType<typeof prepareVault>> | null>(
    null,
  );
  const flight = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      flight.current?.abort();
      vault.current?.db.close();
      vault.current = null;
      prepared.current = null;
    };
  }, []);
  const matches = (value: MessageSendIntent) =>
    value.kind === kind && value.request.conversation_id === conversationId;

  async function unlock() {
    if (busy || flight.current) return;
    setBusy(true);
    let db: IDBDatabase | null = null;
    try {
      db = await openLocalVault();
      const envelope = await readVault(db, accountId);
      if (!envelope) throw new Error("VAULT_MISSING");
      const key = await unlockVault(envelope, accountId, phrase, "phrase");
      const next = { db, envelope, key };
      const saved = await readMessageSendIntent(next, accountId);
      if (!mounted.current) return;
      vault.current?.db.close();
      vault.current = next;
      db = null;
      setReady(true);
      setPhrase("");
      setIntent(saved);
      setBody(
        saved && matches(saved) && saved.state === "uncertain"
          ? (saved.request.body ?? "")
          : "",
      );
      setNotice(
        saved
          ? "U gjet një dërgim i ruajtur. Rimerreni vetëm me veprim të qartë."
          : "",
      );
    } catch (error) {
      if (mounted.current) {
        if (error instanceof Error && error.message === "VAULT_MISSING") {
          setCreateMode(true);
          setNotice("Krijoni kasafortën e këtij konti para dërgimit.");
        } else
          setNotice("Kasaforta nuk u hap. Kontrolloni frazën dhe llogarinë.");
      }
    } finally {
      db?.close();
      if (mounted.current) setBusy(false);
    }
  }
  async function create() {
    if (busy || phrase.length < 12 || phrase !== confirmation) return;
    setBusy(true);
    try {
      prepared.current = await prepareVault(accountId, phrase);
      if (!mounted.current) return;
      setRecoveryCode(prepared.current.recoveryCode);
      setSavedCode(false);
      setPhrase("");
      setConfirmation("");
    } catch {
      if (mounted.current) setNotice("Kasaforta nuk u përgatit.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function confirmCreation() {
    if (busy || !savedCode || !prepared.current) return;
    setBusy(true);
    let db: IDBDatabase | null = null;
    try {
      db = await openLocalVault();
      await createVault(db, prepared.current.envelope);
      const next = {
        db,
        envelope: prepared.current.envelope,
        key: prepared.current.active,
      };
      if (!mounted.current) return;
      vault.current?.db.close();
      vault.current = next;
      db = null;
      prepared.current = null;
      setRecoveryCode("");
      setCreateMode(false);
      setReady(true);
      setNotice("Kasaforta u krijua.");
    } catch {
      if (mounted.current) {
        prepared.current = null;
        setRecoveryCode("");
        setCreateMode(false);
        setNotice("Krijimi nuk u verifikua. Hapni kasafortën ekzistuese.");
      }
    } finally {
      db?.close();
      if (mounted.current) setBusy(false);
    }
  }
  async function currentConversation(signal: AbortSignal) {
    if (orderId) {
      const value = await orderConversation({ order_id: orderId }, signal);
      if (
        value.id !== conversationId ||
        value.order_id !== orderId ||
        value.clinic_id !== clinicId
      )
        throw new Error("MESSAGE_CONVERSATION_MISMATCH");
    } else {
      const page = await generalConversations({ clinic_id: clinicId }, signal);
      if (
        !page.items.some(
          (row) => row.id === conversationId && row.clinic_id === clinicId,
        )
      )
        throw new Error("MESSAGE_CONVERSATION_MISMATCH");
    }
  }
  async function verifyReceipt(
    request: MessageSubmission,
    receipt: Extract<MessageSubmissionResult, { kind: "sent" }>,
    signal: AbortSignal,
  ) {
    const page = await (orderId ? orderMessages : generalMessages)(
      {
        conversation_id: request.conversation_id,
        after_seq: receipt.sequence_number - 1,
      },
      signal,
    );
    if (
      !confirmsMessageReceipt(page, conversationId, request.body ?? "", receipt)
    )
      throw new Error("MESSAGE_RECEIPT_MISMATCH");
  }
  async function send() {
    if (
      !vault.current ||
      !ready ||
      !canReply ||
      !conversationId ||
      !clinicId ||
      flight.current ||
      (intent && (intent.state !== "uncertain" || !matches(intent)))
    )
      return;
    const controller = new AbortController();
    flight.current = controller;
    setBusy(true);
    setNotice("");
    try {
      const existing = await readMessageSendIntent(vault.current, accountId);
      if (
        existing &&
        (existing.state !== "uncertain" ||
          !intent ||
          !matches(existing) ||
          JSON.stringify(existing.request) !== JSON.stringify(intent.request))
      )
        throw new Error("MESSAGE_INTENT_CONFLICT");
      let request = existing?.request;
      if (!request) {
        if (closed || !body.trim()) return;
        request = MessageSubmissionSchema.parse({
          conversation_id: conversationId,
          idempotency_key: crypto.randomUUID(),
          body: body.trim(),
          file_ids: [],
        });
        const stored = await storeMessageSendIntent(
          vault.current,
          accountId,
          kind,
          request,
        );
        setIntent(stored);
      }
      if (controller.signal.aborted) return;
      await currentConversation(controller.signal);
      const result = await (orderId ? sendOrderMessage : sendGeneralMessage)(
        request,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (result.kind === "conversation_closed") {
        const saved = await settleMessageSendIntent(
          vault.current,
          accountId,
          kind,
          request,
          { kind: "conversation_closed", persisted: false },
        );
        if (!mounted.current) return;
        setIntent(saved);
        setNotice(
          "Biseda u mbyll dhe mesazhi nuk u dërgua. Hiqeni gjurmën e refuzuar para një mesazhi tjetër.",
        );
        return;
      }
      if (result.kind !== "sent") {
        setNotice(
          result.kind === "conflict"
            ? "Përgjigje kundërshtuese për këtë çelës. Mos krijoni dërgim tjetër; kërkoni ndihmë."
            : "Mesazhi nuk u konfirmua. Kontrolloni bisedën dhe provoni të njëjtën kërkesë.",
        );
        return;
      }
      await verifyReceipt(request, result, controller.signal);
      if (controller.signal.aborted) return;
      const saved = await settleMessageSendIntent(
        vault.current,
        accountId,
        kind,
        request,
        result,
      );
      if (!mounted.current) return;
      setIntent(saved);
      setBody("");
      setNotice(
        "Mesazhi u verifikua në bisedë. Reçeta është ruajtur në kasafortë.",
      );
      onSent();
    } catch {
      if (mounted.current)
        setNotice(
          "Rezultati nuk u verifikua. Rimerrni të njëjtin mesazh; nuk dërgohet automatikisht.",
        );
    } finally {
      if (flight.current === controller) {
        flight.current = null;
        if (mounted.current) setBusy(false);
      }
    }
  }
  async function clear() {
    if (!vault.current || intent?.state !== "settled" || busy) return;
    setBusy(true);
    try {
      await clearMessageSendIntent(vault.current, accountId);
      setIntent(null);
      setBody("");
      setNotice("Gjurma e konfirmuar u hoq. Mund të shkruani mesazh të ri.");
    } catch {
      setNotice("Gjurma nuk u hoq.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div aria-label="Dërgim i sigurt i mesazhit">
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
            Mesazh i ruajtur për bisedën {intent.request.conversation_id}.{" "}
            {intent.kind === "order" ? "Porosi" : "Bisedë e përgjithshme"}.
          </p>
          {!matches(intent) && (
            <p>
              Hapni bisedën e treguar me llogarinë e autorizuar. Dërgimi i ri
              është i bllokuar.
            </p>
          )}
          {matches(intent) && intent.state === "settled" && (
            <>
              <p>
                {intent.reply?.kind === "sent"
                  ? "Reçeta e konfirmuar: " + intent.reply.message_id
                  : "Mesazhi u refuzua: biseda e mbyllur."}
              </p>
              <Button disabled={busy} onClick={() => void clear()}>
                Hiq gjurmën e konfirmuar
              </Button>
            </>
          )}
        </div>
      )}
      {ready &&
        canReply &&
        !closed &&
        (!intent || (intent.state === "uncertain" && matches(intent))) && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <label>
              Mesazh tekstual
              <textarea
                value={body}
                maxLength={100000}
                disabled={busy || !!intent}
                onChange={(event) => setBody(event.target.value)}
              />
            </label>
            <Button type="submit" disabled={busy || (!intent && !body.trim())}>
              {intent
                ? "Rimerr rezultatin e të njëjtit mesazh"
                : "Dërgo mesazhin"}
            </Button>
          </form>
        )}
      {ready &&
        canReply &&
        closed &&
        intent?.state === "uncertain" &&
        matches(intent) && (
          <Button disabled={busy} onClick={() => void send()}>
            Rimerr mesazhin para mbylljes
          </Button>
        )}
      {notice && <p role="status">{notice}</p>}
      <p>Skedarët nuk janë të disponueshëm në këtë bisedë.</p>
    </div>
  );
}
