DO $schema_tests$
DECLARE item record; actual_state text; successes integer:=0;
BEGIN
    IF current_database()<>'dental_lab' OR current_user<>'dental_lab_migrator' OR current_setting('server_version_num')::int/10000<>17 THEN RAISE EXCEPTION 'WRONG_TEST_TARGET'; END IF;
    IF EXISTS(SELECT 1 FROM public.accounts) THEN RAISE EXCEPTION 'FIXTURE_REQUIRES_EMPTY_BASE'; END IF;
    SET CONSTRAINTS ALL DEFERRED;
    INSERT INTO public.accounts(id,profile,email_original,email_key,lifecycle) VALUES
      ('10000000-0000-4000-8000-000000000001','owner','owner@example.invalid','owner@example.invalid','active'),
      ('10000000-0000-4000-8000-000000000002','clinic','clinic1@example.invalid','clinic1@example.invalid','active'),
      ('10000000-0000-4000-8000-000000000003','clinic','clinic2@example.invalid','clinic2@example.invalid','active');
    INSERT INTO public.owner_slot(singleton,account_id) VALUES(1,'10000000-0000-4000-8000-000000000001');
    INSERT INTO public.clinics(id,account_id,name,dentist_first_name,dentist_last_name,phone,address) VALUES
      ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Fixture one','Fake','One','+000','Test'),
      ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','Fixture two','Fake','Two','+000','Test');
    INSERT INTO public.catalog_reference_snapshots(id,kind,label) VALUES
      ('30000000-0000-4000-8000-000000000001','material','Fixture material'),
      ('30000000-0000-4000-8000-000000000002','shade','Fixture shade'),
      ('30000000-0000-4000-8000-000000000003','work_type','Fixture type');
    INSERT INTO public.orders(id,clinic_id,kind,origin,created_by,status,current_version_id) VALUES
      ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','normal','clinic','10000000-0000-4000-8000-000000000002','accepted','60000000-0000-4000-8000-000000000001'),
      ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','normal','clinic','10000000-0000-4000-8000-000000000003','pending','60000000-0000-4000-8000-000000000002'),
      ('40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','retouch','clinic','10000000-0000-4000-8000-000000000002','pending','60000000-0000-4000-8000-000000000003');
    INSERT INTO public.order_versions(id,order_id,clinic_id,order_kind,order_origin,version_number,created_by,patient_reference,material_snapshot_id,shade_snapshot_id,requested_delivery_date,description) VALUES
      ('60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','normal','clinic',1,'10000000-0000-4000-8000-000000000002','FIXTURE-A','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002',CURRENT_DATE,NULL),
      ('60000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','normal','clinic',1,'10000000-0000-4000-8000-000000000003','FIXTURE-B','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002',CURRENT_DATE,NULL),
      ('60000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','retouch','clinic',1,'10000000-0000-4000-8000-000000000002','FIXTURE-A','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002',NULL,'Fixture problem and concerned teeth');
    SET CONSTRAINTS ALL IMMEDIATE;
    SET CONSTRAINTS ALL DEFERRED;
    INSERT INTO public.drafts(id,account_id,clinic_id) VALUES('90000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001');
    INSERT INTO public.draft_revisions(draft_id,account_id,clinic_id,revision,payload) VALUES('90000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',1,'{}');
    SET CONSTRAINTS ALL IMMEDIATE;
    SET LOCAL ROLE dental_lab_app;
    IF current_user<>'dental_lab_app' OR has_schema_privilege(current_user,'public','CREATE') OR has_database_privilege(current_user,'dental_lab','TEMP') THEN RAISE EXCEPTION 'APP_IDENTITY_OR_DDL_PRIVILEGES_INVALID'; END IF;
    PERFORM id FROM public.accounts;
    INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id) VALUES('10000000-0000-4000-8000-000000000002','ORDER_STATE_CHANGED','order','40000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001');
    UPDATE public.orders SET status='delivered',manufacturing_version_id=current_version_id WHERE id='40000000-0000-4000-8000-000000000001';
    INSERT INTO public.work_links(source_order_id,child_order_id,clinic_id,kind,intervention_kind,child_current_status,source_revision,source_status_at_creation,created_by) VALUES('40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','retouch','retouch','pending',1,'delivered','10000000-0000-4000-8000-000000000002');
    UPDATE public.orders SET status='cancelled' WHERE id='40000000-0000-4000-8000-000000000003';
    IF EXISTS(SELECT 1 FROM public.active_retouch_slots) OR NOT EXISTS(SELECT 1 FROM public.work_links) THEN RAISE EXCEPTION 'CASCADE_NOT_AUTHORIZED_OR_HISTORY_LOST'; END IF;
    SET CONSTRAINTS ALL DEFERRED;
    INSERT INTO public.orders(id,clinic_id,kind,origin,created_by,status,current_version_id) VALUES('40000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','normal','laboratory','10000000-0000-4000-8000-000000000002','accepted','60000000-0000-4000-8000-000000000004');
    INSERT INTO public.order_versions(id,order_id,clinic_id,order_kind,order_origin,version_number,created_by,patient_reference,material_snapshot_id,shade_snapshot_id) VALUES('60000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','normal','laboratory',1,'10000000-0000-4000-8000-000000000002','FIXTURE-APP','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002');
    EXECUTE $cas_query$WITH changed AS (
 UPDATE public.drafts
 SET revision=revision+1,updated_at=CURRENT_TIMESTAMP
 WHERE id='90000000-0000-4000-8000-000000000001' AND account_id='10000000-0000-4000-8000-000000000002' AND clinic_id='20000000-0000-4000-8000-000000000001'
   AND revision=1 AND state='active'
 RETURNING id,account_id,clinic_id,revision
), history AS (
 INSERT INTO public.draft_revisions(draft_id,account_id,clinic_id,revision,schema_version,payload)
 SELECT id,account_id,clinic_id,revision,1,'{}'::jsonb FROM changed
 RETURNING draft_id,account_id,clinic_id,revision
)
INSERT INTO public.draft_sync_receipts(account_id,clinic_id,draft_id,committed_revision,action,idempotency_key,payload_fingerprint)
SELECT account_id,clinic_id,draft_id,revision,'save','fixture-cas',decode(repeat('01',32),'hex') FROM history
RETURNING draft_id,committed_revision::text AS revision$cas_query$ INTO item;
    IF item.revision IS DISTINCT FROM '2' THEN RAISE EXCEPTION 'CAS_RESULT_INVALID'; END IF;
    SET CONSTRAINTS ALL IMMEDIATE;

    FOR item IN SELECT * FROM (VALUES
        ('schema DDL','CREATE TABLE public.privilege_denied_probe(id integer)','42501'),
        ('temporary DDL','CREATE TEMP TABLE privilege_denied_probe(id integer)','42501'),
        ('alter ownership table','ALTER TABLE public.orders ADD COLUMN forbidden_probe integer','42501'),
        ('audit update','UPDATE public.audit_events SET action=''ORDER_SUBMITTED''','42501'),
        ('audit delete','DELETE FROM public.audit_events','42501'),
        ('audit truncate','TRUNCATE public.audit_events','42501'),
        ('version rewrite','UPDATE public.order_versions SET description=''forbidden''','42501'),
        ('history tooth removal','DELETE FROM public.order_version_teeth','42501'),
        ('snapshot rewrite','UPDATE public.catalog_reference_snapshots SET label=''forbidden''','42501'),
        ('filiation rewrite','UPDATE public.work_links SET source_revision=2','42501'),
        ('profile escalation','UPDATE public.accounts SET profile=''owner''','42501'),
        ('owner slot insert','INSERT INTO public.owner_slot(singleton,account_id) VALUES(1,''10000000-0000-4000-8000-000000000002'')','42501'),
        ('permission definition rewrite','INSERT INTO public.permission_definitions(code,prerequisite_key) VALUES(''AUDIT_READ'','''')','42501'),
        ('reception time rewrite','UPDATE public.orders SET received_at=CURRENT_TIMESTAMP','42501')
    ) AS cases(label,statement,wanted_state) LOOP
        BEGIN
            EXECUTE item.statement;
            RAISE EXCEPTION 'NEGATIVE_CASE_DID_NOT_FAIL';
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS actual_state=RETURNED_SQLSTATE;
            IF actual_state<>item.wanted_state THEN RAISE EXCEPTION 'Constraint case % expected % received %',item.label,item.wanted_state,actual_state; END IF;
        END;
        successes:=successes+1;
    END LOOP;
    SET LOCAL ROLE "dental-ai";
    FOR item IN SELECT * FROM (VALUES
        ('audit cannot read accounts','SELECT * FROM public.accounts','42501'),
        ('audit cannot insert','INSERT INTO public.catalog_entries(reference_id,label) VALUES(''30000000-0000-4000-8000-000000000001'',''forbidden'')','42501'),
        ('audit cannot DDL','CREATE TABLE public.audit_denied_probe(id integer)','42501')
    ) AS cases(label,statement,wanted_state) LOOP
        BEGIN
            EXECUTE item.statement;
            RAISE EXCEPTION 'NEGATIVE_CASE_DID_NOT_FAIL';
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS actual_state=RETURNED_SQLSTATE;
            IF actual_state<>item.wanted_state THEN RAISE EXCEPTION 'Audit case % expected % received %',item.label,item.wanted_state,actual_state; END IF;
        END;
        successes:=successes+1;
    END LOOP;
    SET LOCAL ROLE dental_lab_migrator;

    RAISE NOTICE 'privileges_constraints passed: % negative cases',successes;
END;
$schema_tests$;
