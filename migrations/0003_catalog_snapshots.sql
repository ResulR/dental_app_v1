CREATE TABLE public.catalog_references (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind text NOT NULL CHECK (kind IN ('material','shade','work_type')),
    use_state text NOT NULL DEFAULT 'available' CHECK (use_state IN ('available','unavailable','forbidden')),
    forbidden_reason text,
    revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK (isfinite(created_at)),
    changed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK (isfinite(changed_at) AND changed_at >= created_at),
    changed_by uuid REFERENCES public.accounts(id),
    CONSTRAINT catalog_reference_kind_unique UNIQUE (id,kind),
    CONSTRAINT catalog_forbidden_reason_required CHECK (
        use_state <> 'forbidden' OR (forbidden_reason IS NOT NULL AND btrim(forbidden_reason) <> '')
    )
);

CREATE TABLE public.catalog_entries (
    reference_id uuid PRIMARY KEY REFERENCES public.catalog_references(id),
    label text NOT NULL CHECK (btrim(label) <> ''),
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.catalog_reference_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id uuid,
    kind text NOT NULL CHECK (kind IN ('material','shade','work_type')),
    label text NOT NULL CHECK (btrim(label) <> ''),
    source_revision bigint CHECK (source_revision IS NULL OR source_revision > 0),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK (isfinite(created_at)),
    CONSTRAINT catalog_snapshot_reference_kind_fk FOREIGN KEY (reference_id,kind)
        REFERENCES public.catalog_references(id,kind),
    CONSTRAINT catalog_snapshot_source_pair CHECK (
        (reference_id IS NULL AND source_revision IS NULL)
        OR (reference_id IS NOT NULL AND source_revision IS NOT NULL)
    )
);
CREATE INDEX catalog_snapshots_reference_idx ON public.catalog_reference_snapshots(reference_id,kind);

CREATE VIEW public.catalog_effective_states AS
    SELECT r.id,r.kind,r.use_state,r.revision,r.forbidden_reason,e.label,e.is_active,
        CASE WHEN r.use_state='forbidden' THEN 'forbidden'
             WHEN e.reference_id IS NULL OR NOT e.is_active THEN 'unavailable'
             ELSE r.use_state END AS effective_use_state
    FROM public.catalog_references r
    LEFT JOIN public.catalog_entries e ON e.reference_id=r.id;
