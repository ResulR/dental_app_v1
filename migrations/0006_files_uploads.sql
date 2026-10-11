CREATE TABLE public.file_objects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id uuid NOT NULL REFERENCES public.clinics(id),
    created_by uuid NOT NULL REFERENCES public.accounts(id),
    object_key text COLLATE "C" NOT NULL UNIQUE CHECK(object_key ~ '^[0-9a-f]{64}$'),
    filename_original text NOT NULL CHECK(btrim(filename_original)<>''),
    format text NOT NULL CHECK(format IN ('stl','ply','obj','jpg','png','heic','pdf')),
    media_type_verified text CHECK(media_type_verified IS NULL OR btrim(media_type_verified)<>''),
    size_bytes bigint NOT NULL CHECK(size_bytes>0 AND size_bytes<=200000000),
    content_sha256 bytea CHECK(content_sha256 IS NULL OR octet_length(content_sha256)=32),
    state text NOT NULL CHECK(state IN ('verifying','ready','rejected','quarantined','purged')),
    storage_policy_version text NOT NULL CHECK(btrim(storage_policy_version)<>''),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(created_at)),
    verified_at timestamptz CHECK(verified_at IS NULL OR (isfinite(verified_at) AND verified_at>=created_at)),
    UNIQUE(id,clinic_id),
    CHECK(state<>'ready' OR (media_type_verified IS NOT NULL AND content_sha256 IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE TABLE public.upload_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES public.accounts(id),
    clinic_id uuid NOT NULL REFERENCES public.clinics(id),
    intended_kind text NOT NULL CHECK(intended_kind IN ('initial_order','order_version','followup','message','draft')),
    intended_order_id uuid,
    declared_size bigint NOT NULL CHECK(declared_size>0 AND declared_size<=200000000),
    chunk_size bigint NOT NULL CHECK(chunk_size>0 AND chunk_size<=200000000),
    received_bytes bigint NOT NULL DEFAULT 0 CHECK(received_bytes>=0 AND received_bytes<=declared_size),
    state text NOT NULL DEFAULT 'initialized' CHECK(state IN ('initialized','receiving','verifying','ready','rejected','expired','aborted')),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(created_at)),
    expires_at timestamptz NOT NULL CHECK(isfinite(expires_at) AND expires_at>created_at),
    capacity_policy_version text NOT NULL CHECK(btrim(capacity_policy_version)<>''),
    reserved_bytes bigint NOT NULL CHECK(reserved_bytes>=declared_size),
    file_id uuid,
    revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
    UNIQUE(id,clinic_id,declared_size,chunk_size),
    FOREIGN KEY(intended_order_id,clinic_id) REFERENCES public.orders(id,clinic_id),
    FOREIGN KEY(file_id,clinic_id) REFERENCES public.file_objects(id,clinic_id),
    CHECK(state<>'ready' OR (file_id IS NOT NULL AND received_bytes=declared_size))
);
CREATE TABLE public.upload_chunks (
    upload_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    declared_size bigint NOT NULL,
    chunk_size bigint NOT NULL,
    segment_index integer NOT NULL CHECK(segment_index>=0),
    byte_offset bigint GENERATED ALWAYS AS (segment_index::bigint*chunk_size) STORED,
    size_bytes bigint NOT NULL,
    sha256 bytea NOT NULL CHECK(octet_length(sha256)=32),
    verified_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(verified_at)),
    PRIMARY KEY(upload_id,segment_index),
    FOREIGN KEY(upload_id,clinic_id,declared_size,chunk_size) REFERENCES public.upload_sessions(id,clinic_id,declared_size,chunk_size),
    CHECK(byte_offset>=0 AND byte_offset<declared_size),
    CHECK(size_bytes=LEAST(chunk_size,declared_size-byte_offset) AND size_bytes>0)
);
ALTER TABLE public.order_versions ADD CONSTRAINT order_versions_id_order_clinic_unique UNIQUE(id,order_id,clinic_id);
CREATE TABLE public.order_version_files (
    version_id uuid NOT NULL,
    order_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    file_id uuid NOT NULL,
    attached_by uuid NOT NULL REFERENCES public.accounts(id),
    attached_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(attached_at)),
    PRIMARY KEY(version_id,file_id),
    FOREIGN KEY(version_id,order_id,clinic_id) REFERENCES public.order_versions(id,order_id,clinic_id),
    FOREIGN KEY(file_id,clinic_id) REFERENCES public.file_objects(id,clinic_id)
);
CREATE TABLE public.order_followup_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    file_id uuid NOT NULL,
    created_by uuid NOT NULL REFERENCES public.accounts(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(created_at)),
    shared_with_clinic boolean NOT NULL DEFAULT false,
    changed_by uuid NOT NULL REFERENCES public.accounts(id),
    changed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(changed_at) AND changed_at>=created_at),
    revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
    UNIQUE(order_id,file_id),
    FOREIGN KEY(order_id,clinic_id) REFERENCES public.orders(id,clinic_id),
    FOREIGN KEY(file_id,clinic_id) REFERENCES public.file_objects(id,clinic_id)
);
CREATE TABLE public.file_derivatives (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    kind text NOT NULL CHECK(kind IN ('preview','thumbnail')),
    object_key text COLLATE "C" NOT NULL UNIQUE CHECK(object_key ~ '^[0-9a-f]{64}$'),
    size_bytes bigint NOT NULL CHECK(size_bytes>0),
    sha256 bytea NOT NULL CHECK(octet_length(sha256)=32),
    state text NOT NULL CHECK(state IN ('verifying','ready','rejected','purged')),
    FOREIGN KEY(file_id,clinic_id) REFERENCES public.file_objects(id,clinic_id)
);
CREATE TABLE public.file_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id uuid REFERENCES public.file_objects(id),
    upload_id uuid REFERENCES public.upload_sessions(id),
    actor_id uuid REFERENCES public.accounts(id),
    process_code text CHECK(process_code IS NULL OR process_code ~ '^[a-z_]+$'),
    action text NOT NULL CHECK(action ~ '^[a-z_]+$'),
    occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(occurred_at)),
    CHECK((file_id IS NOT NULL AND upload_id IS NULL) OR (file_id IS NULL AND upload_id IS NOT NULL)),
    CHECK((actor_id IS NOT NULL AND process_code IS NULL) OR (actor_id IS NULL AND process_code IS NOT NULL))
);
CREATE INDEX upload_sessions_account_state_idx ON public.upload_sessions(account_id,state);
