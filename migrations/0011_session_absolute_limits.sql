SELECT 1 / CASE WHEN NOT EXISTS(SELECT 1 FROM public.sessions) THEN 1 ELSE 0 END AS empty_sessions_required;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_id_account_expiry_unique UNIQUE(id,account_id,expires_at);
ALTER TABLE public.sessions ADD COLUMN parent_key uuid GENERATED ALWAYS AS (COALESCE(renewed_from_id,id)) STORED;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_id_account_parent_unique UNIQUE(id,account_id,parent_key);
CREATE TABLE public.session_limits (
    session_id uuid PRIMARY KEY,
    account_id uuid NOT NULL,
    expires_at timestamptz NOT NULL,
    absolute_expires_at timestamptz NOT NULL CHECK(isfinite(absolute_expires_at) AND absolute_expires_at>=expires_at),
    parent_key uuid NOT NULL,
    parent_limit_id uuid GENERATED ALWAYS AS (CASE WHEN parent_key=session_id THEN NULL ELSE parent_key END) STORED,
    UNIQUE(session_id,account_id),
    UNIQUE(session_id,account_id,absolute_expires_at),
    FOREIGN KEY(session_id,account_id,expires_at) REFERENCES public.sessions(id,account_id,expires_at),
    FOREIGN KEY(session_id,account_id,parent_key) REFERENCES public.sessions(id,account_id,parent_key),
    FOREIGN KEY(parent_limit_id,account_id,absolute_expires_at) REFERENCES public.session_limits(session_id,account_id,absolute_expires_at)
);
ALTER TABLE public.sessions ADD CONSTRAINT sessions_limit_required_fk
    FOREIGN KEY(id,account_id) REFERENCES public.session_limits(session_id,account_id) DEFERRABLE INITIALLY DEFERRED;
GRANT SELECT,INSERT ON public.session_limits TO dental_lab_app;
