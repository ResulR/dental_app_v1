-- PREPARATION ONLY. Fresh private cluster, synthetic data, no production.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$ BEGIN
 IF current_database()<>'dental_lab' OR session_user<>'postgres'
 OR current_setting('server_version_num')::int/10000<>17
 OR current_setting('data_directory')<>'/srv/dental-lab/.local/order-similarity-v1/pgdata'
 OR current_setting('port')<>'55448'
 OR EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace)
 THEN RAISE EXCEPTION 'FRESH_ISOLATED_SIMILARITY_REQUIRED'; END IF;
END $guard$;
CREATE ROLE dental_lab_owner NOLOGIN;
CREATE ROLE dental_lab_audit NOLOGIN;
CREATE ROLE dental_lab_migrator NOLOGIN;
CREATE ROLE dental_lab_app NOLOGIN;
CREATE ROLE "dental-lab-runtime" NOLOGIN;
GRANT dental_lab_app TO "dental-lab-runtime";
REVOKE ALL ON DATABASE dental_lab FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE,CREATE ON SCHEMA public TO dental_lab_migrator;
GRANT USAGE ON SCHEMA public TO dental_lab_app;
SET LOCAL ROLE dental_lab_migrator;
\ir ../../migrations/0002_identity_clinics_permissions.sql
\ir ../../migrations/0003_catalog_snapshots.sql
\ir ../../migrations/0004_orders_versions.sql
\ir ../../migrations/0005_requests_linked_works.sql
\ir ../../migrations/0006_files_uploads.sql
\ir ../../migrations/0007_messaging_reads.sql
\ir ../../migrations/0008_events_notifications_audit.sql
\ir ../../migrations/0009_drafts_conflicts.sql
\ir ../../migrations/0010_application_table_privileges.sql
\ir ../../migrations/0011_session_absolute_limits.sql
\ir ../../migrations/0012_clinic_review_history.sql
\ir ../../migrations/0013_login_attempt_limits.sql
SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;

BEGIN;
SET LOCAL ROLE dental_lab_migrator;
SET CONSTRAINTS ALL DEFERRED;
INSERT INTO public.accounts(id,profile,email_original,email_key,lifecycle) VALUES
 ('a1000000-0000-4000-8000-000000000001','clinic','one@similar.invalid','one@similar.invalid','active'),
 ('a1000000-0000-4000-8000-000000000002','clinic','two@similar.invalid','two@similar.invalid','active'),
 ('a1000000-0000-4000-8000-000000000003','employee','staff@similar.invalid','staff@similar.invalid','active'),
 ('a1000000-0000-4000-8000-000000000004','owner','owner@similar.invalid','owner@similar.invalid','active');
INSERT INTO public.owner_slot(singleton,account_id)
 VALUES(1,'a1000000-0000-4000-8000-000000000004');
INSERT INTO public.clinics(id,account_id,name,dentist_first_name,dentist_last_name,phone,address,review_state) VALUES
 ('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','Synthetic One','Fake','One','+000','Test','approved'),
 ('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','Synthetic Two','Fake','Two','+000','Test','approved');
INSERT INTO public.catalog_references(id,kind) VALUES
 ('a3000000-0000-4000-8000-000000000001','material'),
 ('a3000000-0000-4000-8000-000000000002','shade'),
 ('a3000000-0000-4000-8000-000000000003','material'),
 ('a3000000-0000-4000-8000-000000000004','shade');
INSERT INTO public.catalog_entries(reference_id,label)
 SELECT id,'Synthetic '||kind||' '||right(id::text,1) FROM public.catalog_references;
INSERT INTO public.catalog_reference_snapshots(id,reference_id,kind,label,source_revision)
 SELECT ('a4000000-0000-4000-8000-'||lpad(right(id::text,1),12,'0'))::uuid,
 id,kind,'Synthetic '||kind||' '||right(id::text,1),1 FROM public.catalog_references;
INSERT INTO public.sessions(id,account_id,secret_digest,auth_epoch,expires_at)
 SELECT ('a7000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('a1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 decode(repeat(lpad(n::text,2,'0'),32),'hex'),0,clock_timestamp()+interval '1 day'
 FROM generate_series(1,3) n;
INSERT INTO public.session_limits(session_id,account_id,expires_at,absolute_expires_at,parent_key)
 SELECT id,account_id,expires_at,expires_at,id FROM public.sessions;
INSERT INTO public.orders(id,clinic_id,kind,origin,created_by,status,current_version_id,received_at)
 SELECT ('a5000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('a2000000-0000-4000-8000-'||lpad((CASE WHEN n=5 THEN 2 ELSE 1 END)::text,12,'0'))::uuid,
 'normal','clinic',
 ('a1000000-0000-4000-8000-'||lpad((CASE WHEN n=5 THEN 2 ELSE 1 END)::text,12,'0'))::uuid,
 'pending',('a6000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '2026-10-20 00:00:00+00'::timestamptz+n*interval '1 minute'
 FROM generate_series(1,10) n;
INSERT INTO public.order_versions(id,order_id,clinic_id,order_kind,order_origin,version_number,
 created_by,patient_first_name,patient_last_name,patient_reference,material_snapshot_id,
 shade_snapshot_id,requested_delivery_date)
 SELECT o.current_version_id,o.id,o.clinic_id,'normal','clinic',
 CASE WHEN right(o.id::text,1)='7' THEN 2 ELSE 1 END,o.created_by,
 CASE WHEN right(o.id::text,1) IN ('2','0') THEN 'Mira' ELSE NULL END,
 CASE WHEN right(o.id::text,1)='2' THEN 'Test'
      WHEN right(o.id::text,1)='0' THEN 'Other' ELSE NULL END,
 CASE WHEN right(o.id::text,1)='2' THEN NULL
      WHEN right(o.id::text,1) IN ('7','0') THEN 'OTHER' ELSE 'REF-X' END,
 CASE WHEN right(o.id::text,1)='6' THEN 'a4000000-0000-4000-8000-000000000003'::uuid
      ELSE 'a4000000-0000-4000-8000-000000000001'::uuid END,
 CASE WHEN right(o.id::text,1)='9' THEN 'a4000000-0000-4000-8000-000000000004'::uuid
      ELSE 'a4000000-0000-4000-8000-000000000002'::uuid END,
 CASE WHEN right(o.id::text,1)='8' THEN '2026-11-02'::date ELSE '2026-11-01'::date END
 FROM public.orders o;
INSERT INTO public.order_versions(id,order_id,clinic_id,order_kind,order_origin,version_number,
 created_by,patient_reference,material_snapshot_id,shade_snapshot_id,requested_delivery_date)
 VALUES('a6000000-0000-4000-8000-000000000070','a5000000-0000-4000-8000-000000000007',
 'a2000000-0000-4000-8000-000000000001','normal','clinic',1,
 'a1000000-0000-4000-8000-000000000001','REF-X',
 'a4000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002','2026-11-01');
SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;
