import { useEffect, useState } from "react";
import { Button } from "../../shared/Button.js";

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPanel() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const available = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const installed = () => {
      setPrompt(null);
      setMessage("Aplikacioni u instalua.");
    };
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  if (!prompt && !message) return null;
  async function install() {
    if (!prompt || busy) return;
    const pending = prompt;
    setPrompt(null);
    setBusy(true);
    setMessage("");
    try {
      await pending.prompt();
      const choice = await pending.userChoice;
      if (choice.outcome === "dismissed")
        setMessage("Instalimi u anulua. Mund ta provoni nga shfletuesi.");
      // Only appinstalled confirms installation; an accepted prompt is not proof.
    } catch {
      setMessage("Instalimi nuk u verifikua. Provoni nga shfletuesi.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Instalimi i aplikacionit">
      {prompt && (
        <Button type="button" disabled={busy} onClick={() => void install()}>
          Instalo aplikacionin
        </Button>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
