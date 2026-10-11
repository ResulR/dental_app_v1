CREATE TABLE public.accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile text NOT NULL CHECK (profile IN ('owner','admin','employee','clinic')),
    email_original text NOT NULL CHECK (btrim(email_original) <> ''),
    email_key text COLLATE "C" NOT NULL UNIQUE CHECK (btrim(email_key) <> ''),
    lifecycle text NOT NULL CHECK (lifecycle IN ('invited','active','suspended')),
    security_locked boolean NOT NULL DEFAULT false,
    credential_reset_required boolean NOT NULL DEFAULT false,
    auth_epoch bigint NOT NULL DEFAULT 0 CHECK (auth_epoch >= 0),
    revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK (isfinite(created_at)),
    owner_slot_ref smallint GENERATED ALWAYS AS (1) STORED,
    owner_marker smallint GENERATED ALWAYS AS (CASE WHEN profile='owner' THEN 1 ELSE NULL END) STORED,
    clinic_marker uuid GENERATED ALWAYS AS (CASE WHEN profile='clinic' THEN id ELSE NULL END) STORED,
    CONSTRAINT accounts_id_profile_unique UNIQUE (id,profile),
    CONSTRAINT accounts_owner_active CHECK (profile <> 'owner' OR lifecycle='active')
);
CREATE UNIQUE INDEX accounts_one_owner ON public.accounts(profile) WHERE profile='owner';

