BEGIN;
SET LOCAL lock_timeout='15s';
CREATE SCHEMA IF NOT EXISTS rw_migration AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA rw_migration FROM PUBLIC;
CREATE OR REPLACE FUNCTION rw_migration.write_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION USING ERRCODE='25006', MESSAGE='网站已迁移，请使用 https://shaneteachesenglish.icu/'; END $$;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT schemaname,tablename FROM pg_tables WHERE (schemaname='public' AND tablename LIKE 'rw_%') OR (schemaname='auth' AND tablename IN ('users','identities')) LOOP
  EXECUTE format('CREATE TRIGGER rw_migration_freeze BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON %I.%I FOR EACH STATEMENT EXECUTE FUNCTION rw_migration.write_guard()',r.schemaname,r.tablename);
 END LOOP;
END $$;
COMMIT;
