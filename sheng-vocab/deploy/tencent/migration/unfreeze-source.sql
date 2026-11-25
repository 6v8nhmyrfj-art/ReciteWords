-- Run only after stopping target writes and reconciling every target-side change.
-- Commit the removal before doing any rollback-only verification transaction.
BEGIN;
DROP SCHEMA IF EXISTS rw_migration CASCADE;
COMMIT;
SELECT count(*) AS remaining_fences FROM pg_trigger WHERE tgname='rw_migration_freeze';
