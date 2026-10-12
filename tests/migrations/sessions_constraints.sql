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
    INSERT INTO public.sessions(id,account_id,secret_digest,auth_epoch,expires_at) VALUES('a0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',decode(repeat('01',32),'hex'),0,CURRENT_TIMESTAMP+interval '10 minutes');
    INSERT INTO public.session_limits(session_id,account_id,expires_at,absolute_expires_at,parent_key) VALUES('a0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',CURRENT_TIMESTAMP+interval '10 minutes',CURRENT_TIMESTAMP+interval '1 hour','a0000000-0000-4000-8000-000000000001');
    INSERT INTO public.sessions(id,account_id,secret_digest,auth_epoch,expires_at,renewed_from_id) VALUES('a0000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',decode(repeat('02',32),'hex'),0,CURRENT_TIMESTAMP+interval '20 minutes','a0000000-0000-4000-8000-000000000001');
    INSERT INTO public.session_limits(session_id,account_id,expires_at,absolute_expires_at,parent_key) VALUES('a0000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',CURRENT_TIMESTAMP+interval '20 minutes',CURRENT_TIMESTAMP+interval '1 hour','a0000000-0000-4000-8000-000000000001');
    SET CONSTRAINTS ALL IMMEDIATE;

    FOR item IN SELECT * FROM (VALUES
        ('missing mandatory bound','INSERT INTO public.sessions(account_id,secret_digest,auth_epoch,expires_at) VALUES(''10000000-0000-4000-8000-000000000002'',decode(repeat(''03'',32),''hex''),0,CURRENT_TIMESTAMP+interval ''10 minutes'')','23503'),
        ('absolute bound below expiry','UPDATE public.session_limits SET absolute_expires_at=CURRENT_TIMESTAMP WHERE session_id=''a0000000-0000-4000-8000-000000000001''','23514'),
        ('child expands absolute bound','UPDATE public.session_limits SET absolute_expires_at=CURRENT_TIMESTAMP+interval ''2 hours'' WHERE session_id=''a0000000-0000-4000-8000-000000000002''','23503'),
        ('forged parent','UPDATE public.session_limits SET parent_key=''a0000000-0000-4000-8000-000000000002'' WHERE session_id=''a0000000-0000-4000-8000-000000000001''','23503'),
        ('wrong bound owner','UPDATE public.session_limits SET account_id=''10000000-0000-4000-8000-000000000003'' WHERE session_id=''a0000000-0000-4000-8000-000000000001''','23503')
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

    RAISE NOTICE 'sessions_constraints passed: % negative cases',successes;
END;
$schema_tests$;
