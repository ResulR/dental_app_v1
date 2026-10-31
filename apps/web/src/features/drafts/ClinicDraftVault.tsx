import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Button } from "../../shared/Button.js";
import {
  prepareVault,
  unlockVault,
  recoverPhrase,
  type VaultEnvelope,
} from "./vault-crypto.js";
import {
  openLocalVault,
  readVault,
  createVault,
  replaceVault,
  readLocalDraft,
  saveLocalDraft,
  deleteLocalDraft,
  type RemoteDraft,
} from "./local-vault.js";
import {
  commitServerDraft,
  listServerDrafts,
  readServerDraft,
  type ServerDraft,
  type ServerDraftPayload,
} from "./draft-sync-api.js";

import {
  readSubmissionIntent,
  stageSubmissionIntent,
  markSubmissionAttempt,
  recordSubmissionReply,
  clearSettledSubmission,
  type StoredSubmission,
  type SubmissionRequest,
} from "./submission-intent.js";

export type SubmissionStorePort = {
  stage: (request: SubmissionRequest) => Promise<void>;
  markAttempt: (request: SubmissionRequest) => Promise<void>;
  record: (request: SubmissionRequest, reply: unknown) => Promise<void>;
};
type Pending = Awaited<ReturnType<typeof prepareVault>>;
export function ClinicDraftVault<T>({
  accountId,
  capture,
  restore,
  disabled,
  confirmed,
  toServer,
  fromServer,
  submissionStoreRef,
  onSubmissionRecovered,
}: {
  accountId: string;
  capture: () => T;
  restore: (value: T) => boolean;
  disabled: boolean;
  confirmed: boolean;
  toServer: (value: T) => ServerDraftPayload | null;
  fromServer: (value: ServerDraftPayload) => T | null;
  submissionStoreRef: RefObject<SubmissionStorePort | null>;
  onSubmissionRecovered: (submission: StoredSubmission | null) => void;
}) {
  const db = useRef<IDBDatabase | null>(null);
  const key = useRef<CryptoKey | null>(null);
  const pending = useRef<Pending | null>(null);
  const [envelope, setEnvelope] = useState<VaultEnvelope | null>(null);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<
    "loading" | "create" | "pending" | "locked" | "unlocked"
  >("loading");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [storedSubmission, setStoredSubmission] =
    useState<StoredSubmission | null>(null);
  const [remote, setRemote] = useState<RemoteDraft | null>(null);
  const [serverDrafts, setServerDrafts] = useState<Awaited<
    ReturnType<typeof listServerDrafts>
  > | null>(null);
  const [conflict, setConflict] = useState<
    | ServerDraft
    | { draft_id: string; revision: "0"; state: "missing"; payload: null }
    | null
  >(null);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const syncEnabled =
    import.meta.env.VITE_DENTAL_LAB_DRAFT_SYNC_ENABLED === "true";
  const [phrase, setPhrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [savedCode, setSavedCode] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let current = true;
    key.current = null;
    submissionStoreRef.current = null;
    pending.current = null;
    db.current = null;
    void openLocalVault()
      .then(async (opened) => {
        if (!current) {
          opened.close();
          return;
        }
        db.current = opened;
        const stored = await readVault(opened, accountId);
        if (current) {
          setEnvelope(stored);
          setReady(true);
          setPhase(stored ? "locked" : "create");
        }
      })
      .catch(() => {
        if (current)
          setMessage(
            "Ruajtja e sigurt nuk është e disponueshme në këtë pajisje.",
          );
      });
    return () => {
      current = false;
      db.current?.close();
      db.current = null;
      key.current = null;
      submissionStoreRef.current = null;
      pending.current = null;
    };
  }, [accountId, submissionStoreRef]);
  async function run(work: () => Promise<void>) {
    if (busy || !db.current) return;
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (error) {
      const conflict =
        error instanceof Error &&
        (error.message === "VAULT_CONFLICT" ||
          error.message === "VAULT_ALREADY_EXISTS");
      const quota =
        error instanceof Error && error.message === "VAULT_QUOTA_EXCEEDED";
      setMessage(
        conflict
          ? "Drafti u ndryshua në një skedë tjetër. Kyçeni dhe hapeni sërish."
          : quota
            ? "Hapësira e ruajtjes në këtë pajisje nuk mjafton. Drafti nuk u ruajt; lironi hapësirë dhe provoni përsëri."
            : "Veprimi nuk u verifikua. Të dhënat e ruajtura më parë nuk u ndryshuan.",
      );
    } finally {
      setBusy(false);
      setPhrase("");
      setConfirmation("");
      if (envelope) setCode("");
    }
  }
  async function connectSubmissionStore(
    database: IDBDatabase,
    stored: VaultEnvelope,
    active: CryptoKey,
  ) {
    const context = { db: database, envelope: stored, key: active };
    const existing = await readSubmissionIntent(context);
    setStoredSubmission(existing);
    onSubmissionRecovered(existing);
    submissionStoreRef.current = {
      async stage(request) {
        const value = await stageSubmissionIntent(context, request);
        setStoredSubmission(value);
      },
      async markAttempt(request) {
        const value = await markSubmissionAttempt(context, request);
        setStoredSubmission(value);
      },
      async record(request, reply) {
        const value = await recordSubmissionReply(context, request, reply);
        setStoredSubmission(value);
      },
    };
  }
  async function clearSubmission() {
    if (
      !storedSubmission ||
      storedSubmission.state !== "settled" ||
      !db.current ||
      !key.current ||
      !envelope ||
      !window.confirm(
        "Të hiqet vetëm gjurma lokale e këtij dërgimi të përfunduar?",
      )
    )
      return;
    await run(async () => {
      await clearSettledSubmission(
        { db: db.current!, envelope, key: key.current! },
        storedSubmission.idempotency_key,
      );
      setStoredSubmission(null);
      onSubmissionRecovered(null);
      setMessage("Gjurma e përfunduar u hoq nga kasaforta.");
    });
  }
  async function prepare() {
    if (!phrase || phrase !== confirmation) {
      setMessage("Fraza dhe konfirmimi duhet të përputhen.");
      return;
    }
    await run(async () => {
      pending.current = await prepareVault(accountId, phrase);
      setCode(pending.current.recoveryCode);
      setSavedCode(false);
      setPhase("pending");
    });
  }
  async function confirmCreation() {
    if (!savedCode || !pending.current || !db.current) return;
    await run(async () => {
      const prepared = pending.current!;
      await createVault(db.current!, prepared.envelope);
      await connectSubmissionStore(
        db.current!,
        prepared.envelope,
        prepared.active,
      );
      key.current = prepared.active;
      setEnvelope(prepared.envelope);
      setPhase("unlocked");
      pending.current = null;
      setCode("");
      setMessage(
        "Kasaforta u krijua. Drafti ruhet vetëm pasi të shtypni Ruaj.",
      );
    });
  }
  async function unlock() {
    if (!envelope || !db.current || (!phrase && !code)) return;
    await run(async () => {
      const stored = await readVault(db.current!, accountId);
      if (!stored) throw new Error("VAULT_STORAGE_UNAVAILABLE");
      const active = await unlockVault(
        stored,
        accountId,
        recovery ? code : phrase,
        recovery ? "recovery" : "phrase",
      );
      const existing = await readLocalDraft<T>(db.current!, stored, active);
      await connectSubmissionStore(db.current!, stored, active);
      setEnvelope(stored);
      key.current = active;
      setPhase("unlocked");
      setRevision(existing?.revision ?? 0);
      setRemote(existing?.remote ?? null);
      setCode("");
      setMessage(
        existing
          ? "Drafti i koduar u gjet. Hapeni vetëm kur të dëshironi."
          : "Kasaforta u hap; nuk ka draft lokal.",
      );
    });
  }
  async function changePhrase() {
    if (
      !envelope ||
      !db.current ||
      !code ||
      !phrase ||
      phrase !== confirmation
    ) {
      setMessage("Shkruani kodin e rikuperimit dhe konfirmoni frazën e re.");
      return;
    }
    await run(async () => {
      const next = await recoverPhrase(envelope, accountId, code, phrase);
      const active = await unlockVault(next, accountId, phrase, "phrase");
      const existing = await readLocalDraft<T>(db.current!, next, active);
      await replaceVault(db.current!, envelope, next);
      await connectSubmissionStore(db.current!, next, active);
      key.current = active;
      setPhase("unlocked");
      setRevision(existing?.revision ?? 0);
      setRemote(existing?.remote ?? null);
      setEnvelope(next);
      setCode("");
      setRecovery(false);
      setMessage("Fraza u ndryshua; të dhënat e koduara u ruajtën.");
    });
  }
  async function save() {
    if (!db.current || !key.current || !envelope || disabled || remote?.pending)
      return;
    await run(async () => {
      const next = await saveLocalDraft(
        db.current!,
        envelope,
        key.current!,
        capture(),
        revision,
        remote,
      );
      setRevision(next);
      setMessage(
        "Drafti u ruajt i koduar në këtë pajisje. Nuk u dërgua në laborator.",
      );
    });
  }
  async function load() {
    if (!db.current || !key.current || !envelope || disabled) return;
    await run(async () => {
      const current = await readLocalDraft<T>(
        db.current!,
        envelope,
        key.current!,
      );
      if (!current || !restore(current.value))
        throw new Error("VAULT_DRAFT_INVALID");
      setRevision(current.revision);
      setRemote(current.remote);
      setMessage("Drafti u hap. Kontrolloni katalogun përpara dërgimit.");
    });
  }
  async function applyPending(
    value: T,
    localRevision: number,
    target: RemoteDraft,
  ) {
    const command = target.pending!;
    let answer: Awaited<ReturnType<typeof commitServerDraft>>;
    try {
      answer = await commitServerDraft(command);
    } catch {
      setMessage(
        "Përgjigjja e serverit është e pasigurt. Veprimi mbetet i koduar; provoni të njëjtin sinkronizim përsëri.",
      );
      return;
    }
    if (answer.kind === "conflict") {
      try {
        setConflict(
          (await readServerDraft(command.draft_id)) ?? {
            draft_id: command.draft_id,
            revision: "0",
            state: "missing",
            payload: null,
          },
        );
      } catch {
        setMessage(
          "U zbulua konflikt, por versioni i serverit nuk u lexua. Provoni përsëri.",
        );
        return;
      }
      setMessage(
        "Konflikt: zgjidhni versionin e serverit ose ruani versionin lokal si kopje të re.",
      );
      return;
    }
    const next: RemoteDraft | null = command.payload
      ? {
          draft_id: command.draft_id,
          revision: answer.revision,
          pending: null,
          ...(target.origin_draft_id
            ? { origin_draft_id: target.origin_draft_id }
            : {}),
        }
      : null;
    const committedRevision = await saveLocalDraft(
      db.current!,
      envelope!,
      key.current!,
      value,
      localRevision,
      next,
    );
    setRevision(committedRevision);
    setRemote(next);
    setConflict(null);
    setMessage(
      command.payload
        ? "Drafti u sinkronizua në server. Porosia nuk u dërgua."
        : "Drafti i serverit u fshi; kopja lokale e koduar u ruajt.",
    );
  }
  async function sync() {
    if (
      !syncEnabled ||
      !online ||
      !db.current ||
      !key.current ||
      !envelope ||
      !revision ||
      confirmed
    )
      return;
    await run(async () => {
      const saved = await readLocalDraft<T>(
        db.current!,
        envelope,
        key.current!,
      );
      if (!saved || saved.revision !== revision)
        throw new Error("VAULT_CONFLICT");
      let target = saved.remote;
      let localRevision = saved.revision;
      if (!target?.pending) {
        const payload = toServer(saved.value);
        if (!payload) {
          setMessage(
            "Drafti lokal nuk është i vlefshëm për sinkronizim. Kontrolloni fushat.",
          );
          return;
        }
        const draft_id = target?.draft_id ?? crypto.randomUUID();
        const expected_revision = Number(target?.revision ?? 0);
        if (
          !Number.isSafeInteger(expected_revision) ||
          expected_revision > 2147483647
        )
          throw new Error("VAULT_CONFLICT");
        target = {
          draft_id,
          revision: target?.revision ?? "0",
          ...(target?.origin_draft_id
            ? { origin_draft_id: target.origin_draft_id }
            : {}),
          pending: {
            draft_id,
            expected_revision,
            idempotency_key: crypto.randomUUID(),
            payload,
          },
        };
        localRevision = await saveLocalDraft(
          db.current!,
          envelope,
          key.current!,
          saved.value,
          localRevision,
          target,
        );
        setRevision(localRevision);
        setRemote(target);
      }
      await applyPending(saved.value, localRevision, target);
    });
  }
  async function removeServer() {
    if (
      !syncEnabled ||
      !online ||
      !db.current ||
      !key.current ||
      !envelope ||
      !remote ||
      remote.pending ||
      !revision ||
      confirmed ||
      !window.confirm(
        "Të fshihet drafti i serverit? Kopja lokale e koduar ruhet në këtë pajisje.",
      )
    )
      return;
    await run(async () => {
      const saved = await readLocalDraft<T>(
        db.current!,
        envelope,
        key.current!,
      );
      if (
        !saved ||
        saved.revision !== revision ||
        !saved.remote ||
        saved.remote.draft_id !== remote.draft_id ||
        saved.remote.pending
      )
        throw new Error("VAULT_CONFLICT");
      const expected_revision = Number(saved.remote.revision);
      if (
        !Number.isSafeInteger(expected_revision) ||
        expected_revision < 1 ||
        expected_revision > 2147483647
      )
        throw new Error("VAULT_CONFLICT");
      const next: RemoteDraft = {
        ...saved.remote,
        pending: {
          draft_id: saved.remote.draft_id,
          expected_revision,
          idempotency_key: crypto.randomUUID(),
        },
      };
      const localRevision = await saveLocalDraft(
        db.current!,
        envelope,
        key.current!,
        saved.value,
        revision,
        next,
      );
      setRevision(localRevision);
      setRemote(next);
      await applyPending(saved.value, localRevision, next);
    });
  }
  async function discover(after?: string) {
    if (!syncEnabled || !online) return;
    await run(async () => {
      const page = await listServerDrafts(after);
      setServerDrafts((previous) =>
        after && previous
          ? {
              items: [...previous.items, ...page.items],
              next_after: page.next_after,
            }
          : page,
      );
    });
  }
  async function importServer(draftId: string) {
    if (
      !db.current ||
      !key.current ||
      !envelope ||
      remote?.pending ||
      confirmed ||
      (revision > 0 &&
        !window.confirm(
          "Drafti lokal do të zëvendësohet nga versioni i serverit. Vazhdoni?",
        ))
    )
      return;
    await run(async () => {
      const server = await readServerDraft(draftId);
      if (!server || server.state !== "active" || !server.payload)
        throw new Error("DRAFT_SYNC_UNAVAILABLE");
      const value = fromServer(server.payload);
      if (!value) throw new Error("VAULT_DRAFT_INVALID");
      const next: RemoteDraft = {
        draft_id: draftId,
        revision: server.revision,
        pending: null,
      };
      const localRevision = await saveLocalDraft(
        db.current!,
        envelope,
        key.current!,
        value,
        revision,
        next,
      );
      if (!restore(value)) throw new Error("VAULT_DRAFT_INVALID");
      setRevision(localRevision);
      setRemote(next);
      setConflict(null);
      setMessage(
        "Drafti i serverit u hap. Kontrolloni katalogun para dërgimit.",
      );
    });
  }
  async function chooseServer() {
    if (
      !conflict ||
      conflict.state === "missing" ||
      !db.current ||
      !envelope ||
      !key.current ||
      !window.confirm("Zgjedhja e serverit zëvendëson draftin lokal. Vazhdoni?")
    )
      return;
    let current: ServerDraft | null;
    try {
      current = await readServerDraft(conflict.draft_id);
    } catch {
      setMessage("Versioni i serverit nuk u verifikua. Drafti lokal u ruajt.");
      return;
    }
    if (
      !current ||
      current.revision !== conflict.revision ||
      current.state !== conflict.state
    ) {
      setConflict(
        current ?? {
          draft_id: conflict.draft_id,
          revision: "0",
          state: "missing",
          payload: null,
        },
      );
      setMessage("Versioni i serverit ndryshoi përsëri. Rishikoni konfliktin.");
      return;
    }
    if (current.state === "active" && current.payload) {
      await importConflict(current);
      return;
    }
    await run(async () => {
      await deleteLocalDraft(db.current!, envelope, revision);
      setRevision(0);
      setRemote(null);
      setConflict(null);
      setMessage(
        "Versioni i serverit është fshirë; drafti lokal u hoq me kërkesën tuaj.",
      );
    });
  }
  async function importConflict(server: ServerDraft) {
    await run(async () => {
      const value = server.payload && fromServer(server.payload);
      if (!value) throw new Error("VAULT_DRAFT_INVALID");
      const next: RemoteDraft = {
        draft_id: server.draft_id,
        revision: server.revision,
        pending: null,
      };
      const localRevision = await saveLocalDraft(
        db.current!,
        envelope!,
        key.current!,
        value,
        revision,
        next,
      );
      if (!restore(value)) throw new Error("VAULT_DRAFT_INVALID");
      setRevision(localRevision);
      setRemote(next);
      setConflict(null);
      setMessage("Versioni i serverit u zgjodh. Rishikoni të dhënat.");
    });
  }
  async function cloneLocal() {
    if (!conflict || !db.current || !key.current || !envelope) return;
    await run(async () => {
      const saved = await readLocalDraft<T>(
        db.current!,
        envelope,
        key.current!,
      );
      if (!saved || saved.revision !== revision)
        throw new Error("VAULT_CONFLICT");
      const next: RemoteDraft = {
        draft_id: crypto.randomUUID(),
        revision: "0",
        pending: null,
        ...(saved.remote
          ? {
              origin_draft_id:
                saved.remote.origin_draft_id ?? saved.remote.draft_id,
            }
          : {}),
      };
      const localRevision = await saveLocalDraft(
        db.current!,
        envelope,
        key.current!,
        saved.value,
        revision,
        next,
      );
      setRevision(localRevision);
      setRemote(next);
      setConflict(null);
      setMessage(
        "Kopja lokale u ruajt me identitet të ri. Sinkronizojeni vetëm me veprim të qartë.",
      );
    });
  }
  async function removeConfirmed() {
    if (
      !confirmed ||
      !db.current ||
      !envelope ||
      !key.current ||
      !revision ||
      remote?.pending
    )
      return;
    if (remote) {
      setMessage(
        "Drafti i serverit mbetet aktiv në pajisje të tjera. Fshirja pas dërgimit pret lidhjen me porosinë e konfirmuar.",
      );
      return;
    }
    await run(async () => {
      const saved = await readLocalDraft<T>(
        db.current!,
        envelope,
        key.current!,
      );
      if (
        !saved ||
        saved.revision !== revision ||
        JSON.stringify(saved.value) !== JSON.stringify(capture())
      ) {
        setMessage(
          "Drafti lokal është i ndryshëm nga porosia e konfirmuar; nuk u fshi.",
        );
        return;
      }
      await deleteLocalDraft(db.current!, envelope, saved.revision);
      setRevision(0);
      setRemote(null);
      setMessage("Drafti i kësaj porosie u fshi pas konfirmimit të serverit.");
    });
  }
  async function remove() {
    if (
      !db.current ||
      !envelope ||
      !key.current ||
      !revision ||
      remote?.pending ||
      !window.confirm("Të fshihet vetëm drafti lokal nga kjo pajisje?")
    )
      return;
    await run(async () => {
      await deleteLocalDraft(db.current!, envelope, revision);
      setRevision(0);
      setRemote(null);
      setMessage("Drafti lokal u fshi. Formulari në ekran nuk u ndryshua.");
    });
  }
  return (
    <section aria-label="Drafti lokal i koduar">
      <h4>Drafti lokal i koduar</h4>
      <p>
        Ruhet vetëm në këtë pajisje. Përdorni një frazë prej të paktën 12
        shenjash, ndryshe nga fjalëkalimi i hyrjes. Nëse humbni frazën dhe kodin
        e rikuperimit, drafti lokal nuk rikthehet. Humbja e pajisjes ose e
        ruajtjes nuk zgjidhet nga kodi.
      </p>
      {!ready && (
        <p role="status">{message || "Po kontrollohet ruajtja e sigurt…"}</p>
      )}
      {ready && phase !== "unlocked" && (
        <>
          {envelope && (
            <Button disabled={busy} onClick={() => setRecovery(!recovery)}>
              {recovery ? "Hap me frazë" : "Përdor kodin e rikuperimit"}
            </Button>
          )}
          {phase !== "pending" && (
            <label>
              {envelope && recovery ? "Fraza e re" : "Fraza e kasafortës"}
              <input
                type="password"
                autoComplete="off"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
              />
            </label>
          )}
          {(!envelope || recovery) && phase !== "pending" && (
            <label>
              Konfirmoni frazën e re
              <input
                type="password"
                autoComplete="off"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
          )}
          {envelope && recovery && (
            <label>
              Kodi privat i rikuperimit
              <input
                type="password"
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
          )}
          {!envelope && phase !== "pending" && (
            <Button disabled={busy} onClick={() => void prepare()}>
              Përgatit kasafortën
            </Button>
          )}
          {phase === "pending" && (
            <>
              <p role="alert">
                Ruajeni këtë kod privatisht. Nuk ruhet në server dhe nuk shfaqet
                përsëri.
              </p>
              <code>{code}</code>
              <label>
                <input
                  type="checkbox"
                  checked={savedCode}
                  onChange={(e) => setSavedCode(e.target.checked)}
                />{" "}
                E ruajta kodin në një vend privat.
              </label>
              <Button
                disabled={busy || !savedCode}
                onClick={() => void confirmCreation()}
              >
                Konfirmo krijimin
              </Button>
            </>
          )}
          {envelope && !recovery && (
            <Button disabled={busy} onClick={() => void unlock()}>
              Hap kasafortën
            </Button>
          )}
          {envelope && recovery && (
            <>
              <Button disabled={busy} onClick={() => void unlock()}>
                Hap me kod
              </Button>
              <Button disabled={busy} onClick={() => void changePhrase()}>
                Ndrysho frazën me kod
              </Button>
            </>
          )}
        </>
      )}
      {ready && phase === "unlocked" && (
        <>
          <p>
            Kasaforta është e hapur.{" "}
            {revision
              ? "Ka një draft lokal të ruajtur."
              : "Nuk ka draft lokal të ruajtur."}
          </p>
          {storedSubmission && (
            <div role="status">
              <p>
                {storedSubmission.state === "prepared"
                  ? "Dërgimi është përgatitur lokalisht; mund të mos jetë nisur."
                  : storedSubmission.state === "uncertain"
                    ? "Rezultati i dërgimit nuk dihet. Verifikojeni me të njëjtën kërkesë; mos krijoni një tjetër."
                    : storedSubmission.reply?.kind === "submitted"
                      ? "Konfirmimi i serverit ruhet i koduar në këtë pajisje."
                      : "Përgjigjja e serverit u ruajt; rishikoni arsyet para një kërkese tjetër."}
              </p>
              {storedSubmission.state === "settled" && (
                <Button disabled={busy} onClick={() => void clearSubmission()}>
                  Fshi gjurmën e dërgimit të përfunduar
                </Button>
              )}
            </div>
          )}
          <Button
            disabled={busy || disabled || confirmed || !!remote?.pending}
            onClick={() => void save()}
          >
            Ruaj draftin
          </Button>
          {revision > 0 && (
            <>
              <Button
                disabled={busy || disabled || confirmed}
                onClick={() => void load()}
              >
                Hap draftin
              </Button>
              {confirmed && (
                <Button disabled={busy} onClick={() => void removeConfirmed()}>
                  Fshi draftin e kësaj porosie pas konfirmimit
                </Button>
              )}
              <Button disabled={busy} onClick={() => void remove()}>
                Fshi draftin lokal
              </Button>
            </>
          )}
          {syncEnabled && (
            <>
              <p>
                Sinkronizimi është vetëm manual. Skedarët nuk sinkronizohen
                ende.
              </p>
              {remote?.origin_draft_id && (
                <p>
                  Kopje lokale e draftit {remote.origin_draft_id.slice(0, 8)};
                  origjinali në server nuk u zëvendësua.
                </p>
              )}
              <Button
                disabled={busy || !revision || confirmed || !online}
                onClick={() => void sync()}
              >
                {remote?.pending
                  ? "Verifiko të njëjtin sinkronizim"
                  : "Sinkronizo draftin"}
              </Button>
              {remote && !remote.pending && (
                <Button
                  disabled={busy || !online || confirmed}
                  onClick={() => void removeServer()}
                >
                  Fshi draftin e serverit (ruaj kopjen lokale)
                </Button>
              )}
              <Button
                disabled={busy || !online}
                onClick={() => void discover()}
              >
                Shiko draftet e serverit
              </Button>
              {serverDrafts?.items.map((item) => (
                <Button
                  key={item.draft_id}
                  disabled={busy || !!remote?.pending}
                  onClick={() => void importServer(item.draft_id)}
                >
                  Hap draftin {item.draft_id.slice(0, 8)} · v{item.revision}
                </Button>
              ))}
              {serverDrafts?.next_after && (
                <Button
                  disabled={busy}
                  onClick={() => void discover(serverDrafts.next_after!)}
                >
                  Më shumë
                </Button>
              )}
              {conflict && (
                <div role="alert">
                  <p>
                    Konflikt me versionin {conflict.revision} të serverit (
                    {conflict.state}). Asgjë nuk u zëvendësua.
                  </p>
                  {conflict.state !== "missing" && (
                    <Button disabled={busy} onClick={() => void chooseServer()}>
                      Zgjidh serverin
                    </Button>
                  )}
                  <Button disabled={busy} onClick={() => void cloneLocal()}>
                    Ruaj lokalisht si kopje të re
                  </Button>
                </div>
              )}
            </>
          )}
          <Button
            disabled={busy}
            onClick={() => {
              key.current = null;
              setPhase("locked");
              setCode("");
              setPhrase("");
              setMessage("Kasaforta u kyç.");
            }}
          >
            Kyç kasafortën
          </Button>
        </>
      )}
      {ready && message && <p role="status">{message}</p>}
    </section>
  );
}
