-- Probe technique sans DDL ni données métier ; approbation administrateur requise.
SELECT current_database() AS database, session_user AS executor, current_user AS role;
SELECT 1 / CASE WHEN has_schema_privilege(current_user, 'public', 'CREATE')
 AND NOT pg_has_role('dental-ai', 'dental_lab_migrator', 'MEMBER')
 AND NOT pg_has_role('dental-ai', 'dental_lab_owner', 'MEMBER')
 AND NOT pg_has_role(session_user, 'dental_lab_owner', 'MEMBER')
 THEN 1 ELSE 0 END AS permissions_verified;
