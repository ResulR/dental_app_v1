-- Preparation only: append-only encrypted intents, no delivery worker.
CREATE TABLE public.private_invitation_mail (
 message_id uuid PRIMARY KEY REFERENCES public.invitations(id),
 account_id uuid NOT NULL REFERENCES public.accounts(id),
 auth_epoch bigint NOT NULL CHECK(auth_epoch>=0),
 purpose text NOT NULL CHECK(purpose IN ('employee-invitation','admin-invitation')),
 expires_at_ms bigint NOT NULL CHECK(expires_at_ms>0 AND expires_at_ms<=8640000000000000),
 version integer NOT NULL CHECK(version=1),
 key_id text NOT NULL CHECK(key_id ~ '^[A-Za-z0-9_-]{1,64}$'),
 nonce bytea NOT NULL CHECK(octet_length(nonce)=12),
 tag bytea NOT NULL CHECK(octet_length(tag)=16),
 ciphertext bytea NOT NULL CHECK(octet_length(ciphertext)>0 AND octet_length(ciphertext)<=4096),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK(isfinite(created_at))
);
GRANT INSERT ON public.private_invitation_mail TO dental_lab_app;
