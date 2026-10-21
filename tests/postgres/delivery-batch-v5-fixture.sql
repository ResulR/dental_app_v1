-- Fresh v5 only, synthetic data. Never production or an earlier reception cluster.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$ BEGIN
 IF current_database()<>'dental_lab' OR session_user<>'postgres'
 OR current_setting('server_version_num')::int/10000<>17
 OR current_setting('data_directory')<>'/srv/dental-lab/.local/delivery-batch-v5/pgdata'
 OR current_setting('port')<>'55435'
 OR EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace)
 THEN RAISE EXCEPTION 'FRESH_ISOLATED_V5_REQUIRED'; END IF;
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
\ir ../../migrations/0022_delivery_batch_receipts.sql
SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;

BEGIN;
SET LOCAL ROLE dental_lab_migrator;
SET CONSTRAINTS ALL DEFERRED;
INSERT INTO public.accounts(id,profile,email_original,email_key,lifecycle) VALUES
 ('71000000-0000-4000-8000-000000000001','owner','owner@fixture.invalid','owner@fixture.invalid','active'),
 ('71000000-0000-4000-8000-000000000002','clinic','one@fixture.invalid','one@fixture.invalid','active'),
 ('71000000-0000-4000-8000-000000000003','clinic','two@fixture.invalid','two@fixture.invalid','active');
INSERT INTO public.owner_slot(singleton,account_id) VALUES(1,'71000000-0000-4000-8000-000000000001');
INSERT INTO public.clinics(id,account_id,name,dentist_first_name,dentist_last_name,phone,address,review_state) VALUES
 ('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002','Fixture One','Fake','One','+000','Test','approved'),
 ('72000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000003','Fixture Two','Fake','Two','+000','Test','approved');
INSERT INTO public.catalog_references(id,kind) VALUES
 ('73000000-0000-4000-8000-000000000001','material'),
 ('73000000-0000-4000-8000-000000000002','shade');
INSERT INTO public.catalog_entries(reference_id,label) VALUES
 ('73000000-0000-4000-8000-000000000001','Synthetic material'),
 ('73000000-0000-4000-8000-000000000002','Synthetic shade');
INSERT INTO public.catalog_reference_snapshots(id,reference_id,kind,label,source_revision) VALUES
 ('74000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','material','Synthetic material',1),
 ('74000000-0000-4000-8000-000000000002','73000000-0000-4000-8000-000000000002','shade','Synthetic shade',1);
INSERT INTO public.orders(id,clinic_id,kind,origin,created_by,status,current_version_id)
 SELECT ('75000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 CASE WHEN n%2=1 THEN '72000000-0000-4000-8000-000000000001'::uuid ELSE '72000000-0000-4000-8000-000000000002'::uuid END,
 'normal','laboratory','71000000-0000-4000-8000-000000000001','accepted',
 ('76000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
 FROM generate_series(1,6) n;
INSERT INTO public.order_versions(id,order_id,clinic_id,order_kind,order_origin,version_number,created_by,patient_reference,material_snapshot_id,shade_snapshot_id)
 SELECT o.current_version_id,o.id,o.clinic_id,'normal','laboratory',1,
 '71000000-0000-4000-8000-000000000001',('SYNTHETIC-'||o.number),
 '74000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000002'
 FROM public.orders o;
UPDATE public.orders SET status='completed',manufacturing_version_id=current_version_id;
INSERT INTO public.order_logistics(order_id,clinic_id) SELECT id,clinic_id FROM public.orders;
INSERT INTO public.conversations(clinic_id,kind,order_id) SELECT clinic_id,'order',id FROM public.orders;
INSERT INTO public.sessions(id,account_id,secret_digest,auth_epoch,expires_at) VALUES
 ('77000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001',decode(repeat('11',32),'hex'),0,clock_timestamp()+interval '1 day'),
 ('77000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000002',decode(repeat('22',32),'hex'),0,clock_timestamp()+interval '1 day');
INSERT INTO public.session_limits(session_id,account_id,expires_at,absolute_expires_at,parent_key)
 SELECT id,account_id,expires_at,expires_at,id FROM public.sessions;
SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;
