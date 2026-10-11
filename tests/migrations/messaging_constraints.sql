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
    INSERT INTO public.conversations(id,clinic_id,kind,order_id) VALUES
      ('b0000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','general',NULL),('b0000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','order','40000000-0000-4000-8000-000000000001');
    SET CONSTRAINTS ALL DEFERRED;
    INSERT INTO public.messages(id,conversation_id,clinic_id,sequence_number,sender_id,sender_side,current_version_id,idempotency_key,payload_fingerprint) VALUES
      ('c0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',1,'10000000-0000-4000-8000-000000000002','clinic','d0000000-0000-4000-8000-000000000001','fixture-message-1',decode(repeat('01',32),'hex'));
    INSERT INTO public.message_versions(id,message_id,clinic_id,version_number,created_by,body) VALUES('d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',1,'10000000-0000-4000-8000-000000000002','Fixture text');
    SET CONSTRAINTS ALL IMMEDIATE;
    INSERT INTO public.conversation_reads(conversation_id,side,last_read_seq,read_by,read_at) VALUES('b0000000-0000-4000-8000-000000000001','laboratory',1,'10000000-0000-4000-8000-000000000001',CURRENT_TIMESTAMP);
    INSERT INTO public.message_reminder_cycles(conversation_id,side) VALUES('b0000000-0000-4000-8000-000000000001','laboratory');

    FOR item IN SELECT * FROM (VALUES
        ('duplicate general','INSERT INTO public.conversations(clinic_id,kind) VALUES(''20000000-0000-4000-8000-000000000001'',''general'')','23505'),
        ('duplicate order conversation','INSERT INTO public.conversations(clinic_id,kind,order_id) VALUES(''20000000-0000-4000-8000-000000000001'',''order'',''40000000-0000-4000-8000-000000000001'')','23505'),
        ('foreign order clinic','UPDATE public.conversations SET clinic_id=''20000000-0000-4000-8000-000000000002'' WHERE kind=''order''','23503'),
        ('general conversation closure','UPDATE public.conversations SET closed_at=CURRENT_TIMESTAMP WHERE id=''b0000000-0000-4000-8000-000000000001''','23514'),
        ('foreign author edit','UPDATE public.message_versions SET created_by=''10000000-0000-4000-8000-000000000001'' WHERE id=''d0000000-0000-4000-8000-000000000001''','23503'),
        ('missing current version','UPDATE public.messages SET current_version_id=''d0000000-0000-4000-8000-000000000002'' WHERE id=''c0000000-0000-4000-8000-000000000001''','23503'),
        ('read beyond message','UPDATE public.conversation_reads SET last_read_seq=2','23503'),
        ('orphan reminder side','INSERT INTO public.message_reminder_cycles(conversation_id,side) VALUES(''b0000000-0000-4000-8000-000000000001'',''clinic'')','23503'),
        ('invalid message fingerprint','UPDATE public.messages SET payload_fingerprint=decode(''01'',''hex'') WHERE id=''c0000000-0000-4000-8000-000000000001''','23514'),
        ('hide without author','UPDATE public.messages SET hidden_at=CURRENT_TIMESTAMP WHERE id=''c0000000-0000-4000-8000-000000000001''','23514'),
        ('crossclinic message','UPDATE public.messages SET clinic_id=''20000000-0000-4000-8000-000000000002'' WHERE id=''c0000000-0000-4000-8000-000000000001''','23503')
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
    INSERT INTO public.message_versions(id,message_id,clinic_id,version_number,created_by,body) VALUES('d0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',2,'10000000-0000-4000-8000-000000000002','Fixture edited text');
    UPDATE public.messages SET current_version_id='d0000000-0000-4000-8000-000000000002' WHERE id='c0000000-0000-4000-8000-000000000001';
    IF (SELECT count(*) FROM public.message_versions WHERE message_id='c0000000-0000-4000-8000-000000000001')<>2 THEN RAISE EXCEPTION 'MESSAGE_HISTORY_LOST'; END IF;

    RAISE NOTICE 'messaging_constraints passed: % negative cases',successes;
END;
$schema_tests$;