CREATE TABLE public.owner_slot (
    singleton smallint PRIMARY KEY CHECK (singleton=1),
    account_id uuid NOT NULL UNIQUE,
    profile text GENERATED ALWAYS AS ('owner'::text) STORED,
    CONSTRAINT owner_slot_pair_unique UNIQUE (singleton,account_id),
    CONSTRAINT owner_slot_account_fk FOREIGN KEY (account_id,profile)
        REFERENCES public.accounts(id,profile) DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE public.accounts ADD CONSTRAINT accounts_owner_slot_fk
    FOREIGN KEY (owner_slot_ref) REFERENCES public.owner_slot(singleton) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_owner_pair_fk
    FOREIGN KEY (owner_marker,id) REFERENCES public.owner_slot(singleton,account_id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE public.clinics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL UNIQUE,
    account_profile text GENERATED ALWAYS AS ('clinic'::text) STORED,
    name text NOT NULL CHECK (btrim(name) <> ''),
    dentist_first_name text NOT NULL CHECK (btrim(dentist_first_name) <> ''),
    dentist_last_name text NOT NULL CHECK (btrim(dentist_last_name) <> ''),
    phone text NOT NULL CHECK (btrim(phone) <> ''),
    address text NOT NULL CHECK (btrim(address) <> ''),
    review_state text NOT NULL DEFAULT 'pending' CHECK (review_state IN ('pending','approved','refused')),
    suspended boolean NOT NULL DEFAULT false,
    revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK (isfinite(created_at)),
    CONSTRAINT clinics_account_profile_fk FOREIGN KEY (account_id,account_profile)
        REFERENCES public.accounts(id,profile) DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE public.accounts ADD CONSTRAINT accounts_clinic_pair_fk
    FOREIGN KEY (clinic_marker) REFERENCES public.clinics(account_id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE public.credentials (
    account_id uuid PRIMARY KEY REFERENCES public.accounts(id),
    password_hash text NOT NULL CHECK (btrim(password_hash) <> ''),
    changed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK (isfinite(changed_at))
);

CREATE TABLE public.sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES public.accounts(id),
    secret_digest bytea NOT NULL UNIQUE CHECK (octet_length(secret_digest)=32),
    auth_epoch bigint NOT NULL CHECK (auth_epoch >= 0),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK (isfinite(created_at)),
    expires_at timestamptz NOT NULL CHECK (isfinite(expires_at) AND expires_at > created_at),
    revoked_at timestamptz CHECK (revoked_at IS NULL OR (isfinite(revoked_at) AND revoked_at >= created_at)),
    renewed_from_id uuid,
    CONSTRAINT sessions_id_account_unique UNIQUE (id,account_id),
    CONSTRAINT sessions_no_self_renewal CHECK (renewed_from_id IS NULL OR renewed_from_id<>id),
    CONSTRAINT sessions_renewal_account_fk FOREIGN KEY (renewed_from_id,account_id)
        REFERENCES public.sessions(id,account_id)
);
CREATE INDEX sessions_account_active_idx ON public.sessions(account_id) WHERE revoked_at IS NULL;

CREATE TABLE public.invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL,
    created_by uuid NOT NULL REFERENCES public.accounts(id),
    target_email text NOT NULL CHECK (btrim(target_email) <> ''),
    purpose text NOT NULL CHECK (purpose IN ('admin','employee')),
    token_digest bytea NOT NULL UNIQUE CHECK (octet_length(token_digest)=32),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK (isfinite(created_at)),
    expires_at timestamptz NOT NULL CHECK (isfinite(expires_at) AND expires_at > created_at),
    consumed_at timestamptz,
    revoked_at timestamptz,
    CONSTRAINT invitations_profile_fk FOREIGN KEY (account_id,purpose) REFERENCES public.accounts(id,profile),
    CONSTRAINT invitations_consumed_time CHECK (consumed_at IS NULL OR (isfinite(consumed_at) AND consumed_at >= created_at AND consumed_at < expires_at)),
    CONSTRAINT invitations_revoked_time CHECK (revoked_at IS NULL OR (isfinite(revoked_at) AND revoked_at >= created_at)),
    CONSTRAINT invitations_single_terminal CHECK (consumed_at IS NULL OR revoked_at IS NULL)
);
CREATE UNIQUE INDEX invitations_one_pending ON public.invitations(account_id)
    WHERE consumed_at IS NULL AND revoked_at IS NULL;
CREATE INDEX invitations_creator_idx ON public.invitations(created_by);

CREATE TABLE public.permission_definitions (
    code text PRIMARY KEY CHECK (code IN ('orders.read_logistics','orders.read_details','files.view','files.download','messaging.order.read','messaging.order.reply','messaging.general.read','messaging.general.reply','orders.accept','orders.reject','orders.request_correction','orders.edit_instructions','orders.start_manufacturing','orders.create_for_clinic','orders.cancel','orders.change_status','delivery.plan','delivery.set_priority','delivery.mark_delivered','delivery.correct','linked_works.manage','files.add_followup','files.share_followup','catalog.manage','clinics.manage','employees.create','employees.suspend','employees.manage_permissions','settings.manage')),
    prerequisite_key text NOT NULL,
    prerequisite_code text GENERATED ALWAYS AS (NULLIF(prerequisite_key,'')) STORED,
    CONSTRAINT permission_pair_unique UNIQUE (code,prerequisite_key),
    CONSTRAINT permission_no_self CHECK (code<>prerequisite_key),
    CONSTRAINT permission_parent_fk FOREIGN KEY (prerequisite_code)
        REFERENCES public.permission_definitions(code) DEFERRABLE INITIALLY DEFERRED
);
INSERT INTO public.permission_definitions(code,prerequisite_key) VALUES
    ('orders.read_logistics',''),
    ('orders.read_details','orders.read_logistics'),
    ('files.view',''),
    ('files.download',''),
    ('messaging.order.read','orders.read_logistics'),
    ('messaging.order.reply','messaging.order.read'),
    ('messaging.general.read',''),
    ('messaging.general.reply','messaging.general.read'),
    ('orders.accept','orders.read_details'),
    ('orders.reject','orders.read_details'),
    ('orders.request_correction','orders.read_details'),
    ('orders.edit_instructions','orders.read_details'),
    ('orders.start_manufacturing','orders.read_details'),
    ('orders.create_for_clinic','orders.read_details'),
    ('orders.cancel','orders.read_logistics'),
    ('orders.change_status','orders.read_logistics'),
    ('delivery.plan','orders.read_logistics'),
    ('delivery.set_priority','orders.read_logistics'),
    ('delivery.mark_delivered','orders.read_logistics'),
    ('delivery.correct','orders.read_logistics'),
    ('linked_works.manage','orders.read_details'),
    ('files.add_followup','files.view'),
    ('files.share_followup','files.view'),
    ('catalog.manage',''),
    ('clinics.manage',''),
    ('employees.create',''),
    ('employees.suspend',''),
    ('employees.manage_permissions',''),
    ('settings.manage','');

CREATE VIEW public.permission_prerequisites AS
    SELECT code AS permission_code, prerequisite_code
    FROM public.permission_definitions WHERE prerequisite_code IS NOT NULL;

CREATE TABLE public.account_grants (
    account_id uuid NOT NULL,
    account_profile text NOT NULL CHECK (account_profile IN ('admin','employee')),
    permission_code text NOT NULL,
    prerequisite_key text NOT NULL,
    required_permission text GENERATED ALWAYS AS (NULLIF(prerequisite_key,'')) STORED,
    created_by uuid NOT NULL REFERENCES public.accounts(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK (isfinite(created_at)),
    PRIMARY KEY (account_id,permission_code),
    CONSTRAINT grants_account_profile_fk FOREIGN KEY (account_id,account_profile) REFERENCES public.accounts(id,profile),
    CONSTRAINT grants_definition_fk FOREIGN KEY (permission_code,prerequisite_key)
        REFERENCES public.permission_definitions(code,prerequisite_key),
    CONSTRAINT grants_prerequisite_fk FOREIGN KEY (account_id,required_permission)
        REFERENCES public.account_grants(account_id,permission_code) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE public.employee_delegation_limits (
    delegator_account_id uuid NOT NULL,
    delegator_profile text GENERATED ALWAYS AS ('admin'::text) STORED,
    permission_code text NOT NULL REFERENCES public.permission_definitions(code),
    created_by uuid NOT NULL REFERENCES public.accounts(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK (isfinite(created_at)),
    PRIMARY KEY (delegator_account_id,permission_code),
    CONSTRAINT delegation_admin_fk FOREIGN KEY (delegator_account_id,delegator_profile)
        REFERENCES public.accounts(id,profile)
);
