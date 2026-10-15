-- Proposal only; owner-only application workflow. Never applied by dental-ai.
CREATE TABLE public.admin_management_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 target_account_id uuid NOT NULL REFERENCES public.accounts(id),
 actor_id uuid NOT NULL REFERENCES public.accounts(id),
 operation text NOT NULL CHECK (operation IN ('suspend','reactivate','permissions')),
 previous_revision bigint NOT NULL CHECK (previous_revision > 0),
 aggregate_revision bigint NOT NULL CHECK (aggregate_revision = previous_revision + 1),
 request_id uuid NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 previous_state jsonb NOT NULL CHECK (jsonb_typeof(previous_state) = 'object'),
 next_state jsonb NOT NULL CHECK (jsonb_typeof(next_state) = 'object'),
 UNIQUE(target_account_id,aggregate_revision)
);
GRANT SELECT,INSERT ON public.admin_management_events TO dental_lab_app;
