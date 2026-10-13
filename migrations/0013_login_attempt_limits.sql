CREATE TABLE public.login_limit_guard (
    singleton smallint PRIMARY KEY CHECK(singleton=1),
    policy_digest bytea CHECK(policy_digest IS NULL OR octet_length(policy_digest)=32)
);
INSERT INTO public.login_limit_guard(singleton) VALUES (1);
CREATE TABLE public.login_attempt_limits (
    key_digest bytea PRIMARY KEY CHECK(octet_length(key_digest)=32),
    attempts integer NOT NULL CHECK(attempts>0),
    expires_at timestamptz NOT NULL CHECK(isfinite(expires_at))
);
CREATE INDEX login_attempt_limits_expiry_idx ON public.login_attempt_limits(expires_at);
GRANT SELECT ON public.login_limit_guard,public.login_attempt_limits TO dental_lab_app;
GRANT UPDATE(policy_digest) ON public.login_limit_guard TO dental_lab_app;
GRANT INSERT,DELETE ON public.login_attempt_limits TO dental_lab_app;
GRANT UPDATE(attempts) ON public.login_attempt_limits TO dental_lab_app;
