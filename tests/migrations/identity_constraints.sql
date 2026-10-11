DO $identity_tests$
DECLARE
    item record;
    actual_state text;
    successes integer := 0;
BEGIN
    IF current_database()<>'dental_lab' OR current_user<>'dental_lab_migrator'
       OR current_setting('server_version_num')::int/10000<>17 THEN
        RAISE EXCEPTION 'IDENTITY_TEST_WRONG_TARGET';
    END IF;
    IF EXISTS (SELECT 1 FROM public.accounts) THEN
        RAISE EXCEPTION 'IDENTITY_TEST_REQUIRES_EMPTY_ACCOUNTS';
    END IF;
    SET CONSTRAINTS ALL DEFERRED;
    INSERT INTO public.accounts(id,profile,email_original,email_key,lifecycle) VALUES ('11111111-1111-4111-8111-111111111111','owner','owner@example.invalid','owner@example.invalid','active');
    INSERT INTO public.owner_slot(singleton,account_id) VALUES (1,'11111111-1111-4111-8111-111111111111');
    INSERT INTO public.accounts(id,profile,email_original,email_key,lifecycle) VALUES ('22222222-2222-4222-8222-222222222222','admin','admin@example.invalid','admin@example.invalid','invited');
    INSERT INTO public.accounts(id,profile,email_original,email_key,lifecycle) VALUES ('33333333-3333-4333-8333-333333333333','employee','employee@example.invalid','employee@example.invalid','invited');
    INSERT INTO public.accounts(id,profile,email_original,email_key,lifecycle) VALUES ('44444444-4444-4444-8444-444444444444','clinic','clinic@example.invalid','clinic@example.invalid','active');
    INSERT INTO public.clinics(account_id,name,dentist_first_name,dentist_last_name,phone,address)
        VALUES ('44444444-4444-4444-8444-444444444444','Fixture clinic','Fake','Test','+000','Test address');
    SET CONSTRAINTS ALL IMMEDIATE;
    INSERT INTO public.invitations(account_id,created_by,target_email,purpose,token_digest,expires_at) VALUES ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','invited@example.invalid','employee',decode(repeat('01',32),'hex'),CURRENT_TIMESTAMP+interval '1 hour');
    INSERT INTO public.sessions(id,account_id,secret_digest,auth_epoch,expires_at)
        VALUES ('88888888-8888-4888-8888-888888888888','11111111-1111-4111-8111-111111111111',decode(repeat('04',32),'hex'),0,CURRENT_TIMESTAMP+interval '1 hour');
    INSERT INTO public.account_grants(account_id,account_profile,permission_code,prerequisite_key,created_by) VALUES ('33333333-3333-4333-8333-333333333333','employee','orders.read_logistics','','11111111-1111-4111-8111-111111111111');
    INSERT INTO public.account_grants(account_id,account_profile,permission_code,prerequisite_key,created_by) VALUES ('33333333-3333-4333-8333-333333333333','employee','orders.read_details','orders.read_logistics','11111111-1111-4111-8111-111111111111');
    INSERT INTO public.employee_delegation_limits(delegator_account_id,permission_code,created_by)
        VALUES ('22222222-2222-4222-8222-222222222222','files.view','11111111-1111-4111-8111-111111111111');
    FOR item IN SELECT * FROM (VALUES
        ('second owner','INSERT INTO public.accounts(id,profile,email_original,email_key,lifecycle) VALUES (''55555555-5555-4555-8555-555555555555'',''owner'',''second@example.invalid'',''second@example.invalid'',''active'')','23505'),
        ('duplicate email','INSERT INTO public.accounts(id,profile,email_original,email_key,lifecycle) VALUES (''66666666-6666-4666-8666-666666666666'',''employee'',''owner@example.invalid'',''owner@example.invalid'',''active'')','23505'),
        ('owner suspension','UPDATE public.accounts SET lifecycle=''suspended'' WHERE id=''11111111-1111-4111-8111-111111111111''','23514'),
        ('owner slot deletion','DELETE FROM public.owner_slot','23503'),
        ('owner demotion','UPDATE public.accounts SET profile=''employee'' WHERE id=''11111111-1111-4111-8111-111111111111''','23503'),
        ('clinic orphan','INSERT INTO public.accounts(id,profile,email_original,email_key,lifecycle) VALUES (''77777777-7777-4777-8777-777777777777'',''clinic'',''orphan@example.invalid'',''orphan@example.invalid'',''active'')','23503'),
        ('clinic deletion','DELETE FROM public.clinics','23503'),
        ('second clinic account binding','INSERT INTO public.clinics(account_id,name,dentist_first_name,dentist_last_name,phone,address) VALUES (''44444444-4444-4444-8444-444444444444'',''Other'',''Fake'',''Test'',''+000'',''Test address'')','23505'),
        ('credential empty','INSERT INTO public.credentials(account_id,password_hash) VALUES (''11111111-1111-4111-8111-111111111111'','' '')','23514'),
        ('invitation purpose mismatch','INSERT INTO public.invitations(account_id,created_by,target_email,purpose,token_digest,expires_at) VALUES (''22222222-2222-4222-8222-222222222222'',''11111111-1111-4111-8111-111111111111'',''invited@example.invalid'',''employee'',decode(repeat(''02'',32),''hex''),CURRENT_TIMESTAMP+interval ''1 hour'')','23503'),
        ('second pending invitation','INSERT INTO public.invitations(account_id,created_by,target_email,purpose,token_digest,expires_at) VALUES (''33333333-3333-4333-8333-333333333333'',''11111111-1111-4111-8111-111111111111'',''invited@example.invalid'',''employee'',decode(repeat(''03'',32),''hex''),CURRENT_TIMESTAMP+interval ''1 hour'')','23505'),
        ('invitation invalid expiry','UPDATE public.invitations SET expires_at=created_at','23514'),
        ('invitation two terminal states','UPDATE public.invitations SET consumed_at=created_at,revoked_at=created_at','23514'),
        ('session duplicate digest','INSERT INTO public.sessions(account_id,secret_digest,auth_epoch,expires_at) VALUES (''33333333-3333-4333-8333-333333333333'',decode(repeat(''04'',32),''hex''),0,CURRENT_TIMESTAMP+interval ''1 hour'')','23505'),
        ('session invalid expiry','UPDATE public.sessions SET expires_at=created_at','23514'),
        ('session invalid digest','UPDATE public.sessions SET secret_digest=decode(''01'',''hex'')','23514'),
        ('cross-account renewal','INSERT INTO public.sessions(account_id,secret_digest,auth_epoch,expires_at,renewed_from_id) VALUES (''33333333-3333-4333-8333-333333333333'',decode(repeat(''05'',32),''hex''),0,CURRENT_TIMESTAMP+interval ''1 hour'',''88888888-8888-4888-8888-888888888888'')','23503'),
        ('clinic lab grant','INSERT INTO public.account_grants(account_id,account_profile,permission_code,prerequisite_key,created_by) VALUES (''44444444-4444-4444-8444-444444444444'',''clinic'',''files.view'','''',''11111111-1111-4111-8111-111111111111'')','23514'),
        ('grant false prerequisite','INSERT INTO public.account_grants(account_id,account_profile,permission_code,prerequisite_key,created_by) VALUES (''33333333-3333-4333-8333-333333333333'',''employee'',''orders.accept'','''',''11111111-1111-4111-8111-111111111111'')','23503'),
        ('grant missing prerequisite','INSERT INTO public.account_grants(account_id,account_profile,permission_code,prerequisite_key,created_by) VALUES (''33333333-3333-4333-8333-333333333333'',''employee'',''messaging.general.reply'',''messaging.general.read'',''11111111-1111-4111-8111-111111111111'')','23503'),
        ('prerequisite removal','DELETE FROM public.account_grants WHERE account_id=''33333333-3333-4333-8333-333333333333'' AND permission_code=''orders.read_logistics''','23503'),
        ('employee delegation','INSERT INTO public.employee_delegation_limits(delegator_account_id,permission_code,created_by) VALUES (''33333333-3333-4333-8333-333333333333'',''files.view'',''11111111-1111-4111-8111-111111111111'')','23503'),
        ('unknown capability','INSERT INTO public.permission_definitions(code,prerequisite_key) VALUES (''audit.read'','''')','23514')
    ) AS cases(label,statement,wanted_state)
    LOOP
        BEGIN
            EXECUTE item.statement;
            RAISE EXCEPTION 'NEGATIVE_CASE_DID_NOT_FAIL';
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS actual_state = RETURNED_SQLSTATE;
            IF actual_state<>item.wanted_state THEN
                RAISE EXCEPTION 'Constraint case %: expected %, received %',
                    item.label,item.wanted_state,actual_state;
            END IF;
        END;
        successes := successes+1;
    END LOOP;
    IF successes<>23 THEN RAISE EXCEPTION 'IDENTITY_TEST_COUNT_MISMATCH'; END IF;
    RAISE NOTICE 'identity_constraints passed: % negative cases; positive owner/clinic/invitation/session/grants/delegation',successes;
END;
$identity_tests$;
