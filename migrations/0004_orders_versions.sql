ALTER TABLE public.catalog_reference_snapshots ADD CONSTRAINT catalog_snapshots_id_kind_unique UNIQUE(id,kind);

CREATE TABLE public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    number bigint GENERATED ALWAYS AS IDENTITY UNIQUE NOT NULL CHECK(number>0),
    clinic_id uuid NOT NULL REFERENCES public.clinics(id),
    kind text NOT NULL CHECK(kind IN ('normal','retouch')),
    origin text NOT NULL CHECK(origin IN ('clinic','laboratory')),
    created_by uuid NOT NULL REFERENCES public.accounts(id),
    received_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(received_at)),
    status text NOT NULL CHECK(status IN ('pending','correction_requested','rejected','accepted','manufacturing','completed','delivered','cancelled')),
    revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
    current_version_id uuid NOT NULL,
    manufacturing_version_id uuid,
    UNIQUE(id,clinic_id),
    UNIQUE(id,clinic_id,kind,origin),
    CHECK(status NOT IN ('manufacturing','completed','delivered') OR manufacturing_version_id IS NOT NULL)
);

CREATE TABLE public.order_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    order_kind text NOT NULL,
    order_origin text NOT NULL,
    version_number bigint NOT NULL CHECK(version_number>0),
    created_by uuid NOT NULL REFERENCES public.accounts(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(created_at)),
    reason text CHECK(reason IS NULL OR btrim(reason)<>''),
    patient_first_name text CHECK(patient_first_name IS NULL OR btrim(patient_first_name)<>''),
    patient_last_name text CHECK(patient_last_name IS NULL OR btrim(patient_last_name)<>''),
    patient_reference text CHECK(patient_reference IS NULL OR btrim(patient_reference)<>''),
    material_snapshot_id uuid NOT NULL,
    shade_snapshot_id uuid NOT NULL,
    work_type_snapshot_id uuid,
    material_kind text GENERATED ALWAYS AS ('material'::text) STORED,
    shade_kind text GENERATED ALWAYS AS ('shade'::text) STORED,
    work_type_kind text GENERATED ALWAYS AS ('work_type'::text) STORED,
    description text,
    requested_delivery_date date CHECK(requested_delivery_date IS NULL OR isfinite(requested_delivery_date)),
    UNIQUE(order_id,version_number),
    UNIQUE(order_id,id),
    UNIQUE(id,clinic_id),
    UNIQUE(id,order_id,clinic_id,order_kind),
    FOREIGN KEY(order_id,clinic_id,order_kind,order_origin) REFERENCES public.orders(id,clinic_id,kind,origin),
    FOREIGN KEY(material_snapshot_id,material_kind) REFERENCES public.catalog_reference_snapshots(id,kind),
    FOREIGN KEY(shade_snapshot_id,shade_kind) REFERENCES public.catalog_reference_snapshots(id,kind),
    FOREIGN KEY(work_type_snapshot_id,work_type_kind) REFERENCES public.catalog_reference_snapshots(id,kind),
    CHECK(patient_reference IS NOT NULL OR (patient_first_name IS NOT NULL AND patient_last_name IS NOT NULL)),
    CHECK(order_kind<>'normal' OR order_origin<>'clinic' OR requested_delivery_date IS NOT NULL),
    CHECK(order_kind<>'retouch' OR (description IS NOT NULL AND btrim(description)<>''))
);
ALTER TABLE public.orders ADD CONSTRAINT orders_current_version_fk
    FOREIGN KEY(id,current_version_id) REFERENCES public.order_versions(order_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.orders ADD CONSTRAINT orders_manufacturing_version_fk
    FOREIGN KEY(id,manufacturing_version_id) REFERENCES public.order_versions(order_id,id);

CREATE TABLE public.order_version_teeth (
    version_id uuid NOT NULL,
    order_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    order_kind text GENERATED ALWAYS AS ('normal'::text) STORED,
    fdi smallint NOT NULL CHECK(fdi BETWEEN 11 AND 18 OR fdi BETWEEN 21 AND 28 OR fdi BETWEEN 31 AND 38 OR fdi BETWEEN 41 AND 48),
    selection text NOT NULL CHECK(selection IN ('normal','pontic')),
    PRIMARY KEY(version_id,fdi),
    FOREIGN KEY(version_id,order_id,clinic_id,order_kind) REFERENCES public.order_versions(id,order_id,clinic_id,order_kind)
);

CREATE TABLE public.order_logistics (
    order_id uuid PRIMARY KEY,
    clinic_id uuid NOT NULL,
    planned_delivery_date date CHECK(planned_delivery_date IS NULL OR isfinite(planned_delivery_date)),
    priority boolean NOT NULL DEFAULT false,
    delivery_mode text CHECK(delivery_mode IN ('laboratory_delivery','clinic_pickup','external_courier')),
    delivered_at timestamptz CHECK(delivered_at IS NULL OR isfinite(delivered_at)),
    delivered_by uuid REFERENCES public.accounts(id),
    archive_due_at timestamptz CHECK(archive_due_at IS NULL OR isfinite(archive_due_at)),
    revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
    FOREIGN KEY(order_id,clinic_id) REFERENCES public.orders(id,clinic_id),
    CHECK((delivered_at IS NULL AND delivered_by IS NULL AND archive_due_at IS NULL)
       OR (delivered_at IS NOT NULL AND delivered_by IS NOT NULL AND delivery_mode IS NOT NULL AND archive_due_at IS NOT NULL AND archive_due_at>delivered_at))
);

CREATE TABLE public.order_status_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    previous_status text CHECK(previous_status IN ('pending','correction_requested','rejected','accepted','manufacturing','completed','delivered','cancelled')),
    next_status text NOT NULL CHECK(next_status IN ('pending','correction_requested','rejected','accepted','manufacturing','completed','delivered','cancelled')),
    actor_id uuid NOT NULL REFERENCES public.accounts(id),
    occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(occurred_at)),
    reason text CHECK(reason IS NULL OR btrim(reason)<>''),
    decided_version_id uuid,
    aggregate_revision bigint NOT NULL CHECK(aggregate_revision>0),
    FOREIGN KEY(order_id,clinic_id) REFERENCES public.orders(id,clinic_id),
    FOREIGN KEY(order_id,decided_version_id) REFERENCES public.order_versions(order_id,id),
    UNIQUE(order_id,aggregate_revision),
    CHECK(previous_status IS NULL OR previous_status<>next_status),
    CHECK((next_status NOT IN ('correction_requested','rejected','cancelled') AND NOT(previous_status='delivered' AND next_status='completed')) OR reason IS NOT NULL)
);
CREATE INDEX order_status_events_order_time_idx ON public.order_status_events(order_id,occurred_at);

