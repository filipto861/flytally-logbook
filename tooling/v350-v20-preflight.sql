\set ON_ERROR_STOP on
\pset pager off

BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path=public,pg_catalog;

SELECT current_database() AS database_name,
       current_user AS database_user,
       pg_is_in_recovery() AS in_recovery,
       current_setting('transaction_read_only') AS transaction_read_only,
       NOW() AS observed_at;

DO $v350$
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
    'aircraft default operation type',
    'aircraft default engine type'
  ];
  actual_name text;
  v integer;
BEGIN
  IF current_database() IS DISTINCT FROM 'neondb' THEN
    RAISE EXCEPTION '3.5 v20 preflight: wrong database target: %',current_database();
  END IF;
  IF pg_is_in_recovery() THEN
    RAISE EXCEPTION '3.5 v20 preflight: target is a recovery/replica database';
  END IF;
  IF to_regclass('public.flytally_schema_migrations') IS NULL THEN
    RAISE EXCEPTION '3.5 v20 preflight: migration registry missing';
  END IF;

  FOR v IN 1..19 LOOP
    SELECT m.name INTO actual_name FROM public.flytally_schema_migrations m WHERE m.version=v;
    IF actual_name IS NULL OR actual_name IS DISTINCT FROM expected_names[v] THEN
      RAISE EXCEPTION '3.5 v20 preflight: registry drift at version %: %',v,actual_name;
    END IF;
  END LOOP;
  IF (SELECT COUNT(*) FROM public.flytally_schema_migrations)<>19
     OR EXISTS(SELECT 1 FROM public.flytally_schema_migrations WHERE version<1 OR version>19) THEN
    RAISE EXCEPTION '3.5 v20 preflight: registry is not exact versions 1..19';
  END IF;

  IF to_regclass('public.flights') IS NULL
     OR to_regclass('public.flight_participations') IS NULL
     OR to_regclass('public.flight_certified_revisions') IS NULL
     OR to_regclass('public.flight_verifications') IS NULL THEN
    RAISE EXCEPTION '3.5 v20 preflight: required source tables are missing';
  END IF;
  IF to_regclass('public.flights_id_user_owner_uq') IS NULL THEN
    RAISE EXCEPTION '3.5 v20 preflight: flights owner uniqueness index missing';
  END IF;

  IF to_regclass('public.voided_certified_flights') IS NOT NULL
     OR to_regclass('public.voided_flight_certified_revisions') IS NOT NULL
     OR to_regclass('public.voided_flight_verifications') IS NOT NULL
     OR to_regclass('public.voided_flight_archive_items') IS NOT NULL
     OR to_regclass('public.flight_source_provenance') IS NOT NULL THEN
    RAISE EXCEPTION '3.5 v20 preflight: partial v20 table state detected';
  END IF;

  IF to_regprocedure('public.logbook_protect_source_provenance()') IS NOT NULL
     OR to_regprocedure('public.logbook_require_void_archive_separation()') IS NOT NULL
     OR to_regprocedure('public.logbook_validate_void_archive_child_insert()') IS NOT NULL
     OR to_regprocedure('public.logbook_protect_void_archive()') IS NOT NULL
     OR to_regprocedure('public.logbook_prevent_voided_flight_id_reuse()') IS NOT NULL THEN
    RAISE EXCEPTION '3.5 v20 preflight: partial v20 function state detected';
  END IF;

  IF EXISTS(
    SELECT 1 FROM pg_trigger
    WHERE NOT tgisinternal
      AND tgname IN (
        'trg_logbook_protect_source_provenance',
        'trg_logbook_require_void_archive_separation',
        'trg_logbook_validate_voided_flight_revisions_insert',
        'trg_logbook_validate_voided_flight_verifications_insert',
        'trg_logbook_validate_voided_flight_archive_items_insert',
        'trg_logbook_protect_voided_certified_flights',
        'trg_logbook_protect_voided_flight_revisions',
        'trg_logbook_protect_voided_flight_verifications',
        'trg_logbook_protect_voided_flight_archive_items',
        'trg_logbook_prevent_voided_flight_id_reuse'
      )
  ) THEN
    RAISE EXCEPTION '3.5 v20 preflight: partial v20 trigger state detected';
  END IF;

  IF EXISTS(
    SELECT 1
    FROM public.flight_participations p
    WHERE p.status='accepted' AND p.participant_flight_id IS NOT NULL
      AND NOT EXISTS(
        SELECT 1 FROM public.flights own
        WHERE own.id=p.participant_flight_id AND own.user_id=p.participant_user_id
      )
  ) THEN
    RAISE EXCEPTION '3.5 v20 preflight: accepted participant copy has no matching owned flight';
  END IF;

  IF EXISTS(
    SELECT 1
    FROM public.flight_participations p
    WHERE p.status='accepted' AND p.participant_flight_id IS NOT NULL
      AND (
        COALESCE(p.source_revision,0)<1
        OR NULLIF(TRIM(COALESCE(p.source_hash,'')),'') IS NULL
        OR NULLIF(TRIM(COALESCE(p.participant_role,'')),'') IS NULL
      )
  ) THEN
    RAISE EXCEPTION '3.5 v20 preflight: accepted participant provenance is incomplete';
  END IF;

  IF EXISTS(
    SELECT p.participant_flight_id,p.participant_user_id
    FROM public.flight_participations p
    JOIN public.flights own ON own.id=p.participant_flight_id AND own.user_id=p.participant_user_id
    WHERE p.status='accepted' AND p.participant_flight_id IS NOT NULL
    GROUP BY p.participant_flight_id,p.participant_user_id
    HAVING COUNT(*)>1
  ) THEN
    RAISE EXCEPTION '3.5 v20 preflight: duplicate accepted provenance candidates detected';
  END IF;
END
$v350$;

SELECT
  (SELECT COUNT(*) FROM public.users) AS user_rows,
  (SELECT COUNT(*) FROM public.aircraft) AS aircraft_rows,
  (SELECT COUNT(*) FROM public.flights) AS flight_rows,
  (SELECT COUNT(*) FROM public.flights WHERE certified_at IS NOT NULL) AS certified_flight_rows,
  (SELECT COUNT(*) FROM public.flight_certified_revisions) AS certified_revision_rows,
  (SELECT COUNT(*) FROM public.flight_verifications) AS verification_rows,
  (SELECT COUNT(*) FROM public.flight_participations) AS participation_rows,
  (SELECT COUNT(*) FROM public.flight_participations WHERE status='accepted') AS accepted_participation_rows,
  (SELECT COUNT(*) FROM public.deleted_flights) AS deleted_flight_rows,
  (
    SELECT COUNT(*)
    FROM public.flight_participations p
    JOIN public.flights own ON own.id=p.participant_flight_id AND own.user_id=p.participant_user_id
    WHERE p.status='accepted' AND p.participant_flight_id IS NOT NULL
  ) AS provenance_backfill_candidates;

SELECT version,name,applied_at
FROM public.flytally_schema_migrations
ORDER BY version;

ROLLBACK;
