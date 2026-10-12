import { useRef, useState } from "react";
import { ClinicContactUpdateSchema } from "@dental-lab/contracts";
import type { ClinicProfile, ClinicContactUpdate } from "@dental-lab/contracts";
import { Button } from "../../shared/Button.js";
import { Card } from "../../shared/Card.js";
type Result = { kind: "applied" | "conflict" | "denied" | "invalid" };
const fields = [
  ["name", "Emri i klinikës"],
  ["dentist_first_name", "Emri i dentistit"],
  ["dentist_last_name", "Mbiemri i dentistit"],
  ["phone", "Telefoni"],
  ["address", "Adresa e plotë"],
] as const;
// Parent must key this form by clinic ID/revision after an authorized reload.
// No optimistic revision bump, browser storage or invented HTTP endpoint.
export function ClinicProfileForm({
  profile,
  canEdit,
  online,
  save,
}: {
  profile: ClinicProfile;
  canEdit: boolean;
  online: boolean;
  save: (input: ClinicContactUpdate) => Promise<Result>;
}) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map(([key]) => [key, profile[key]])),
  );
  const [baseline] = useState(() => ({
    id: profile.id,
    revision: profile.revision,
  }));
  const changedProfile =
    baseline.id !== profile.id || baseline.revision !== profile.revision;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reloadRequired, setReloadRequired] = useState(false);
  const inFlight = useRef(false);
  const disabled =
    !canEdit || !online || busy || reloadRequired || changedProfile;
  async function submit() {
    if (disabled || inFlight.current) return;
    const parsed = ClinicContactUpdateSchema.safeParse({
      ...values,
      expected_revision: baseline.revision,
    });
    if (!parsed.success) {
      setMessage(
        "Plotësoni të gjitha fushat e kërkuara (deri në 2000 karaktere).",
      );
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await save(parsed.data);
      setMessage(
        result.kind === "applied"
          ? "Ndryshimet u ruajtën. Rifreskoni profilin para një ndryshimi tjetër."
          : result.kind === "conflict"
            ? "Profili ka ndryshuar. Rifreskojeni dhe kontrolloni të dhënat para se të provoni sërish."
            : result.kind === "denied"
              ? "Nuk keni leje për këtë ndryshim."
              : "Kontrolloni të dhënat e formularit.",
      );
      if (
        result.kind === "applied" ||
        result.kind === "conflict" ||
        result.kind === "denied"
      )
        setReloadRequired(true);
    } catch {
      setMessage(
        "Ruajtja nuk u konfirmua. Rifreskoni profilin para se të provoni sërish.",
      );
      setReloadRequired(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <Card>
      <h2>Të dhënat e klinikës</h2>
      <p>
        Emaili ndryshohet përmes një kërkese të veçantë me miratim dhe
        konfirmim.
      </p>
      {!online && (
        <p role="status">Ndryshimi i profilit kërkon lidhje me internetin.</p>
      )}
      {!canEdit && <p>Keni vetëm të drejtë leximi.</p>}
      {changedProfile && (
        <p role="status">
          Profili ka ndryshuar. Rihapni formularin para se të bëni ndryshime.
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        aria-busy={busy}
      >
        <fieldset disabled={disabled} className="profile-fields">
          <legend>Informacionet e kontaktit</legend>
          {fields.map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                name={key}
                required
                maxLength={2000}
                type={key === "phone" ? "tel" : "text"}
                value={values[key] ?? ""}
                onChange={(event) =>
                  setValues({ ...values, [key]: event.target.value })
                }
              />
            </label>
          ))}
        </fieldset>
        <p role="status" aria-live="polite">
          {message}
        </p>
        <Button type="submit" disabled={disabled}>
          {busy ? "Duke ruajtur…" : "Ruaj ndryshimet"}
        </Button>
      </form>
    </Card>
  );
}
