-- Fresh isolated v12 only. Synthetic accounts/orders; never production.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$ BEGIN
 IF current_database()<>'dental_lab' OR session_user<>'postgres'
 OR current_setting('server_version_num')::int/10000<>17
 OR current_setting('data_directory')<>'/srv/dental-lab/.local/notifications-v12/pgdata'
 OR current_setting('port')<>'55442'
 OR EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace)
 THEN RAISE EXCEPTION 'FRESH_ISOLATED_NOTIFICATIONS_V12_REQUIRED'; END IF;
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
 ('71000000-0000-4000-8000-000000000001','owner','owner@v6.invalid','owner@v6.invalid','active'),
 ('71000000-0000-4000-8000-000000000002','clinic','one@v6.invalid','one@v6.invalid','active'),
 ('71000000-0000-4000-8000-000000000003','clinic','two@v6.invalid','two@v6.invalid','active'),
 ('71000000-0000-4000-8000-000000000004','admin','general@v6.invalid','general@v6.invalid','active'),
 ('71000000-0000-4000-8000-000000000005','admin','both@v6.invalid','both@v6.invalid','active');
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
INSERT INTO public.orders(id,clinic_id,kind,origin,created_by,status,current_version_id,manufacturing_version_id)
 SELECT ('75000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 CASE WHEN n IN (2,7) THEN '72000000-0000-4000-8000-000000000002'::uuid ELSE '72000000-0000-4000-8000-000000000001'::uuid END,
 CASE WHEN n=4 THEN 'retouch' ELSE 'normal' END,'laboratory','71000000-0000-4000-8000-000000000001',
 'accepted',
 ('76000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 NULL::uuid
 FROM (VALUES (1),(2),(3),(4),(7)) AS seeded(n);
INSERT INTO public.order_versions(id,order_id,clinic_id,order_kind,order_origin,version_number,created_by,patient_reference,material_snapshot_id,shade_snapshot_id,description)
 SELECT o.current_version_id,o.id,o.clinic_id,o.kind,'laboratory',1,
 '71000000-0000-4000-8000-000000000001','SYNTHETIC-'||o.number,
 '74000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000002',
 CASE WHEN o.kind='retouch' THEN 'Synthetic retouch only' ELSE NULL END FROM public.orders o;
-- The manufacturing FK is immediate: link only after its version exists.
-- The deferred current-version FK resolves at this transaction's commit.
UPDATE public.orders SET manufacturing_version_id=current_version_id,status='manufacturing',revision=2
 WHERE id='75000000-0000-4000-8000-000000000003';
UPDATE public.orders SET status='completed',revision=3
 WHERE id='75000000-0000-4000-8000-000000000003';
UPDATE public.orders SET status='delivered',revision=4
 WHERE id='75000000-0000-4000-8000-000000000003';
INSERT INTO public.work_links(source_order_id,child_order_id,clinic_id,kind,intervention_kind,child_current_status,source_revision,source_status_at_creation,created_by)
 VALUES('75000000-0000-4000-8000-000000000003','75000000-0000-4000-8000-000000000004','72000000-0000-4000-8000-000000000001','retouch','retouch','accepted',4,'delivered','71000000-0000-4000-8000-000000000001');
INSERT INTO public.conversations(id,clinic_id,kind,order_id) VALUES
 ('79000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','general',NULL),
 ('79000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000002','general',NULL),
 ('79000000-0000-4000-8000-000000000003','72000000-0000-4000-8000-000000000001','order','75000000-0000-4000-8000-000000000001'),
 ('79000000-0000-4000-8000-000000000004','72000000-0000-4000-8000-000000000001','order','75000000-0000-4000-8000-000000000004'),
 ('79000000-0000-4000-8000-000000000005','72000000-0000-4000-8000-000000000002','order','75000000-0000-4000-8000-000000000002'),
 ('79000000-0000-4000-8000-000000000006','72000000-0000-4000-8000-000000000001','order','75000000-0000-4000-8000-000000000003');
UPDATE public.conversations SET closed_at=statement_timestamp() WHERE id='79000000-0000-4000-8000-000000000006';
-- Historical message and one genuine marker; 0023 may only backfill absent zeroes.
UPDATE public.conversations SET last_message_seq=1 WHERE id='79000000-0000-4000-8000-000000000001';
INSERT INTO public.messages(id,conversation_id,clinic_id,sequence_number,sender_id,sender_side,current_version_id,idempotency_key,payload_fingerprint)
 VALUES('7a000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001',1,'71000000-0000-4000-8000-000000000002','clinic','7b000000-0000-4000-8000-000000000001','7c000000-0000-4000-8000-000000000999',decode(repeat('12',32),'hex'));
INSERT INTO public.message_versions(id,message_id,clinic_id,version_number,created_by,body)
 VALUES('7b000000-0000-4000-8000-000000000001','7a000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001',1,'71000000-0000-4000-8000-000000000002','Old message');
INSERT INTO public.conversation_reads(conversation_id,side,last_read_seq,read_by,read_at)
 VALUES('79000000-0000-4000-8000-000000000001','clinic',1,'71000000-0000-4000-8000-000000000002',statement_timestamp());
INSERT INTO public.account_grants(account_id,account_profile,permission_code,prerequisite_key,created_by)
 SELECT a.id,'admin',p.code,p.prerequisite_key,'71000000-0000-4000-8000-000000000001'
 FROM public.accounts a CROSS JOIN public.permission_definitions p
 WHERE (a.id='71000000-0000-4000-8000-000000000004' AND p.code IN ('messaging.general.read','messaging.general.reply'))
 OR (a.id='71000000-0000-4000-8000-000000000005' AND p.code IN ('messaging.general.read','messaging.general.reply','orders.read_logistics','messaging.order.read','messaging.order.reply'));
INSERT INTO public.sessions(id,account_id,secret_digest,auth_epoch,expires_at)
 SELECT ('77000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('71000000-0000-4000-8000-'||lpad(CASE WHEN n=6 THEN 2 ELSE n END::text,12,'0'))::uuid,
 decode(repeat(lpad(n::text,2,'0'),32),'hex'),0,clock_timestamp()+interval '1 day'
 FROM generate_series(1,6) n;
INSERT INTO public.session_limits(session_id,account_id,expires_at,absolute_expires_at,parent_key)
 SELECT id,account_id,expires_at,expires_at,id FROM public.sessions;
SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;
BEGIN;
SET LOCAL ROLE dental_lab_migrator;
\ir ../../migrations/0023_conversation_read_markers_backfill.sql
COMMIT;
DO $check$ BEGIN
 IF (SELECT count(*) FROM public.conversation_reads)<>12
 OR (SELECT last_read_seq FROM public.conversation_reads WHERE conversation_id='79000000-0000-4000-8000-000000000001' AND side='clinic')<>1
 OR (SELECT last_read_seq FROM public.conversation_reads WHERE conversation_id='79000000-0000-4000-8000-000000000001' AND side='laboratory')<>0
 THEN RAISE EXCEPTION 'READ_MARKER_BACKFILL_MISMATCH'; END IF;
END $check$;

-- Clinically authored order for category-recipient tests; all references synthetic.
BEGIN;
SET LOCAL ROLE dental_lab_migrator;
INSERT INTO public.orders(id,clinic_id,kind,origin,created_by,status,current_version_id)
VALUES('75000000-0000-4000-8000-000000000005','72000000-0000-4000-8000-000000000002',
       'normal','clinic','71000000-0000-4000-8000-000000000003','pending',
       '76000000-0000-4000-8000-000000000005');
INSERT INTO public.order_versions(id,order_id,clinic_id,order_kind,order_origin,
       version_number,created_by,patient_reference,material_snapshot_id,shade_snapshot_id,requested_delivery_date)
VALUES('76000000-0000-4000-8000-000000000005','75000000-0000-4000-8000-000000000005',
       '72000000-0000-4000-8000-000000000002','normal','clinic',1,
       '71000000-0000-4000-8000-000000000003','SYNTHETIC-NEW',
       '74000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000002','2026-11-30');
INSERT INTO public.orders(id,clinic_id,kind,origin,created_by,status,current_version_id)
VALUES('75000000-0000-4000-8000-000000000006','72000000-0000-4000-8000-000000000002',
       'normal','clinic','71000000-0000-4000-8000-000000000003','pending',
       '76000000-0000-4000-8000-000000000006');
INSERT INTO public.order_versions(id,order_id,clinic_id,order_kind,order_origin,
       version_number,created_by,patient_reference,material_snapshot_id,shade_snapshot_id,requested_delivery_date)
VALUES('76000000-0000-4000-8000-000000000006','75000000-0000-4000-8000-000000000006',
       '72000000-0000-4000-8000-000000000002','normal','clinic',1,
       '71000000-0000-4000-8000-000000000003','SYNTHETIC-SECOND',
       '74000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000002','2026-11-30');
SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;
