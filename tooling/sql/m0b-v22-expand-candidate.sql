-- M0-B / V22 EXPAND CANDIDATE. NOT AN APPLIED MIGRATION.
-- DO NOT invoke against any remote DB. Local disposable PostgreSQL 16 only.
-- No version-22 registration, writer changes, lifecycle trigger, backfill or default UID.
BEGIN;
DO $m0b_preflight$
BEGIN
  IF current_setting('server_version_num')::integer < 160000
    OR current_setting('server_version_num')::integer >= 170000 THEN
    RAISE EXCEPTION 'V22 expand candidate requires disposable PostgreSQL 16';
  END IF;
  IF (SELECT count(*) FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         AND table_name IN ('users','flights','fstd_sessions','deleted_flights')) <> 4 THEN
    RAISE EXCEPTION 'V22 expand candidate requires all four known source tables';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public'
         AND ((table_name='flights' AND column_name IN ('id','user_id'))
           OR (table_name='fstd_sessions' AND column_name IN ('id','user_id'))
           OR (table_name='deleted_flights' AND column_name IN
             ('id','user_id','purge_after','restored_at','restored_flight_id')))) <> 9 THEN
    RAISE EXCEPTION 'V22 expand candidate source columns unavailable';
  END IF;
END
$m0b_preflight$;

-- Historical rows remain NULL. A source fingerprint or numeric ID is NOT an issuer.
ALTER TABLE public.flights ADD COLUMN IF NOT EXISTS event_uid UUID;
ALTER TABLE public.fstd_sessions ADD COLUMN IF NOT EXISTS event_uid UUID;
ALTER TABLE public.deleted_flights ADD COLUMN IF NOT EXISTS event_uid UUID;

-- This is a passive registry. The future trusted writer must establish owner,
-- provenance, state and stored original cutoff atomically; no triggers yet.
CREATE TABLE IF NOT EXISTS public.logbook_event_uid_registry (
  owner_id BIGINT NOT NULL,
  event_kind TEXT NOT NULL CHECK (event_kind IN ('flight','fstd')),
  event_uid UUID NOT NULL,
  lifecycle_state TEXT NOT NULL
    CHECK (lifecycle_state IN ('active','trash','purged','voided')),
  original_trash_cutoff TIMESTAMPTZ,
  marker_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id,event_kind,event_uid),
  CONSTRAINT logbook_uid_registry_marker_shape CHECK (
    (lifecycle_state='purged' AND original_trash_cutoff IS NOT NULL
       AND marker_until IS NOT NULL AND marker_until>original_trash_cutoff)
    OR (lifecycle_state<>'purged' AND marker_until IS NULL)
  )
);

-- Never enforce uniqueness on archived deleted_flights: a restored event can
-- be deleted again while its earlier historical archive still exists.
CREATE UNIQUE INDEX IF NOT EXISTS idx_flights_owner_event_uid
  ON public.flights(user_id,event_uid) WHERE event_uid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_fstd_owner_event_uid
  ON public.fstd_sessions(user_id,event_uid) WHERE event_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deleted_flights_owner_event_uid
  ON public.deleted_flights(user_id,event_uid) WHERE event_uid IS NOT NULL;

-- No source data updates, DELETE, auto UID generator, or automatic enforcement.
COMMIT;
