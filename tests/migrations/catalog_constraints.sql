DO $catalog_tests$
DECLARE
    item record;
    actual_state text;
    successes integer := 0;
BEGIN
    IF current_database()<>'dental_lab' OR current_user<>'dental_lab_migrator'
       OR current_setting('server_version_num')::int/10000<>17 THEN
        RAISE EXCEPTION 'CATALOG_TEST_WRONG_TARGET';
    END IF;
    IF EXISTS (SELECT 1 FROM public.catalog_references)
       OR EXISTS (SELECT 1 FROM public.catalog_reference_snapshots) THEN
        RAISE EXCEPTION 'CATALOG_TEST_REQUIRES_EMPTY_TABLES';
    END IF;
    INSERT INTO public.catalog_references(id,kind) VALUES
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','material'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','shade'),('cccccccc-cccc-4ccc-8ccc-cccccccccccc','work_type');
    INSERT INTO public.catalog_entries(reference_id,label) VALUES
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Fixture material original'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Fixture shade'),('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Fixture work type');
    INSERT INTO public.catalog_reference_snapshots(reference_id,kind,label,source_revision)
        SELECT r.id,r.kind,e.label,r.revision FROM public.catalog_references r
        JOIN public.catalog_entries e ON e.reference_id=r.id WHERE r.kind IN ('material','shade');
    UPDATE public.catalog_entries SET label='Fixture material renamed' WHERE reference_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    UPDATE public.catalog_references SET revision=revision+1 WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    IF NOT EXISTS (SELECT 1 FROM public.catalog_reference_snapshots
        WHERE reference_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND label='Fixture material original' AND source_revision=1) THEN
        RAISE EXCEPTION 'CATALOG_RENAME_CHANGED_HISTORY';
    END IF;
    UPDATE public.catalog_entries SET is_active=false WHERE reference_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    IF NOT EXISTS (SELECT 1 FROM public.catalog_effective_states
        WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' AND effective_use_state='unavailable') THEN
        RAISE EXCEPTION 'CATALOG_DISABLED_STILL_AVAILABLE';
    END IF;
    UPDATE public.catalog_references SET use_state='forbidden',forbidden_reason='Fixture safety reason' WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    DELETE FROM public.catalog_entries WHERE reference_id IN ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    IF (SELECT count(*) FROM public.catalog_reference_snapshots)<>2
       OR NOT EXISTS (SELECT 1 FROM public.catalog_reference_snapshots
           WHERE reference_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND label='Fixture material original' AND source_revision=1)
       OR NOT EXISTS (SELECT 1 FROM public.catalog_effective_states
           WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND effective_use_state='forbidden' AND forbidden_reason='Fixture safety reason')
       OR NOT EXISTS (SELECT 1 FROM public.catalog_effective_states
           WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' AND effective_use_state='unavailable') THEN
        RAISE EXCEPTION 'CATALOG_DELETION_LOST_HISTORY_OR_SAFETY';
    END IF;
    INSERT INTO public.catalog_reference_snapshots(kind,label) VALUES ('work_type','Fixture label-only history');
    FOR item IN SELECT * FROM (VALUES
        ('unknown kind','INSERT INTO public.catalog_references(kind) VALUES (''patient'')','23514'),
        ('unknown state','UPDATE public.catalog_references SET use_state=''retired'' WHERE id=''cccccccc-cccc-4ccc-8ccc-cccccccccccc''','23514'),
        ('ban missing reason','UPDATE public.catalog_references SET use_state=''forbidden'',forbidden_reason=NULL WHERE id=''cccccccc-cccc-4ccc-8ccc-cccccccccccc''','23514'),
        ('ban blank reason','UPDATE public.catalog_references SET use_state=''forbidden'',forbidden_reason='' '' WHERE id=''cccccccc-cccc-4ccc-8ccc-cccccccccccc''','23514'),
        ('blank live label','UPDATE public.catalog_entries SET label='' ''','23514'),
        ('orphan live entry','INSERT INTO public.catalog_entries(reference_id,label) VALUES (''dddddddd-dddd-4ddd-8ddd-dddddddddddd'',''Fixture orphan'')','23503'),
        ('snapshot wrong kind','INSERT INTO public.catalog_reference_snapshots(reference_id,kind,label,source_revision) VALUES (''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''shade'',''Fixture mismatch'',1)','23503'),
        ('snapshot blank label','INSERT INTO public.catalog_reference_snapshots(reference_id,kind,label,source_revision) VALUES (''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''material'','' '',1)','23514'),
        ('snapshot orphan reference','INSERT INTO public.catalog_reference_snapshots(reference_id,kind,label,source_revision) VALUES (''dddddddd-dddd-4ddd-8ddd-dddddddddddd'',''material'',''Fixture orphan'',1)','23503'),
        ('delete used durable reference','DELETE FROM public.catalog_references WHERE id=''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa''','23503'),
        ('invalid live revision','UPDATE public.catalog_references SET revision=0 WHERE id=''cccccccc-cccc-4ccc-8ccc-cccccccccccc''','23514'),
        ('invalid snapshot revision','INSERT INTO public.catalog_reference_snapshots(reference_id,kind,label,source_revision) VALUES (''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''material'',''Fixture invalid'',0)','23514'),
        ('snapshot reference without revision','INSERT INTO public.catalog_reference_snapshots(reference_id,kind,label) VALUES (''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''material'',''Fixture missing revision'')','23514'),
        ('snapshot revision without reference','INSERT INTO public.catalog_reference_snapshots(kind,label,source_revision) VALUES (''material'',''Fixture missing reference'',1)','23514'),
        ('unknown actor','UPDATE public.catalog_references SET changed_by=''dddddddd-dddd-4ddd-8ddd-dddddddddddd'' WHERE id=''cccccccc-cccc-4ccc-8ccc-cccccccccccc''','23503')
    ) AS cases(label,statement,wanted_state)
    LOOP
        BEGIN
            EXECUTE item.statement;
            RAISE EXCEPTION 'NEGATIVE_CASE_DID_NOT_FAIL';
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS actual_state = RETURNED_SQLSTATE;
            IF actual_state<>item.wanted_state THEN
                RAISE EXCEPTION 'Catalog constraint case %: expected %, received %',
                    item.label,item.wanted_state,actual_state;
            END IF;
        END;
        successes := successes+1;
    END LOOP;
    IF successes<>15 THEN RAISE EXCEPTION 'CATALOG_TEST_COUNT_MISMATCH'; END IF;
    RAISE NOTICE 'catalog_constraints passed: % negative cases; rename/deletion preserve history and ban',successes;
END;
$catalog_tests$;