CREATE TABLE public.order_logistics_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    actor_id uuid NOT NULL REFERENCES public.accounts(id),
    occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(occurred_at)),
    before_values jsonb NOT NULL CHECK(jsonb_typeof(before_values)='object'),
    after_values jsonb NOT NULL CHECK(jsonb_typeof(after_values)='object'),
    reason text CHECK(reason IS NULL OR btrim(reason)<>''),
    FOREIGN KEY(order_id,clinic_id) REFERENCES public.orders(id,clinic_id)
);

CREATE TABLE public.order_security_blocks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    reference_id uuid NOT NULL REFERENCES public.catalog_references(id),
    reason text NOT NULL CHECK(btrim(reason)<>''),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(created_at)),
    created_by uuid NOT NULL REFERENCES public.accounts(id),
    cleared_at timestamptz,
    cleared_by uuid REFERENCES public.accounts(id),
    clearance_reason text,
    FOREIGN KEY(order_id,clinic_id) REFERENCES public.orders(id,clinic_id),
    CHECK((cleared_at IS NULL AND cleared_by IS NULL AND clearance_reason IS NULL)
       OR (cleared_at IS NOT NULL AND isfinite(cleared_at) AND cleared_at>=created_at AND cleared_by IS NOT NULL AND clearance_reason IS NOT NULL AND btrim(clearance_reason)<>''))
);
CREATE UNIQUE INDEX order_security_active_reference_idx ON public.order_security_blocks(order_id,reference_id) WHERE cleared_at IS NULL;

CREATE TABLE public.submission_receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES public.accounts(id),
    intent text NOT NULL CHECK(btrim(intent)<>''),
    idempotency_key text COLLATE "C" NOT NULL CHECK(btrim(idempotency_key)<>''),
    payload_fingerprint bytea NOT NULL CHECK(octet_length(payload_fingerprint)=32),
    order_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    committed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(committed_at)),
    FOREIGN KEY(order_id,clinic_id) REFERENCES public.orders(id,clinic_id),
    UNIQUE(account_id,intent,idempotency_key)
);
CREATE INDEX orders_clinic_status_idx ON public.orders(clinic_id,status);
