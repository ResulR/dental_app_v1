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
    INSERT INTO public.draft_revisions(id,draft_id,account_id,clinic_id,revision,payload) VALUES('a0000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',1,'{}');
    SET CONSTRAINTS ALL IMMEDIATE;
    INSERT INTO public.draft_sync_receipts(account_id,clinic_id,draft_id,committed_revision,action,idempotency_key,payload_fingerprint) VALUES('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001',1,'save','fixture-save',decode(repeat('01',32),'hex'));

    FOR item IN SELECT * FROM (VALUES
        ('foreign draft owner','UPDATE public.drafts SET account_id=''10000000-0000-4000-8000-000000000003'' WHERE id=''90000000-0000-4000-8000-000000000001''','23503'),
        ('nonexistent current revision','UPDATE public.drafts SET revision=2 WHERE id=''90000000-0000-4000-8000-000000000001''','23503'),
        ('duplicate revision','INSERT INTO public.draft_revisions(draft_id,account_id,clinic_id,revision,payload) VALUES(''90000000-0000-4000-8000-000000000001'',''10000000-0000-4000-8000-000000000002'',''20000000-0000-4000-8000-000000000001'',1,''{}'')','23505'),
        ('unapproved vault secret key','UPDATE public.draft_revisions SET payload=''{"recovery_code":"fixture"}'' WHERE id=''a0000000-0000-4000-8000-000000000001''','23514'),
        ('deleted without tombstone','UPDATE public.drafts SET state=''deleted'' WHERE id=''90000000-0000-4000-8000-000000000001''','23514'),
        ('duplicate sync intent','INSERT INTO public.draft_sync_receipts(account_id,clinic_id,draft_id,committed_revision,action,idempotency_key,payload_fingerprint) SELECT account_id,clinic_id,draft_id,committed_revision,action,idempotency_key,payload_fingerprint FROM public.draft_sync_receipts','23505'),
        ('wrong revision owner','UPDATE public.draft_revisions SET account_id=''10000000-0000-4000-8000-000000000003'' WHERE id=''a0000000-0000-4000-8000-000000000001''','23503'),
        ('clone same draft','INSERT INTO public.draft_conflicts(draft_id,account_id,clinic_id,base_revision,server_revision,resolution,cloned_draft_id,resolved_at) VALUES(''90000000-0000-4000-8000-000000000001'',''10000000-0000-4000-8000-000000000002'',''20000000-0000-4000-8000-000000000001'',0,1,''clone_local'',''90000000-0000-4000-8000-000000000001'',CURRENT_TIMESTAMP)','23514'),
        ('orphan conflict version','INSERT INTO public.draft_conflicts(draft_id,account_id,clinic_id,base_revision,server_revision) VALUES(''90000000-0000-4000-8000-000000000001'',''10000000-0000-4000-8000-000000000002'',''20000000-0000-4000-8000-000000000001'',0,99)','23503')
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
    SET CONSTRAINTS ALL DEFERRED;
    UPDATE public.drafts SET revision=revision+1 WHERE id='90000000-0000-4000-8000-000000000001' AND revision=1 AND state='active';
    INSERT INTO public.draft_revisions(draft_id,account_id,clinic_id,revision,payload) VALUES('90000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',2,'{"description":"Fixture revision two"}');
    SET CONSTRAINTS ALL IMMEDIATE;
    UPDATE public.drafts SET revision=revision+1 WHERE id='90000000-0000-4000-8000-000000000001' AND revision=1 AND state='active';
    IF FOUND THEN RAISE EXCEPTION 'STALE_REVISION_OVERWROTE_CURRENT'; END IF;
    UPDATE public.drafts SET state='deleted',deleted_at=CURRENT_TIMESTAMP WHERE id='90000000-0000-4000-8000-000000000001';
    IF (SELECT count(*) FROM public.draft_revisions WHERE draft_id='90000000-0000-4000-8000-000000000001')<>2 THEN RAISE EXCEPTION 'DRAFT_HISTORY_LOST'; END IF;

    RAISE NOTICE 'drafts_constraints passed: % negative cases',successes;
END;
$schema_tests$;
