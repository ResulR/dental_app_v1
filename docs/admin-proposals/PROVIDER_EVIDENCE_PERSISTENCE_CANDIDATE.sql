-- CANDIDATE DESIGN ONLY. Not registered as a migration; NEVER run on production.
-- Requires an approved migration gate, isolated PostgreSQL reception and a
-- trusted provider/proof-storage design. No runtime grants in this proposal.
BEGIN;

-- The reservation must precede any possible provider handoff. The existing
-- notification_attempts row is a later outcome record and cannot serve as
-- the parent of an in-flight attempt. One row per reserved attempt.
CREATE TABLE public.notification_provider_attempt_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id uuid NOT NULL REFERENCES public.notification_deliveries(id),
    attempt_number integer NOT NULL CHECK (attempt_number > 0),
    provider_code text NOT NULL CHECK (provider_code ~ '^[A-Za-z0-9._:-]{1,128}$'),
    provider_account text NOT NULL CHECK (provider_account ~ '^[A-Za-z0-9._:-]{1,128}$'),
    key_version text NOT NULL CHECK (key_version ~ '^[A-Za-z0-9._-]{1,32}$'),
    idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[0-9a-f]{64}$'),
    reserved_at timestamptz NOT NULL DEFAULT clock_timestamp()
      CHECK (isfinite(reserved_at)),
    UNIQUE (delivery_id, attempt_number),
    UNIQUE (provider_code, provider_account, idempotency_key),
    UNIQUE (id, delivery_id)
);

-- Claimed values are untrusted. Authentication and correlation assessments
-- must be produced by a trusted adapter and recorded without UPDATE/DELETE.
-- proof_ref points to private durable storage; never a public URL or log value.
CREATE TABLE public.notification_provider_evidence_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_record_id uuid NOT NULL
      REFERENCES public.notification_provider_attempt_records(id),
    claimed_provider_code text,
    claimed_provider_account text,
    claimed_key_version text,
    claimed_idempotency_key text,
    claimed_provider_message_id text,
    claimed_status text,
    authentication_result text NOT NULL
      CHECK (authentication_result IN ('verified','unverified','unavailable')),
    authentication_method text,
    observed_at timestamptz,
    proof_ref text NOT NULL,
    proof_sha256 bytea NOT NULL CHECK (octet_length(proof_sha256) = 32),
    assessed_at timestamptz NOT NULL DEFAULT clock_timestamp()
      CHECK (isfinite(assessed_at)),
    assessment text NOT NULL
      CHECK (assessment IN ('acceptance_candidate','manual_review')),
    reason_code text NOT NULL CHECK (reason_code ~ '^[A-Z_]+$'),
    CHECK (observed_at IS NULL OR isfinite(observed_at)),
    CHECK (claimed_status IS NULL OR claimed_status IN
      ('accepted','rejected','ambiguous','not_found')),
    CHECK (authentication_result <> 'verified' OR
      (authentication_method IS NOT NULL AND observed_at IS NOT NULL)),
    CHECK (assessment <> 'acceptance_candidate' OR
      (authentication_result = 'verified' AND claimed_status = 'accepted'
       AND claimed_provider_message_id IS NOT NULL)),
    UNIQUE (proof_ref),
    UNIQUE (proof_sha256),
    UNIQUE (id, attempt_record_id)
);
CREATE INDEX notification_provider_evidence_attempt_idx
    ON public.notification_provider_evidence_records(attempt_record_id, assessed_at);

-- No app-role grants, triggers that claim provider authentication, state
-- transitions, or historical backfill. The future repository must serialize
-- against notification_deliveries, verify the lease and attempt number,
-- confirm the proof is durably available, insert the evidence and reconcile
-- the delivery in one DB transaction. A candidate alone never updates state.
COMMIT;
