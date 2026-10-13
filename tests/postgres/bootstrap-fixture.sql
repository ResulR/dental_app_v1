-- ONLY fresh disposable cluster on the approved reception machine. NOT a migration.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'dental_lab' OR session_user<>'postgres'
 OR current_setting('server_version_num')::int/10000<>17
 OR current_setting('data_directory')<>'/var/lib/dental-lab-bootstrap-reception/pgdata'
 OR current_setting('port')<>'55432'
 OR EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace)
 THEN RAISE EXCEPTION 'ISOLATED_EMPTY_CLUSTER_REQUIRED'; END IF;
END
$guard$;
CREATE ROLE dental_lab_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE dental_lab_audit NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE dental_lab_migrator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE "dental-migrate" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE dental_lab_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE "dental-lab-runtime" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
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
