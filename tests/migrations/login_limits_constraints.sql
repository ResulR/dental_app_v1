DO $schema_tests$
DECLARE item record; actual_state text; successes integer:=0;
BEGIN
    IF current_database()<>'dental_lab' OR current_user<>'dental_lab_migrator' OR current_setting('server_version_num')::integer/10000<>17 THEN RAISE EXCEPTION 'WRONG_TEST_TARGET'; END IF;
    IF EXISTS(SELECT 1 FROM public.login_attempt_limits) OR (SELECT count(*) FROM public.login_limit_guard WHERE singleton=1 AND policy_digest IS NULL)<>1 THEN RAISE EXCEPTION 'FIXTURE_REQUIRES_UNUSED_LIMITER'; END IF;
    INSERT INTO public.login_attempt_limits(key_digest,attempts,expires_at) VALUES(decode(repeat('01',32),'hex'),1,CURRENT_TIMESTAMP+interval '10 seconds');
    UPDATE public.login_attempt_limits SET attempts=attempts+1 WHERE key_digest=decode(repeat('01',32),'hex');
    IF (SELECT attempts FROM public.login_attempt_limits WHERE key_digest=decode(repeat('01',32),'hex'))<>2 THEN RAISE EXCEPTION 'POSITIVE_INCREMENT_FAILED'; END IF;
    UPDATE public.login_limit_guard SET policy_digest=decode(repeat('02',32),'hex') WHERE singleton=1;
    FOR item IN SELECT * FROM (VALUES
      ('guard singleton','INSERT INTO public.login_limit_guard(singleton) VALUES(2)','23514'),
      ('short policy','UPDATE public.login_limit_guard SET policy_digest=decode(''01'',''hex'') WHERE singleton=1','23514'),
      ('short key','INSERT INTO public.login_attempt_limits VALUES(decode(''01'',''hex''),1,CURRENT_TIMESTAMP)','23514'),
      ('zero attempts','INSERT INTO public.login_attempt_limits VALUES(decode(repeat(''03'',32),''hex''),0,CURRENT_TIMESTAMP)','23514'),
      ('negative attempts','INSERT INTO public.login_attempt_limits VALUES(decode(repeat(''03'',32),''hex''),-1,CURRENT_TIMESTAMP)','23514'),
      ('null attempts','INSERT INTO public.login_attempt_limits VALUES(decode(repeat(''03'',32),''hex''),NULL,CURRENT_TIMESTAMP)','23502'),
      ('infinite expiry','INSERT INTO public.login_attempt_limits VALUES(decode(repeat(''03'',32),''hex''),1,''infinity''::timestamptz)','23514'),
      ('duplicate key','INSERT INTO public.login_attempt_limits VALUES(decode(repeat(''01'',32),''hex''),1,CURRENT_TIMESTAMP)','23505')
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
    DELETE FROM public.login_attempt_limits WHERE key_digest=decode(repeat('01',32),'hex');
    IF EXISTS(SELECT 1 FROM public.login_attempt_limits) THEN RAISE EXCEPTION 'POSITIVE_DELETE_FAILED'; END IF;
    RAISE NOTICE 'login_limits_constraints passed: % negative cases',successes;
END;
$schema_tests$;
