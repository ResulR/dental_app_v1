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
    UPDATE public.orders SET status='delivered',manufacturing_version_id=current_version_id WHERE id='40000000-0000-4000-8000-000000000001';
    SET CONSTRAINTS ALL DEFERRED;
    INSERT INTO public.orders(id,clinic_id,kind,origin,created_by,status,current_version_id) VALUES('40000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','retouch','clinic','10000000-0000-4000-8000-000000000002','rejected','60000000-0000-4000-8000-000000000004');
    INSERT INTO public.order_versions(id,order_id,clinic_id,order_kind,order_origin,version_number,created_by,patient_reference,material_snapshot_id,shade_snapshot_id,description)
      SELECT '60000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000004',clinic_id,order_kind,order_origin,1,created_by,patient_reference,material_snapshot_id,shade_snapshot_id,description FROM public.order_versions WHERE order_kind='retouch';
    SET CONSTRAINTS ALL IMMEDIATE;
    INSERT INTO public.order_requests(id,order_id,clinic_id,kind,base_version_id,requested_by) VALUES('70000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','cancellation','60000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002');
    INSERT INTO public.work_links(id,source_order_id,child_order_id,clinic_id,kind,intervention_kind,child_current_status,source_revision,source_status_at_creation,created_by) VALUES
      ('80000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','retouch','retouch','pending',1,'delivered','10000000-0000-4000-8000-000000000002'),
      ('80000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','retouch','remanufacture','rejected',1,'delivered','10000000-0000-4000-8000-000000000002');

    FOR item IN SELECT * FROM (VALUES
        ('one pending across kinds','INSERT INTO public.order_requests(order_id,clinic_id,kind,base_version_id,requested_by) SELECT order_id,clinic_id,kind,base_version_id,requested_by FROM public.order_requests WHERE id=''70000000-0000-4000-8000-000000000001''','23505'),
        ('foreign base','UPDATE public.order_requests SET base_version_id=''60000000-0000-4000-8000-000000000001'' WHERE id=''70000000-0000-4000-8000-000000000001''','23503'),
        ('modification missing proposal','UPDATE public.order_requests SET kind=''modification'' WHERE id=''70000000-0000-4000-8000-000000000001''','23514'),
        ('pending decided','UPDATE public.order_requests SET decided_by=''10000000-0000-4000-8000-000000000002'' WHERE id=''70000000-0000-4000-8000-000000000001''','23514'),
        ('rejection missing reason','UPDATE public.order_requests SET state=''rejected'',decided_by=''10000000-0000-4000-8000-000000000002'',decided_at=CURRENT_TIMESTAMP WHERE id=''70000000-0000-4000-8000-000000000001''','23514'),
        ('self link','UPDATE public.work_links SET source_order_id=child_order_id WHERE id=''80000000-0000-4000-8000-000000000001''','23514'),
        ('interclinic link','UPDATE public.work_links SET source_order_id=''40000000-0000-4000-8000-000000000002'' WHERE id=''80000000-0000-4000-8000-000000000001''','23503'),
        ('retouch wrong source status','UPDATE public.work_links SET source_status_at_creation=''accepted'' WHERE id=''80000000-0000-4000-8000-000000000001''','23514'),
        ('retouch qualifier missing','UPDATE public.work_links SET intervention_kind=NULL WHERE id=''80000000-0000-4000-8000-000000000001''','23514'),
        ('duplicate active retouch','UPDATE public.orders SET status=''pending'' WHERE id=''40000000-0000-4000-8000-000000000004''','23505'),
        ('status projection forged','UPDATE public.work_links SET child_current_status=''rejected'' WHERE id=''80000000-0000-4000-8000-000000000001''','23503')
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
    UPDATE public.orders SET status='cancelled' WHERE id='40000000-0000-4000-8000-000000000003';
    UPDATE public.orders SET status='pending' WHERE id='40000000-0000-4000-8000-000000000004';
    IF (SELECT count(*) FROM public.active_retouch_slots WHERE source_order_id='40000000-0000-4000-8000-000000000001')<>1 OR (SELECT count(*) FROM public.work_links WHERE source_order_id='40000000-0000-4000-8000-000000000001')<>2 THEN RAISE EXCEPTION 'RETOUCH_SLOT_NOT_RELEASED_OR_HISTORY_LOST'; END IF;
    UPDATE public.order_requests SET state='withdrawn',decided_by='10000000-0000-4000-8000-000000000002',decided_at=CURRENT_TIMESTAMP WHERE id='70000000-0000-4000-8000-000000000001';
    INSERT INTO public.order_requests(order_id,clinic_id,kind,base_version_id,requested_by) SELECT order_id,clinic_id,kind,base_version_id,requested_by FROM public.order_requests WHERE id='70000000-0000-4000-8000-000000000001';

    RAISE NOTICE 'linked_constraints passed: % negative cases',successes;
END;
$schema_tests$;
