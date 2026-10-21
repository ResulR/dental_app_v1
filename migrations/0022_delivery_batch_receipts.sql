-- Proposed only. Durable idempotency and consultable receipts; no patient data.
CREATE TABLE public.delivery_batch_receipts (
 id uuid PRIMARY KEY,
 actor_id uuid NOT NULL REFERENCES public.accounts(id),
 payload_hash bytea NOT NULL CHECK(octet_length(payload_hash)=32),
 result jsonb NOT NULL CHECK(jsonb_typeof(result)='object' AND (result->>'kind' IN ('pending','delivered')) IS TRUE),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK(isfinite(created_at))
);
CREATE INDEX delivery_batch_receipts_actor_created_idx ON public.delivery_batch_receipts(actor_id,created_at DESC);
-- The app may finalize its own pending insert within the delivery transaction only.
-- A finalized receipt cannot be rewritten, even by a direct app-role UPDATE.
CREATE FUNCTION public.guard_delivery_batch_receipt_finalization() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
 IF OLD.result->>'kind' <> 'pending' OR NEW.result->>'kind' <> 'delivered'
    OR NEW.result->>'receipt_id' <> OLD.id::text
    OR jsonb_typeof(NEW.result->'items') <> 'array'
    OR jsonb_array_length(NEW.result->'items') < 1
    OR NOT (NEW.result ? 'delivered_at') THEN
   RAISE EXCEPTION 'DELIVERY_BATCH_RECEIPT_IMMUTABLE' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER delivery_batch_receipt_finalization BEFORE UPDATE ON public.delivery_batch_receipts
FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_batch_receipt_finalization();
CREATE FUNCTION public.guard_delivery_batch_receipt_insert() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
 IF NEW.result->>'kind' <> 'pending' THEN
   RAISE EXCEPTION 'DELIVERY_BATCH_RECEIPT_MUST_START_PENDING' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER delivery_batch_receipt_insert BEFORE INSERT ON public.delivery_batch_receipts
FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_batch_receipt_insert();
-- A pending marker only serializes concurrent attempts; it may never survive COMMIT.
CREATE FUNCTION public.guard_delivery_batch_receipt_commit() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.delivery_batch_receipts
                WHERE id = NEW.id AND result->>'kind' = 'delivered') THEN
   RAISE EXCEPTION 'DELIVERY_BATCH_RECEIPT_PENDING_AT_COMMIT' USING ERRCODE = '23514';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER delivery_batch_receipt_commit
AFTER INSERT OR UPDATE ON public.delivery_batch_receipts DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_batch_receipt_commit();
GRANT SELECT, INSERT ON public.delivery_batch_receipts TO dental_lab_app;
GRANT UPDATE(result) ON public.delivery_batch_receipts TO dental_lab_app;
