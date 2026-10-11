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
    INSERT INTO public.outbox_events(id,type,aggregate_type,aggregate_id,aggregate_revision,clinic_id,actor_id,correlation_id) VALUES('e0000000-0000-4000-8000-000000000001','order_submitted','order','40000000-0000-4000-8000-000000000001',1,'20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000002');
    INSERT INTO public.outbox_dispatches(event_id) VALUES('e0000000-0000-4000-8000-000000000001');
    INSERT INTO public.notification_deliveries(id,event_id,target_account_id,channel,purpose) VALUES('f0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','email','business');
    INSERT INTO public.notification_attempts(delivery_id,attempt_number,result,error_code) VALUES('f0000000-0000-4000-8000-000000000001',1,'temporary_error','FIXTURE_PROVIDER_UNAVAILABLE');
    UPDATE public.notification_deliveries SET state='failed',attempt_count=1 WHERE id='f0000000-0000-4000-8000-000000000001';
    INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,changed_fields) VALUES('10000000-0000-4000-8000-000000000002','ORDER_SUBMITTED','order','40000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000002',ARRAY['status']);
    IF NOT EXISTS(SELECT 1 FROM public.outbox_events WHERE id='e0000000-0000-4000-8000-000000000001') OR NOT EXISTS(SELECT 1 FROM public.orders WHERE id='40000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'MAIL_FAILURE_ERASED_BUSINESS'; END IF;

    FOR item IN SELECT * FROM (VALUES
        ('duplicate event','INSERT INTO public.outbox_events(type,aggregate_type,aggregate_id,aggregate_revision,clinic_id,actor_id,correlation_id) SELECT type,aggregate_type,aggregate_id,aggregate_revision,clinic_id,actor_id,correlation_id FROM public.outbox_events WHERE id=''e0000000-0000-4000-8000-000000000001''','23505'),
        ('unknown event','UPDATE public.outbox_events SET type=''patient_marketing'' WHERE id=''e0000000-0000-4000-8000-000000000001''','23514'),
        ('missing actor process','UPDATE public.outbox_events SET actor_id=NULL WHERE id=''e0000000-0000-4000-8000-000000000001''','23514'),
        ('erase referenced event','DELETE FROM public.outbox_events WHERE id=''e0000000-0000-4000-8000-000000000001''','23503'),
        ('duplicate delivery','INSERT INTO public.notification_deliveries(event_id,target_account_id,channel,purpose) SELECT event_id,target_account_id,channel,purpose FROM public.notification_deliveries WHERE id=''f0000000-0000-4000-8000-000000000001''','23505'),
        ('provider accepted without id','UPDATE public.notification_deliveries SET state=''provider_accepted'' WHERE id=''f0000000-0000-4000-8000-000000000001''','23514'),
        ('half lease','UPDATE public.notification_deliveries SET lease_id=''e0000000-0000-4000-8000-000000000003'' WHERE id=''f0000000-0000-4000-8000-000000000001''','23514'),
        ('duplicate attempt','INSERT INTO public.notification_attempts(delivery_id,attempt_number,result) VALUES(''f0000000-0000-4000-8000-000000000001'',1,''temporary_error'')','23505'),
        ('clinic admin recipient','INSERT INTO public.email_category_recipients(category,account_id,changed_by) VALUES(''order_submitted'',''10000000-0000-4000-8000-000000000002'',''10000000-0000-4000-8000-000000000001'')','23503'),
        ('audit both identities','UPDATE public.audit_events SET process_code=''fixture_process''','23514'),
        ('patient copied audit','UPDATE public.audit_events SET changed_fields=ARRAY[''patient_name'']','23514')
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

    RAISE NOTICE 'events_constraints passed: % negative cases',successes;
END;
$schema_tests$;
