\set ON_ERROR_STOP on
\pset pager off

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

SELECT pg_advisory_xact_lock(704190104);

DO $e15$
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
    'historical flight aircraft identity preservation'
  ];
  actual_name text;
  v integer;
BEGIN
  IF current_database() IS DISTINCT FROM 'neondb' THEN
    RAISE EXCEPTION 'E1.5 migration: wrong database target: %',current_database();
  END IF;
  IF to_regclass('public.flytally_schema_migrations') IS NULL OR to_regclass('public.aircraft') IS NULL THEN
    RAISE EXCEPTION 'E1.5 migration: required production schema objects missing';
  END IF;
  IF pg_is_in_recovery() THEN
    RAISE EXCEPTION 'E1.5 migration: target is a recovery/replica database';
  END IF;

  FOR v IN 1..17 LOOP
    SELECT name INTO actual_name FROM public.flytally_schema_migrations WHERE version=v;
    IF actual_name IS NULL OR actual_name IS DISTINCT FROM expected_names[v] THEN
      RAISE EXCEPTION 'E1.5 migration: registry drift at version %',v;
    END IF;
  END LOOP;

  IF (SELECT COUNT(*) FROM public.flytally_schema_migrations)<>17
     OR EXISTS(SELECT 1 FROM public.flytally_schema_migrations WHERE version<1 OR version>17) THEN
    RAISE EXCEPTION 'E1.5 migration: registry is not exact versions 1..17';
  END IF;

  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='aircraft' AND column_name='default_operation_type'
  ) THEN
    RAISE EXCEPTION 'E1.5 migration: partial v18 state: column already exists';
  END IF;

  IF EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conname='ck_aircraft_default_operation_type'
      AND conrelid='public.aircraft'::regclass
  ) THEN
    RAISE EXCEPTION 'E1.5 migration: partial v18 state: constraint already exists';
  END IF;
END
$e15$;

ALTER TABLE public.aircraft
  ADD COLUMN default_operation_type TEXT;

ALTER TABLE public.aircraft
  ADD CONSTRAINT ck_aircraft_default_operation_type
  CHECK(default_operation_type IS NULL OR default_operation_type IN ('SP','MP'));

INSERT INTO public.flytally_schema_migrations(version,name)
VALUES(18,'aircraft default operation type');

DO $e15$
DECLARE
  column_nullable text;
  column_default text;
  constraint_validated boolean;
  non_null_rows bigint;
BEGIN
  SELECT is_nullable,column_default
    INTO column_nullable,column_default
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='aircraft'
      AND column_name='default_operation_type';

  IF column_nullable IS DISTINCT FROM 'YES' THEN
    RAISE EXCEPTION 'E1.5 migration: default_operation_type is not nullable';
  END IF;
  IF column_default IS NOT NULL THEN
    RAISE EXCEPTION 'E1.5 migration: default_operation_type unexpectedly has a default';
  END IF;

  SELECT convalidated INTO constraint_validated
    FROM pg_constraint
    WHERE conname='ck_aircraft_default_operation_type'
      AND conrelid='public.aircraft'::regclass
      AND contype='c';

  IF constraint_validated IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'E1.5 migration: expected validated CHECK constraint missing';
  END IF;

  SELECT COUNT(*) INTO non_null_rows
    FROM public.aircraft
    WHERE default_operation_type IS NOT NULL;
  IF non_null_rows<>0 THEN
    RAISE EXCEPTION 'E1.5 migration: existing aircraft defaults were populated unexpectedly';
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM public.flytally_schema_migrations
    WHERE version=18 AND name='aircraft default operation type'
  ) THEN
    RAISE EXCEPTION 'E1.5 migration: v18 registry row missing';
  END IF;
  IF (SELECT COUNT(*) FROM public.flytally_schema_migrations WHERE version=18)<>1 THEN
    RAISE EXCEPTION 'E1.5 migration: v18 registry cardinality invalid';
  END IF;
END
$e15$;

COMMIT;
