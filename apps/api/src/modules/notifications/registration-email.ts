// Provider-independent Albanian copy. No patient data or personal coordinates.
export function registrationEmail(origin: string): {
  subject: string;
  text: string;
} {
  const url = new URL(origin);
  if (
    url.protocol !== "https:" ||
    url.origin !== origin ||
    url.username ||
    url.password
  )
    throw new Error("INVALID_NOTIFICATION_ORIGIN");
  return {
    subject: "Kërkesë e re për regjistrimin e një klinike",
    text:
      "Një klinikë ka kërkuar regjistrimin. Hyni në portal për të shqyrtuar kërkesën. Regjistrimi nuk është miratuar automatikisht.\n\n" +
      url.href,
  };
}
