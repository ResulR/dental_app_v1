import { useEffect, useRef, useState } from "react";
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
} from "./local-vault.js";

type Pending = Awaited<ReturnType<typeof prepareVault>>;
export function ClinicDraftVault<T>({
  accountId,
  capture,
  restore,
  disabled,
}: {
  accountId: string;
  capture: () => T;
  restore: (value: T) => boolean;
  disabled: boolean;
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
  const [phrase, setPhrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [savedCode, setSavedCode] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let current = true;
    key.current = null;
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
      pending.current = null;
    };
  }, [accountId]);
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
      setMessage(
        conflict
          ? "Drafti u ndryshua në një skedë tjetër. Kyçeni dhe hapeni sërish."
          : "Veprimi nuk u verifikua. Të dhënat e ruajtura më parë nuk u ndryshuan.",
      );
    } finally {
      setBusy(false);
      setPhrase("");
      setConfirmation("");
      if (envelope) setCode("");
    }
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
      setEnvelope(stored);
      key.current = active;
      setPhase("unlocked");
      setRevision(existing?.revision ?? 0);
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
      key.current = active;
      setPhase("unlocked");
      setRevision(existing?.revision ?? 0);
      setEnvelope(next);
      setCode("");
      setRecovery(false);
      setMessage("Fraza u ndryshua; të dhënat e koduara u ruajtën.");
    });
  }
  async function save() {
    if (!db.current || !key.current || !envelope || disabled) return;
    await run(async () => {
      const next = await saveLocalDraft(
        db.current!,
        envelope,
        key.current!,
        capture(),
        revision,
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
      setMessage("Drafti u hap. Kontrolloni katalogun përpara dërgimit.");
    });
  }
  async function remove() {
    if (
      !db.current ||
      !envelope ||
      !key.current ||
      !revision ||
      !window.confirm("Të fshihet vetëm drafti lokal nga kjo pajisje?")
    )
      return;
    await run(async () => {
      await deleteLocalDraft(db.current!, envelope, revision);
      setRevision(0);
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
          <Button disabled={busy || disabled} onClick={() => void save()}>
            Ruaj draftin
          </Button>
          {revision > 0 && (
            <>
              <Button disabled={busy || disabled} onClick={() => void load()}>
                Hap draftin
              </Button>
              <Button disabled={busy} onClick={() => void remove()}>
                Fshi draftin lokal
              </Button>
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
