\set ON_ERROR_STOP on
\pset pager off

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

SELECT pg_advisory_xact_lock(704190104);

DO $e2$
DECLARE
  expected_names text[] := ARRAY[
    'flight audit and locking',
    'backups and recoverable trash',
    'core query indexes',
    'restore and route performance indexes',
    'EASA FCL.050 flight logbook fields',
    'FCL.050 structured aircraft, FSTD and certification',
    'certified flight correction revisions',
    'certified FSTD correction revisions',
    'private beta authentication foundation',
    'private pilot connections',
    'instructor flight approvals',
    'shared flight participation',
    'crew connections and verified approvals',
    'user-owned structured flight expenses',
    'Safety Pilot connected PIC collaboration',
    'general PIC invitation provenance',
    'historical flight aircraft identity preservation',
    'aircraft default operation type'
  ];
  actual_name text;
  v integer;
BEGIN
  IF current_database() IS DISTINCT FROM 'neondb' THEN
    RAISE EXCEPTION 'E2 v19 migration: wrong database target: %',current_database();
  END IF;
  IF pg_is_in_recovery() THEN
    RAISE EXCEPTION 'E2 v19 migration: target is a recovery/replica database';
  END IF;
  FOR v IN 1..18 LOOP
    SELECT m.name INTO actual_name FROM public.flytally_schema_migrations m WHERE m.version=v;
    IF actual_name IS NULL OR actual_name IS DISTINCT FROM expected_names[v] THEN
      RAISE EXCEPTION 'E2 v19 migration: registry drift at version %',v;
    END IF;
  END LOOP;
  IF (SELECT COUNT(*) FROM public.flytally_schema_migrations)<>18
     OR EXISTS(SELECT 1 FROM public.flytally_schema_migrations WHERE version<1 OR version>18) THEN
    RAISE EXCEPTION 'E2 v19 migration: registry is not exact versions 1..18';
  END IF;
  IF EXISTS(
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='aircraft' AND c.column_name='default_engine_type'
  ) THEN
    RAISE EXCEPTION 'E2 v19 migration: partial state: default_engine_type already exists';
  END IF;
  IF EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conname='ck_aircraft_default_engine_type'
      AND conrelid='public.aircraft'::regclass
  ) THEN
    RAISE EXCEPTION 'E2 v19 migration: partial state: constraint already exists';
  END IF;
END
$e2$;

ALTER TABLE public.aircraft
  ADD COLUMN default_engine_type TEXT;

ALTER TABLE public.aircraft
  ADD CONSTRAINT ck_aircraft_default_engine_type
  CHECK(default_engine_type IS NULL OR default_engine_type IN ('SE','ME'));

INSERT INTO public.flytally_schema_migrations(version,name)
VALUES(19,'aircraft default engine type');

DO $e2$
DECLARE
  observed_is_nullable text;
  observed_column_default text;
  constraint_validated boolean;
  non_null_rows bigint;
BEGIN
  SELECT c.is_nullable,c.column_default
    INTO observed_is_nullable,observed_column_default
    FROM information_schema.columns c
    WHERE c.table_schema='public'
      AND c.table_name='aircraft'
      AND c.column_name='default_engine_type';

  IF observed_is_nullable IS DISTINCT FROM 'YES' THEN
    RAISE EXCEPTION 'E2 v19 migration: default_engine_type is not nullable';
  END IF;
  IF observed_column_default IS NOT NULL THEN
    RAISE EXCEPTION 'E2 v19 migration: default_engine_type unexpectedly has a default';
  END IF;

  SELECT convalidated INTO constraint_validated
    FROM pg_constraint
    WHERE conname='ck_aircraft_default_engine_type'
      AND conrelid='public.aircraft'::regclass
      AND contype='c';
  IF constraint_validated IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'E2 v19 migration: validated CHECK constraint missing';
  END IF;

  SELECT COUNT(*) INTO non_null_rows FROM public.aircraft WHERE default_engine_type IS NOT NULL;
  IF non_null_rows<>0 THEN
    RAISE EXCEPTION 'E2 v19 migration: existing aircraft defaults were populated unexpectedly';
  END IF;

  IF (SELECT COUNT(*) FROM public.flytally_schema_migrations WHERE version=19 AND name='aircraft default engine type')<>1 THEN
    RAISE EXCEPTION 'E2 v19 migration: exact registry row missing or duplicated';
  END IF;
END
$e2$;

COMMIT;
