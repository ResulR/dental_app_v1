DO $orders_tests$
DECLARE item record; actual_state text; successes integer:=0;
BEGIN
    IF current_database()<>'dental_lab' OR current_user<>'dental_lab_migrator' OR current_setting('server_version_num')::int/10000<>17 THEN RAISE EXCEPTION 'WRONG_TEST_TARGET'; END IF;
    IF EXISTS(SELECT 1 FROM public.accounts) OR EXISTS(SELECT 1 FROM public.orders) OR EXISTS(SELECT 1 FROM public.catalog_reference_snapshots) THEN RAISE EXCEPTION 'FIXTURE_REQUIRES_EMPTY_BASE'; END IF;
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
    IF EXISTS(SELECT 1 FROM public.order_version_teeth) THEN RAISE EXCEPTION 'ZERO_TEETH_NOT_PRESERVED'; END IF;
    INSERT INTO public.order_version_teeth(version_id,order_id,clinic_id,fdi,selection) VALUES('60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',11,'normal');
    INSERT INTO public.submission_receipts(account_id,intent,idempotency_key,payload_fingerprint,order_id,clinic_id) VALUES('10000000-0000-4000-8000-000000000002','submit','fixture-intent',decode(repeat('01',32),'hex'),'40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001');
    INSERT INTO public.order_versions(order_id,clinic_id,order_kind,order_origin,version_number,created_by,patient_first_name,patient_last_name,material_snapshot_id,shade_snapshot_id,requested_delivery_date)
      VALUES('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','normal','clinic',2,'10000000-0000-4000-8000-000000000002','Fake','Patient','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002',CURRENT_DATE);
    IF (SELECT count(*) FROM public.order_versions WHERE order_id='40000000-0000-4000-8000-000000000001')<>2 THEN RAISE EXCEPTION 'VERSION_HISTORY_LOST'; END IF;
    FOR item IN SELECT * FROM (VALUES
        ('patient missing','UPDATE public.order_versions SET patient_reference=NULL WHERE id=''60000000-0000-4000-8000-000000000001''','23514'),
        ('clinic date missing','UPDATE public.order_versions SET requested_delivery_date=NULL WHERE id=''60000000-0000-4000-8000-000000000001''','23514'),
        ('retouch description missing','UPDATE public.order_versions SET description='' '' WHERE order_kind=''retouch''','23514'),
        ('wrong snapshot category','UPDATE public.order_versions SET material_snapshot_id=''30000000-0000-4000-8000-000000000003'' WHERE id=''60000000-0000-4000-8000-000000000001''','23503'),
        ('invalid FDI','INSERT INTO public.order_version_teeth(version_id,order_id,clinic_id,fdi,selection) VALUES(''60000000-0000-4000-8000-000000000001'',''40000000-0000-4000-8000-000000000001'',''20000000-0000-4000-8000-000000000001'',19,''normal'')','23514'),
        ('duplicate tooth','INSERT INTO public.order_version_teeth(version_id,order_id,clinic_id,fdi,selection) VALUES(''60000000-0000-4000-8000-000000000001'',''40000000-0000-4000-8000-000000000001'',''20000000-0000-4000-8000-000000000001'',11,''normal'')','23505'),
        ('retouch FDI','INSERT INTO public.order_version_teeth(version_id,order_id,clinic_id,fdi,selection) VALUES(''60000000-0000-4000-8000-000000000003'',''40000000-0000-4000-8000-000000000003'',''20000000-0000-4000-8000-000000000001'',11,''normal'')','23503'),
        ('foreign current version','UPDATE public.orders SET current_version_id=''60000000-0000-4000-8000-000000000002'' WHERE id=''40000000-0000-4000-8000-000000000001''','23503'),
        ('foreign clinic','UPDATE public.order_versions SET clinic_id=''20000000-0000-4000-8000-000000000002'' WHERE id=''60000000-0000-4000-8000-000000000001''','23503'),
        ('manufacturing missing lock','UPDATE public.orders SET status=''manufacturing'' WHERE id=''40000000-0000-4000-8000-000000000001''','23514'),
        ('version zero','UPDATE public.order_versions SET version_number=0 WHERE id=''60000000-0000-4000-8000-000000000001''','23514'),
        ('invalid delivery','INSERT INTO public.order_logistics(order_id,clinic_id,delivered_at) VALUES(''40000000-0000-4000-8000-000000000001'',''20000000-0000-4000-8000-000000000001'',CURRENT_TIMESTAMP)','23514'),
        ('decision without reason','INSERT INTO public.order_status_events(order_id,clinic_id,next_status,actor_id,aggregate_revision) VALUES(''40000000-0000-4000-8000-000000000001'',''20000000-0000-4000-8000-000000000001'',''cancelled'',''10000000-0000-4000-8000-000000000002'',1)','23514'),
        ('double intention','INSERT INTO public.submission_receipts(account_id,intent,idempotency_key,payload_fingerprint,order_id,clinic_id) VALUES(''10000000-0000-4000-8000-000000000002'',''submit'',''fixture-intent'',decode(repeat(''01'',32),''hex''),''40000000-0000-4000-8000-000000000001'',''20000000-0000-4000-8000-000000000001'')','23505'),
        ('invalid fingerprint','UPDATE public.submission_receipts SET payload_fingerprint=decode(''01'',''hex'')','23514')
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
    RAISE NOTICE 'orders_constraints passed: % negative cases; zero teeth and version history preserved',successes;
END;
$orders_tests$;
