CREATE TABLE public.order_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    kind text NOT NULL CHECK(kind IN ('modification','cancellation')),
    base_version_id uuid NOT NULL,
    proposed_version_id uuid,
    state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','accepted','rejected','withdrawn','closed')),
    requested_by uuid NOT NULL REFERENCES public.accounts(id),
    requested_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(requested_at)),
    decided_by uuid REFERENCES public.accounts(id),
    decided_at timestamptz,
    decision_reason text CHECK(decision_reason IS NULL OR btrim(decision_reason)<>''),
    close_cause text CHECK(close_cause IN ('order_cancelled')),
    revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
    FOREIGN KEY(order_id,clinic_id) REFERENCES public.orders(id,clinic_id),
    FOREIGN KEY(order_id,base_version_id) REFERENCES public.order_versions(order_id,id),
    FOREIGN KEY(order_id,proposed_version_id) REFERENCES public.order_versions(order_id,id),
    CHECK((kind='modification' AND proposed_version_id IS NOT NULL AND proposed_version_id<>base_version_id)
       OR (kind='cancellation' AND proposed_version_id IS NULL)),
    CHECK((state='pending' AND decided_by IS NULL AND decided_at IS NULL AND close_cause IS NULL)
       OR (state<>'pending' AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND isfinite(decided_at) AND decided_at>=requested_at)),
    CHECK((state='closed' AND close_cause IS NOT NULL) OR (state<>'closed' AND close_cause IS NULL)),
    CHECK(state<>'rejected' OR decision_reason IS NOT NULL)
);
CREATE UNIQUE INDEX order_requests_one_pending_idx ON public.order_requests(order_id) WHERE state='pending';

ALTER TABLE public.orders ADD CONSTRAINT orders_id_clinic_kind_status_unique UNIQUE(id,clinic_id,kind,status);
CREATE TABLE public.work_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_order_id uuid NOT NULL,
    child_order_id uuid NOT NULL UNIQUE,
    clinic_id uuid NOT NULL,
    kind text NOT NULL CHECK(kind IN ('resubmission','replacement','supplement','retouch')),
    intervention_kind text CHECK(intervention_kind IN ('retouch','remanufacture')),
    child_kind text GENERATED ALWAYS AS (CASE WHEN kind='retouch' THEN 'retouch' ELSE 'normal' END) STORED,
    child_current_status text NOT NULL,
    source_revision bigint NOT NULL CHECK(source_revision>0),
    source_status_at_creation text NOT NULL,
    created_by uuid NOT NULL REFERENCES public.accounts(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(created_at)),
    reason text CHECK(reason IS NULL OR btrim(reason)<>''),
    idempotency_receipt_id uuid UNIQUE REFERENCES public.submission_receipts(id),
    FOREIGN KEY(source_order_id,clinic_id) REFERENCES public.orders(id,clinic_id),
    FOREIGN KEY(child_order_id,clinic_id,child_kind,child_current_status)
        REFERENCES public.orders(id,clinic_id,kind,status) ON UPDATE CASCADE,
    CHECK(source_order_id<>child_order_id),
    CHECK((kind='retouch' AND intervention_kind IS NOT NULL) OR (kind<>'retouch' AND intervention_kind IS NULL)),
    CHECK((kind='resubmission' AND source_status_at_creation IN ('rejected','cancelled'))
       OR (kind IN ('replacement','supplement') AND source_status_at_creation IN ('manufacturing','completed','delivered'))
       OR (kind='retouch' AND source_status_at_creation='delivered')),
    CHECK(kind<>'replacement' OR reason IS NOT NULL)
);
CREATE UNIQUE INDEX work_links_one_active_retouch_idx ON public.work_links(source_order_id)
    WHERE kind='retouch' AND child_current_status IN ('pending','correction_requested','accepted','manufacturing','completed');
CREATE VIEW public.active_retouch_slots AS
    SELECT source_order_id,child_order_id,clinic_id FROM public.work_links
    WHERE kind='retouch' AND child_current_status IN ('pending','correction_requested','accepted','manufacturing','completed');
CREATE INDEX work_links_source_idx ON public.work_links(source_order_id);
