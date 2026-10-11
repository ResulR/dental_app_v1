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
    INSERT INTO public.file_objects(id,clinic_id,created_by,object_key,filename_original,format,size_bytes,content_sha256,media_type_verified,state,verified_at,storage_policy_version) VALUES
      ('90000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',repeat('1',64),'fixture.stl','stl',7,decode(repeat('01',32),'hex'),'application/octet-stream','ready',CURRENT_TIMESTAMP,'fixture-only'),
      ('90000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',repeat('2',64),'fixture.png','png',200000000,decode(repeat('02',32),'hex'),'image/png','ready',CURRENT_TIMESTAMP,'fixture-only');
    INSERT INTO public.upload_sessions(id,account_id,clinic_id,intended_kind,declared_size,chunk_size,expires_at,capacity_policy_version,reserved_bytes) VALUES('a0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','initial_order',7,4,CURRENT_TIMESTAMP+interval '1 hour','fixture-only',7);
    INSERT INTO public.upload_chunks(upload_id,clinic_id,declared_size,chunk_size,segment_index,size_bytes,sha256) VALUES
      ('a0000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',7,4,0,4,decode(repeat('03',32),'hex')),('a0000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',7,4,1,3,decode(repeat('04',32),'hex'));
    INSERT INTO public.order_version_files(version_id,order_id,clinic_id,file_id,attached_by) VALUES('60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002');
    INSERT INTO public.order_followup_files(order_id,clinic_id,file_id,created_by,changed_by) VALUES('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002');
    IF EXISTS(SELECT 1 FROM public.order_followup_files WHERE shared_with_clinic) THEN RAISE EXCEPTION 'FOLLOWUP_PUBLIC_BY_DEFAULT'; END IF;

    FOR item IN SELECT * FROM (VALUES
        ('file over limit','UPDATE public.file_objects SET size_bytes=200000001 WHERE id=''90000000-0000-4000-8000-000000000001''','23514'),
        ('unsupported format','UPDATE public.file_objects SET format=''exe'' WHERE id=''90000000-0000-4000-8000-000000000001''','23514'),
        ('ready hash missing','UPDATE public.file_objects SET content_sha256=NULL WHERE id=''90000000-0000-4000-8000-000000000001''','23514'),
        ('public storage key','UPDATE public.file_objects SET object_key=''https://example.invalid/file'' WHERE id=''90000000-0000-4000-8000-000000000001''','23514'),
        ('foreign file binding','UPDATE public.order_version_files SET file_id=''90000000-0000-4000-8000-000000000002''','23503'),
        ('unknown file followup','UPDATE public.order_followup_files SET file_id=''90000000-0000-4000-8000-000000000003''','23503'),
        ('duplicate segment','INSERT INTO public.upload_chunks(upload_id,clinic_id,declared_size,chunk_size,segment_index,size_bytes,sha256) VALUES(''a0000000-0000-4000-8000-000000000001'',''20000000-0000-4000-8000-000000000001'',7,4,0,4,decode(repeat(''03'',32),''hex''))','23505'),
        ('outside segment','INSERT INTO public.upload_chunks(upload_id,clinic_id,declared_size,chunk_size,segment_index,size_bytes,sha256) VALUES(''a0000000-0000-4000-8000-000000000001'',''20000000-0000-4000-8000-000000000001'',7,4,2,4,decode(repeat(''03'',32),''hex''))','23514'),
        ('wrong segment length','UPDATE public.upload_chunks SET size_bytes=3 WHERE segment_index=0','23514'),
        ('different segment policy','UPDATE public.upload_chunks SET declared_size=8 WHERE segment_index=0','23503'),
        ('invalid expiry','UPDATE public.upload_sessions SET expires_at=created_at WHERE id=''a0000000-0000-4000-8000-000000000001''','23514'),
        ('invalid checksum','UPDATE public.upload_chunks SET sha256=decode(''01'',''hex'')','23514')
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

    RAISE NOTICE 'files_constraints passed: % negative cases',successes;
END;
$schema_tests$;
