import { useId, useRef, useState } from "react";
import type { RegistrationTerms } from "@dental-lab/contracts";
import { createRegistrationClient } from "./registration-api.js";
const client = createRegistrationClient();
const fields = [
  ["name", "Emri i klinikës"],
  ["dentist_first_name", "Emri i dentistit"],
  ["dentist_last_name", "Mbiemri i dentistit"],
  ["email", "Email"],
  ["phone", "Telefoni"],
  ["address", "Adresa e plotë"],
] as const;
export function ClinicRegistrationPanel() {
  const id = useId();
  const [terms, setTerms] = useState<RegistrationTerms>();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [terminal, setTerminal] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  async function loadTerms() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setAccepted(false);
    setTerms(undefined);
    const result = await client.terms();
    setTerms(result);
    setMessage(
      result ? "" : "Regjistrimi nuk është i disponueshëm për momentin.",
    );
    setBusy(false);
    inFlight.current = false;
  }
  return (
    <section aria-labelledby={id + "-heading"}>
      <h2 id={id + "-heading"}>Regjistro klinikën</h2>
      <p>
        Një llogari e përbashkët për klinikën. Porositë lejohen vetëm pas
        miratimit të laboratorit.
      </p>
      <button
        type="button"
        disabled={busy || terminal}
        onClick={() => void loadTerms()}
      >
        Lexo kushtet aktuale
      </button>
      {terms && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!terms || !accepted || inFlight.current || terminal) return;
            const form = event.currentTarget;
            const data = new FormData(form);
            inFlight.current = true;
            setBusy(true);
            const result = await client.register({
              ...Object.fromEntries(data),
              accepted_terms: true,
              terms_version_id: terms.version_id,
            });
            // Never retain a password after submission, retry automatically or store a draft.
            const password = form.elements.namedItem("password");
            if (password instanceof HTMLInputElement) password.value = "";
            if (result === "pending") {
              form.reset();
              setTerminal(true);
              setMessage(
                "Kërkesa u regjistrua. Në pritje të miratimit të laboratorit.",
              );
            } else if (result === "uncertain") {
              setTerminal(true);
              setMessage(
                "Rezultati nuk u konfirmua. Mos e ridërgoni automatikisht; kontaktoni laboratorin.",
              );
            } else {
              setAccepted(false);
              setMessage(
                result === "limited"
                  ? "Shumë përpjekje. Provoni më vonë."
                  : "Kontrolloni të dhënat dhe rilexoni kushtet aktuale.",
              );
              if (result === "invalid") setTerms(undefined);
            }
            setBusy(false);
            inFlight.current = false;
          }}
        >
          <fieldset disabled={busy || terminal}>
            <legend>Të dhënat e klinikës</legend>
            {fields.map(([name, label]) => (
              <p key={name}>
                <label htmlFor={id + name}>{label}</label>
                <input
                  id={id + name}
                  name={name}
                  type={name === "email" ? "email" : "text"}
                  required
                  maxLength={name === "email" ? 320 : 2000}
                />
              </p>
            ))}
            <p>
              <label htmlFor={id + "password"}>
                Fjalëkalimi (të paktën 15 karaktere)
              </label>
              <input
                id={id + "password"}
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={15}
                maxLength={1024}
              />
            </p>
            <h3>Kushtet e përdorimit</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{terms.body}</p>
            <label>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />{" "}
              Pranoj këtë version të kushteve.
            </label>
            <p>
              <button type="submit" disabled={!accepted}>
                Dërgo kërkesën
              </button>
            </p>
          </fieldset>
        </form>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
