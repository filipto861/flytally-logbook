\set ON_ERROR_STOP on
\pset pager off

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=public,pg_catalog;

SELECT pg_advisory_xact_lock(704190104);

DO $v350$
BEGIN
  IF current_database() IS DISTINCT FROM 'neondb' THEN
    RAISE EXCEPTION '3.5 v20 reconcile: wrong database target: %',current_database();
  END IF;
  IF pg_is_in_recovery() THEN
    RAISE EXCEPTION '3.5 v20 reconcile: target is a recovery/replica database';
  END IF;
  IF (SELECT COUNT(*) FROM public.flytally_schema_migrations)<>20
     OR NOT EXISTS(
       SELECT 1 FROM public.flytally_schema_migrations
       WHERE version=20 AND name='certified flight void archive and provenance'
     ) THEN
    RAISE EXCEPTION '3.5 v20 reconcile: schema v20 is not the exact active schema';
  END IF;
  IF to_regclass('public.flight_source_provenance') IS NULL THEN
    RAISE EXCEPTION '3.5 v20 reconcile: provenance table missing';
  END IF;

  IF EXISTS(
    SELECT 1
    FROM public.flight_participations p
    WHERE p.status='accepted' AND p.participant_flight_id IS NOT NULL
      AND (
        COALESCE(p.source_revision,0)<1
        OR NULLIF(TRIM(COALESCE(p.source_hash,'')),'') IS NULL
        OR NULLIF(TRIM(COALESCE(p.participant_role,'')),'') IS NULL
        OR NOT EXISTS(
          SELECT 1 FROM public.flights own
          WHERE own.id=p.participant_flight_id AND own.user_id=p.participant_user_id
        )
      )
  ) THEN
    RAISE EXCEPTION '3.5 v20 reconcile: accepted participant provenance is incomplete';
  END IF;
END
$v350$;

INSERT INTO public.flight_source_provenance(
  participant_flight_id,participant_user_id,source_flight_id,source_user_id,source_revision,source_hash,
  participant_role,pic_commander_basis,accepted_at
)
SELECT p.participant_flight_id,p.participant_user_id,p.source_flight_id,p.source_user_id,
  GREATEST(COALESCE(p.source_revision,1),1),COALESCE(p.source_hash,''),
  COALESCE(p.participant_role,''),p.pic_commander_basis,COALESCE(p.responded_at,p.created_at)
FROM public.flight_participations p
JOIN public.flights own ON own.id=p.participant_flight_id AND own.user_id=p.participant_user_id
WHERE p.status='accepted' AND p.participant_flight_id IS NOT NULL
ON CONFLICT(participant_flight_id,participant_user_id) DO NOTHING;

DO $v350$
BEGIN
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
    RAISE EXCEPTION '3.5 v20 reconcile: accepted participant provenance mismatch remains';
  END IF;
END
$v350$;

COMMIT;
