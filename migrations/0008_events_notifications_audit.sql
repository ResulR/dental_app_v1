CREATE TABLE public.outbox_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version>0),
    type text NOT NULL CHECK(type IN ('order_submitted','clinic_registered','order_accepted','correction_requested','order_rejected','order_completed','modification_requested','cancellation_requested','retouch_requested','correction_resubmitted','request_decided','request_withdrawn','order_cancelled','instructions_changed','laboratory_order_created','manufacturing_started','order_delivered','delivery_corrected','logistics_changed','message_created','message_edited','message_hidden','conversation_read','file_shared','file_revoked','account_changed','permissions_changed','catalog_changed','settings_changed','maintenance_changed','security_alert','technical_alert','draft_changed')),
    aggregate_type text NOT NULL CHECK(aggregate_type IN ('order','clinic','account','catalog_reference','conversation','message','file','draft','settings','process')),
    aggregate_id uuid NOT NULL,
    aggregate_revision bigint NOT NULL CHECK(aggregate_revision>0),
    clinic_id uuid REFERENCES public.clinics(id),
    actor_id uuid REFERENCES public.accounts(id),
    process_code text CHECK(process_code IS NULL OR process_code ~ '^[a-z_]+$'),
    occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(occurred_at)),
    correlation_id uuid NOT NULL,
    CHECK((actor_id IS NOT NULL AND process_code IS NULL) OR (actor_id IS NULL AND process_code IS NOT NULL)),
    UNIQUE(aggregate_type,aggregate_id,aggregate_revision,type)
);
CREATE TABLE public.outbox_dispatches (
    event_id uuid PRIMARY KEY REFERENCES public.outbox_events(id),
    state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','dispatched','failed')),
    attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
    next_attempt_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(next_attempt_at)),
    lease_id uuid,
    lease_until timestamptz,
    CHECK((lease_id IS NULL AND lease_until IS NULL) OR (lease_id IS NOT NULL AND lease_until IS NOT NULL AND isfinite(lease_until)))
);
CREATE TABLE public.internal_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES public.outbox_events(id),
    target_account_id uuid NOT NULL REFERENCES public.accounts(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(created_at)),
    read_at timestamptz CHECK(read_at IS NULL OR (isfinite(read_at) AND read_at>=created_at)),
    UNIQUE(event_id,target_account_id)
);
CREATE TABLE public.email_category_recipients (
    category text NOT NULL CHECK(category IN ('order_submitted','clinic_registered','modification_requested','cancellation_requested','retouch_requested','correction_resubmitted')),
    account_id uuid NOT NULL,
    account_profile text GENERATED ALWAYS AS ('admin'::text) STORED,
    changed_by uuid NOT NULL REFERENCES public.accounts(id),
    PRIMARY KEY(category,account_id),
    FOREIGN KEY(account_id,account_profile) REFERENCES public.accounts(id,profile)
);
CREATE TABLE public.notification_deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES public.outbox_events(id),
    target_account_id uuid NOT NULL REFERENCES public.accounts(id),
    channel text NOT NULL CHECK(channel IN ('email','technical')),
    purpose text NOT NULL CHECK(purpose IN ('business','message_reminder','security','technical')),
    state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','provider_accepted','failed','cancelled')),
    attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
    next_attempt_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(next_attempt_at)),
    lease_id uuid,
    lease_until timestamptz,
    provider_id text CHECK(provider_id IS NULL OR btrim(provider_id)<>''),
    cancellation_code text CHECK(cancellation_code IS NULL OR cancellation_code ~ '^[A-Z_]+$'),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(created_at)),
    UNIQUE(event_id,target_account_id,channel,purpose),
    CHECK((lease_id IS NULL AND lease_until IS NULL) OR (lease_id IS NOT NULL AND lease_until IS NOT NULL AND isfinite(lease_until))),
    CHECK(state<>'provider_accepted' OR provider_id IS NOT NULL),
    CHECK(state<>'cancelled' OR cancellation_code IS NOT NULL)
);
CREATE TABLE public.notification_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id uuid NOT NULL REFERENCES public.notification_deliveries(id),
    attempt_number integer NOT NULL CHECK(attempt_number>0),
    occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(occurred_at)),
    result text NOT NULL CHECK(result IN ('provider_accepted','temporary_error','permanent_error','ambiguous')),
    error_code text CHECK(error_code IS NULL OR error_code ~ '^[A-Z_]+$'),
    UNIQUE(delivery_id,attempt_number)
);
CREATE TABLE public.audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid REFERENCES public.accounts(id),
    process_code text CHECK(process_code IS NULL OR process_code ~ '^[a-z_]+$'),
    occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(occurred_at)),
    action text NOT NULL CHECK(action ~ '^[A-Z_]+$'),
    object_type text NOT NULL CHECK(object_type IN ('order','clinic','account','catalog_reference','conversation','message','file','draft','settings','process')),
    object_id uuid NOT NULL,
    request_id uuid NOT NULL,
    aggregate_revision bigint CHECK(aggregate_revision IS NULL OR aggregate_revision>0),
    reason_code text CHECK(reason_code IS NULL OR reason_code ~ '^[A-Z_]+$'),
    changed_fields text[] NOT NULL DEFAULT '{}' CHECK(changed_fields <@ ARRAY['status','version','permissions','lifecycle','delivery_date','priority','catalog_state','email','file_visibility','maintenance']::text[]),
    CHECK((actor_id IS NOT NULL AND process_code IS NULL) OR (actor_id IS NULL AND process_code IS NOT NULL))
);
CREATE INDEX outbox_dispatches_due_idx ON public.outbox_dispatches(next_attempt_at) WHERE state='pending';
CREATE INDEX notification_deliveries_due_idx ON public.notification_deliveries(next_attempt_at) WHERE state='pending';
CREATE INDEX audit_events_time_idx ON public.audit_events(occurred_at,id);
