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
    'aircraft default engine type',
    'certified flight void archive and provenance'
  ];
  actual_name text;
  v integer;
BEGIN
  IF current_database() IS DISTINCT FROM 'neondb' THEN
    RAISE EXCEPTION '3.5 v20 postflight: wrong database target: %',current_database();
  END IF;
  IF pg_is_in_recovery() THEN
    RAISE EXCEPTION '3.5 v20 postflight: target is a recovery/replica database';
  END IF;
  FOR v IN 1..20 LOOP
    SELECT m.name INTO actual_name FROM public.flytally_schema_migrations m WHERE m.version=v;
    IF actual_name IS NULL OR actual_name IS DISTINCT FROM expected_names[v] THEN
      RAISE EXCEPTION '3.5 v20 postflight: registry drift at version %',v;
    END IF;
  END LOOP;
  IF (SELECT COUNT(*) FROM public.flytally_schema_migrations)<>20
     OR EXISTS(SELECT 1 FROM public.flytally_schema_migrations WHERE version<1 OR version>20) THEN
    RAISE EXCEPTION '3.5 v20 postflight: registry is not exact versions 1..20';
  END IF;

  IF to_regclass('public.voided_certified_flights') IS NULL
     OR to_regclass('public.voided_flight_certified_revisions') IS NULL
     OR to_regclass('public.voided_flight_verifications') IS NULL
     OR to_regclass('public.voided_flight_archive_items') IS NULL
     OR to_regclass('public.flight_source_provenance') IS NULL THEN
    RAISE EXCEPTION '3.5 v20 postflight: required v20 tables are missing';
  END IF;

  IF to_regprocedure('public.logbook_protect_source_provenance()') IS NULL
     OR to_regprocedure('public.logbook_require_void_archive_separation()') IS NULL
     OR to_regprocedure('public.logbook_validate_void_archive_child_insert()') IS NULL
     OR to_regprocedure('public.logbook_protect_void_archive()') IS NULL
     OR to_regprocedure('public.logbook_prevent_voided_flight_id_reuse()') IS NULL
     OR to_regprocedure('public.logbook_protect_locked_flight()') IS NULL THEN
    RAISE EXCEPTION '3.5 v20 postflight: required protection function is missing';
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.flights'::regclass
      AND tgname='trg_logbook_protect_locked_flight'
      AND NOT tgisinternal
  ) OR NOT EXISTS(
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.flights'::regclass
      AND tgname='trg_logbook_prevent_voided_flight_id_reuse'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION '3.5 v20 postflight: flights protection triggers missing';
  END IF;

  IF EXISTS(
    SELECT 1
    FROM public.flight_participations p
    JOIN public.flights own ON own.id=p.participant_flight_id AND own.user_id=p.participant_user_id
    LEFT JOIN public.flight_source_provenance sp
      ON sp.participant_flight_id=p.participant_flight_id
     AND sp.participant_user_id=p.participant_user_id
    WHERE p.status='accepted' AND p.participant_flight_id IS NOT NULL
      AND (
        sp.id IS NULL
        OR sp.source_flight_id IS DISTINCT FROM p.source_flight_id
        OR sp.source_user_id IS DISTINCT FROM p.source_user_id
        OR sp.source_revision IS DISTINCT FROM GREATEST(COALESCE(p.source_revision,1),1)
        OR sp.source_hash IS DISTINCT FROM COALESCE(p.source_hash,'')
        OR sp.participant_role IS DISTINCT FROM COALESCE(p.participant_role,'')
        OR sp.pic_commander_basis IS DISTINCT FROM p.pic_commander_basis
      )
  ) THEN
    RAISE EXCEPTION '3.5 v20 postflight: accepted participant provenance is incomplete or mismatched';
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
  (SELECT COUNT(*) FROM public.flight_source_provenance) AS provenance_rows,
  (SELECT COUNT(*) FROM public.voided_certified_flights) AS voided_flight_rows,
  (SELECT COUNT(*) FROM public.voided_flight_certified_revisions) AS voided_revision_rows,
  (SELECT COUNT(*) FROM public.voided_flight_verifications) AS voided_verification_rows,
  (SELECT COUNT(*) FROM public.voided_flight_archive_items) AS voided_archive_item_rows,
  (SELECT COUNT(*) FROM public.deleted_flights) AS deleted_flight_rows;

SELECT version,name,applied_at
FROM public.flytally_schema_migrations
ORDER BY version;

ROLLBACK;
