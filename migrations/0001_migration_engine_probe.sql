SELECT 'migration_engine_v1' AS probe,
       current_database() AS database,
       session_user AS session_identity,
       current_user AS execution_identity;

SELECT 1 / CASE WHEN EXISTS (
    SELECT 1 FROM pg_locks
    WHERE locktype = 'advisory' AND pid = pg_backend_pid() AND granted
      AND classid = 0 AND objid = 28467789 AND objsubid = 1
) THEN 1 ELSE 0 END AS transaction_lock_ok;
