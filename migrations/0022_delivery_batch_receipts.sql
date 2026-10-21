-- Proposed only. Durable idempotency and consultable receipts; no patient data.
CREATE TABLE public.delivery_batch_receipts (
 id uuid PRIMARY KEY,
 actor_id uuid NOT NULL REFERENCES public.accounts(id),
 payload_hash bytea NOT NULL CHECK(octet_length(payload_hash)=32),
 delivered_at timestamptz NOT NULL CHECK(isfinite(delivered_at)),
 result jsonb NOT NULL CHECK(jsonb_typeof(result)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK(isfinite(created_at))
);
CREATE INDEX delivery_batch_receipts_actor_created_idx ON public.delivery_batch_receipts(actor_id,created_at DESC);
GRANT SELECT, INSERT ON public.delivery_batch_receipts TO dental_lab_app;
GRANT UPDATE(result) ON public.delivery_batch_receipts TO dental_lab_app;
