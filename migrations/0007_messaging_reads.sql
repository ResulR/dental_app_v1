CREATE TABLE public.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id uuid NOT NULL REFERENCES public.clinics(id),
    kind text NOT NULL CHECK(kind IN ('general','order')),
    order_id uuid UNIQUE,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(created_at)),
    closed_at timestamptz CHECK(closed_at IS NULL OR (isfinite(closed_at) AND closed_at>=created_at)),
    revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
    last_message_seq bigint NOT NULL DEFAULT 0 CHECK(last_message_seq>=0),
    UNIQUE(id,clinic_id),
    FOREIGN KEY(order_id,clinic_id) REFERENCES public.orders(id,clinic_id),
    CHECK((kind='general' AND order_id IS NULL AND closed_at IS NULL) OR (kind='order' AND order_id IS NOT NULL))
);
CREATE UNIQUE INDEX conversations_one_general_idx ON public.conversations(clinic_id) WHERE kind='general';
CREATE TABLE public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    sequence_number bigint NOT NULL CHECK(sequence_number>0),
    sender_id uuid NOT NULL REFERENCES public.accounts(id),
    sender_side text NOT NULL CHECK(sender_side IN ('clinic','laboratory')),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(created_at)),
    current_version_id uuid NOT NULL,
    revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
    hidden_at timestamptz,
    hidden_by uuid REFERENCES public.accounts(id),
    idempotency_key text COLLATE "C" NOT NULL CHECK(btrim(idempotency_key)<>''),
    payload_fingerprint bytea NOT NULL CHECK(octet_length(payload_fingerprint)=32),
    UNIQUE(conversation_id,sequence_number),
    UNIQUE(sender_id,conversation_id,idempotency_key),
    UNIQUE(id,clinic_id),
    UNIQUE(id,sender_id),
    FOREIGN KEY(conversation_id,clinic_id) REFERENCES public.conversations(id,clinic_id),
    CHECK((hidden_at IS NULL AND hidden_by IS NULL) OR (hidden_at IS NOT NULL AND hidden_by IS NOT NULL AND hidden_by=sender_id AND isfinite(hidden_at) AND hidden_at>=created_at))
);
CREATE TABLE public.message_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    version_number bigint NOT NULL CHECK(version_number>0),
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(created_at)),
    body text,
    UNIQUE(message_id,version_number),
    UNIQUE(message_id,id),
    UNIQUE(id,clinic_id),
    FOREIGN KEY(message_id,clinic_id) REFERENCES public.messages(id,clinic_id),
    FOREIGN KEY(message_id,created_by) REFERENCES public.messages(id,sender_id)
);
ALTER TABLE public.messages ADD CONSTRAINT messages_current_version_fk
    FOREIGN KEY(id,current_version_id) REFERENCES public.message_versions(message_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE public.message_version_files (
    version_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    file_id uuid NOT NULL,
    PRIMARY KEY(version_id,file_id),
    FOREIGN KEY(version_id,clinic_id) REFERENCES public.message_versions(id,clinic_id),
    FOREIGN KEY(file_id,clinic_id) REFERENCES public.file_objects(id,clinic_id)
);
CREATE TABLE public.conversation_reads (
    conversation_id uuid NOT NULL REFERENCES public.conversations(id),
    side text NOT NULL CHECK(side IN ('clinic','laboratory')),
    last_read_seq bigint NOT NULL DEFAULT 0 CHECK(last_read_seq>=0),
    message_seq_ref bigint GENERATED ALWAYS AS (CASE WHEN last_read_seq>0 THEN last_read_seq ELSE NULL END) STORED,
    read_by uuid REFERENCES public.accounts(id),
    read_at timestamptz,
    revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
    PRIMARY KEY(conversation_id,side),
    FOREIGN KEY(conversation_id,message_seq_ref) REFERENCES public.messages(conversation_id,sequence_number),
    CHECK((last_read_seq=0 AND read_by IS NULL AND read_at IS NULL)
       OR (last_read_seq>0 AND read_by IS NOT NULL AND read_at IS NOT NULL AND isfinite(read_at)))
);
CREATE TABLE public.message_reminder_cycles (
    conversation_id uuid NOT NULL,
    side text NOT NULL,
    cycle_id uuid NOT NULL DEFAULT gen_random_uuid(),
    last_reminded_seq bigint NOT NULL DEFAULT 0 CHECK(last_reminded_seq>=0),
    message_seq_ref bigint GENERATED ALWAYS AS (CASE WHEN last_reminded_seq>0 THEN last_reminded_seq ELSE NULL END) STORED,
    last_reminder_at timestamptz,
    first_unread_at timestamptz CHECK(first_unread_at IS NULL OR isfinite(first_unread_at)),
    revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
    PRIMARY KEY(conversation_id,side),
    FOREIGN KEY(conversation_id,side) REFERENCES public.conversation_reads(conversation_id,side),
    FOREIGN KEY(conversation_id,message_seq_ref) REFERENCES public.messages(conversation_id,sequence_number),
    CHECK((last_reminded_seq=0 AND last_reminder_at IS NULL)
       OR (last_reminded_seq>0 AND last_reminder_at IS NOT NULL AND isfinite(last_reminder_at)))
);
ALTER TABLE public.upload_sessions ADD COLUMN intended_conversation_id uuid;
ALTER TABLE public.upload_sessions ADD CONSTRAINT upload_conversation_clinic_fk
    FOREIGN KEY(intended_conversation_id,clinic_id) REFERENCES public.conversations(id,clinic_id);
ALTER TABLE public.upload_sessions ADD CONSTRAINT upload_message_destination_required
    CHECK((intended_kind='message' AND intended_conversation_id IS NOT NULL) OR (intended_kind<>'message' AND intended_conversation_id IS NULL));
