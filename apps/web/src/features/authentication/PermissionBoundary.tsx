import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createAuthClient } from "./auth-api.js";
import type { SessionIdentity } from "./auth-api.js";
const client = createAuthClient();
type Snapshot = NonNullable<Awaited<ReturnType<typeof client.permissions>>>;
export function PermissionBoundary({
  identity,
  children,
}: {
  identity: SessionIdentity;
  children: ReactNode;
}) {
  const [loaded, setLoaded] = useState<{
    accountKey: string;
    snapshot: Snapshot | null;
  } | null>(null);
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    void client.permissions(controller.signal).then((snapshot) => {
      if (current)
        setLoaded({
          accountKey: identity.account_id + ":" + identity.profile,
          snapshot,
        });
    });
    return () => {
      current = false;
      controller.abort();
    };
  }, [identity]);
  // Revalidation must not discard an unchanged, unsaved form every 30 seconds.
  // Switches of identity hide immediately; revoked/failed reads unmount controls.
  // Display state never authorizes mutations: each server transaction rechecks.
  if (loaded?.accountKey !== identity.account_id + ":" + identity.profile)
    return <p role="status">Po kontrollohen lejet…</p>;
  const snapshot = loaded.snapshot;
  if (
    !snapshot ||
    snapshot.account_id !== identity.account_id ||
    snapshot.profile !== identity.profile
  )
    return (
      <p role="status">
        Lejet nuk u konfirmuan. Verifikoni lidhjen për të provuar përsëri.
      </p>
    );
  if (
    identity.profile !== "clinic" &&
    !snapshot.permissions.includes("clinics.manage")
  )
    return <p>Nuk keni leje për menaxhimin e klinikave.</p>;
  return children;
}
