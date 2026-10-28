-- Prepared only. This migration does not authorize upload, publication or distribution.
CREATE TABLE public.file_validation_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id uuid NOT NULL REFERENCES public.upload_sessions(id),
    file_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    object_key text COLLATE "C" NOT NULL CHECK(object_key ~ '^[0-9a-f]{64}$'),
    size_bytes bigint NOT NULL CHECK(size_bytes>0 AND size_bytes<=200000000),
    content_sha256 bytea NOT NULL CHECK(octet_length(content_sha256)=32),
    policy_version text NOT NULL CHECK(btrim(policy_version)<>''),
    parser_version text,
    parser_reference text,
    scanner_version text,
    scanner_reference text,
    verdict text NOT NULL CHECK(verdict IN ('candidate','blocked')),
    reason text NOT NULL CHECK(reason IN ('checks_matched','checks_incomplete','object_changed')),
    final_state text NOT NULL DEFAULT 'verifying' CHECK(final_state='verifying'),
    occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(occurred_at)),
    FOREIGN KEY(file_id,clinic_id) REFERENCES public.file_objects(id,clinic_id),
    CHECK((verdict='candidate' AND reason='checks_matched'
       AND parser_version IS NOT NULL AND parser_reference IS NOT NULL
       AND scanner_version IS NOT NULL AND scanner_reference IS NOT NULL)
       OR (verdict='blocked' AND reason<>'checks_matched'
       AND parser_version IS NULL AND parser_reference IS NULL
       AND scanner_version IS NULL AND scanner_reference IS NULL)),
    CHECK(parser_version IS NULL OR btrim(parser_version)<>''),
    CHECK(scanner_version IS NULL OR btrim(scanner_version)<>''),
    CHECK(parser_reference IS NULL OR parser_reference ~ '^[a-zA-Z0-9._:-]{1,128}$'),
    CHECK(scanner_reference IS NULL OR scanner_reference ~ '^[a-zA-Z0-9._:-]{1,128}$')
);
CREATE INDEX file_validation_attempts_file_time_idx
    ON public.file_validation_attempts(file_id,occurred_at DESC,id);
-- No grant, runtime activation or state transition to ready in this migration.
