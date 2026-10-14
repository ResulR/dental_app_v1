import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../../shared/Button.js";
import { Card } from "../../shared/Card.js";
import { createAuthClient, authFailureMessage } from "./auth-api.js";
import type { AuthClient, SessionIdentity, SessionResult } from "./auth-api.js";
const api = createAuthClient();
const profiles = {
  owner: "Pronari",
  admin: "Administratori",
  employee: "Punonjësi",
  clinic: "Klinika",
};
type View =
  | { kind: "checking" }
  | { kind: "anonymous" }
  | { kind: "unavailable" }
  | { kind: "authenticated"; identity: SessionIdentity };
export function AuthenticationPanel({
  client = api,
  renderAuthenticated,
}: {
  client?: AuthClient;
  renderAuthenticated?: (identity: SessionIdentity) => ReactNode;
}) {
  const [view, setView] = useState<View>({ kind: "checking" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const ids = useId();
  function applySession(result: SessionResult) {
    if (result.kind === "authenticated") {
      setView(result);
      setMessage("");
    } else if (result.kind === "denied") {
      setView({ kind: "anonymous" });
    } else {
      setView({ kind: "unavailable" });
      setMessage(authFailureMessage(result));
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    void client.session(controller.signal).then((result) => {
      if (!current) return;
      if (result.kind === "authenticated") setView(result);
      else if (result.kind === "denied") setView({ kind: "anonymous" });
      else {
        setView({ kind: "unavailable" });
        setMessage(authFailureMessage(result));
      }
    });
    return () => {
      current = false;
      controller.abort();
    };
  }, [client]);
  async function operation(work: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch {
      setMessage(authFailureMessage({ kind: "unavailable" }));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function check() {
    await operation(async () => {
      const current = await client.session();
      if (current.kind !== "authenticated") {
        applySession(current);
        return;
      }
      const renewed = await client.renew();
      if (renewed.kind !== "ok") {
        if (renewed.kind === "denied") setView({ kind: "anonymous" });
        setMessage(authFailureMessage(renewed));
        return;
      }
      applySession(await client.session());
    });
  }
  async function login() {
    const submitted = { email, password };
    setPassword("");
    await operation(async () => {
      const result = await client.login(submitted);
      if (result.kind !== "ok") {
        if (result.kind === "unavailable") setView({ kind: "unavailable" });
        setMessage(authFailureMessage(result));
        return;
      }
      applySession(await client.session());
    });
  }
  async function logout(all: boolean) {
    await operation(async () => {
      const result = await (all ? client.logoutAll() : client.logout());
      if (result.kind === "ok" || result.kind === "denied") {
        setView({ kind: "anonymous" });
        setPassword("");
        setEmail("");
        if (result.kind === "denied") setMessage("Sesioni ka përfunduar.");
      } else setMessage("Dalja nuk u konfirmua. " + authFailureMessage(result));
    });
  }
  // Focus revalidation reads current state before renewal, including after an
  // uncertain response. Cookie stays browser-managed; no local token storage.
  useEffect(() => {
    if (view.kind !== "authenticated") return;
    const verify = () => {
      if (
        document.visibilityState === "visible" &&
        navigator.onLine &&
        !inFlight.current
      )
        void check();
    };
    const timer = window.setInterval(verify, 30000);
    window.addEventListener("focus", verify);
    document.addEventListener("visibilitychange", verify);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", verify);
      document.removeEventListener("visibilitychange", verify);
    };
  });
  const feedback = message ? (
    <p role="status" aria-live="polite">
      {message}
    </p>
  ) : null;
  if (view.kind === "checking")
    return (
      <Card>
        <h2>Hyrja në llogari</h2>
        <p role="status">Po kontrollohet sesioni…</p>
      </Card>
    );
  if (view.kind === "unavailable")
    return (
      <Card>
        <h2>Hyrja në llogari</h2>
        {feedback}
        <Button
          disabled={busy}
          onClick={() => {
            void check();
          }}
        >
          Provo përsëri
        </Button>
      </Card>
    );
  if (view.kind === "authenticated")
    return (
      <Card>
        <h2>Jeni të identifikuar</h2>
        <p>{profiles[view.identity.profile]}</p>
        {renderAuthenticated?.(view.identity)}
        <p className="muted">
          Funksionet e punës do të shfaqen këtu kur të jenë të disponueshme.
        </p>
        {feedback}
        <div className="auth-actions" aria-busy={busy}>
          <Button
            disabled={busy}
            onClick={() => {
              void check();
            }}
          >
            Verifiko lidhjen
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              void logout(false);
            }}
          >
            Dil nga llogaria
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              void logout(true);
            }}
          >
            Dil nga të gjitha pajisjet
          </Button>
        </div>
      </Card>
    );
  return (
    <Card>
      <h2>Hyrja në llogari</h2>
      <p>Hapësirë private për laboratorin dhe klinikat partnere.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) void login();
        }}
        aria-busy={busy}
      >
        <fieldset disabled={busy} className="profile-fields">
          <legend>Identifikohuni me llogarinë tuaj</legend>
          <label htmlFor={ids + "-email"}>
            Emaili
            <input
              id={ids + "-email"}
              name="email"
              type="text"
              inputMode="email"
              autoComplete="username"
              required
              maxLength={320}
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label htmlFor={ids + "-password"}>
            Fjalëkalimi
            <input
              id={ids + "-password"}
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={1024}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        </fieldset>
        {feedback}
        <Button type="submit" disabled={busy}>
          {busy ? "Po verifikohet…" : "Hyr"}
        </Button>
      </form>
    </Card>
  );
}
