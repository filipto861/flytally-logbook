\set ON_ERROR_STOP on
\pset pager off

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=public,pg_catalog;

SELECT pg_advisory_xact_lock(704190104);

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
    RAISE EXCEPTION '3.5 v20 migration: wrong database target: %',current_database();
  END IF;
  IF pg_is_in_recovery() THEN
    RAISE EXCEPTION '3.5 v20 migration: target is a recovery/replica database';
  END IF;
  FOR v IN 1..19 LOOP
    SELECT m.name INTO actual_name FROM public.flytally_schema_migrations m WHERE m.version=v;
    IF actual_name IS NULL OR actual_name IS DISTINCT FROM expected_names[v] THEN
      RAISE EXCEPTION '3.5 v20 migration: registry drift at version %',v;
    END IF;
  END LOOP;
  IF (SELECT COUNT(*) FROM public.flytally_schema_migrations)<>19
     OR EXISTS(SELECT 1 FROM public.flytally_schema_migrations WHERE version<1 OR version>19) THEN
    RAISE EXCEPTION '3.5 v20 migration: registry is not exact versions 1..19';
  END IF;
  IF to_regclass('public.voided_certified_flights') IS NOT NULL
     OR to_regclass('public.voided_flight_certified_revisions') IS NOT NULL
     OR to_regclass('public.voided_flight_verifications') IS NOT NULL
     OR to_regclass('public.voided_flight_archive_items') IS NOT NULL
     OR to_regclass('public.flight_source_provenance') IS NOT NULL THEN
    RAISE EXCEPTION '3.5 v20 migration: partial v20 state detected';
  END IF;
END
$v350$;

CREATE TABLE IF NOT EXISTS voided_certified_flights (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      original_flight_id BIGINT NOT NULL,
      record_revision INTEGER NOT NULL CHECK(record_revision>=1),
      certification_hash TEXT NOT NULL CHECK(NULLIF(TRIM(certification_hash),'') IS NOT NULL),
      certification_version INTEGER NOT NULL CHECK(certification_version>=1),
      certified_at TIMESTAMPTZ NOT NULL,
      certified_by_user_id BIGINT,
      flight_snapshot JSONB NOT NULL,
      flight_snapshot_sha256 TEXT NOT NULL CHECK(flight_snapshot_sha256 ~ '^[a-f0-9]{64}$'),
      archive_version INTEGER NOT NULL DEFAULT 1 CHECK(archive_version>=1),
      voided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      voided_by_user_id BIGINT NOT NULL,
      void_reason TEXT NOT NULL CHECK(char_length(TRIM(void_reason)) BETWEEN 8 AND 1000),
      operation_token UUID NOT NULL UNIQUE,
      created_txid BIGINT NOT NULL DEFAULT txid_current(),
      UNIQUE(user_id,original_flight_id),
      UNIQUE(user_id,original_flight_id,record_revision,certification_hash)
    );

CREATE TABLE IF NOT EXISTS voided_flight_certified_revisions (
      id BIGSERIAL PRIMARY KEY,
      voided_flight_id BIGINT NOT NULL REFERENCES voided_certified_flights(id) ON DELETE RESTRICT,
      source_revision_id BIGINT NOT NULL,
      revision_number INTEGER NOT NULL CHECK(revision_number>=1),
      certification_hash TEXT NOT NULL,
      certification_version INTEGER NOT NULL CHECK(certification_version>=1),
      certified_at TIMESTAMPTZ NOT NULL,
      superseded_at TIMESTAMPTZ,
      correction_reason TEXT NOT NULL DEFAULT '',
      snapshot_data JSONB NOT NULL,
      snapshot_sha256 TEXT NOT NULL CHECK(snapshot_sha256 ~ '^[a-f0-9]{64}$'),
      archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(voided_flight_id,revision_number),
      UNIQUE(voided_flight_id,source_revision_id)
    );

CREATE TABLE IF NOT EXISTS voided_flight_verifications (
      id BIGSERIAL PRIMARY KEY,
      voided_flight_id BIGINT NOT NULL REFERENCES voided_certified_flights(id) ON DELETE RESTRICT,
      source_verification_id BIGINT NOT NULL,
      record_revision INTEGER NOT NULL CHECK(record_revision>=1),
      verification_role TEXT NOT NULL,
      status TEXT NOT NULL,
      signer_user_id BIGINT,
      flight_hash TEXT NOT NULL,
      payload_hash TEXT NOT NULL DEFAULT '',
      server_signature TEXT NOT NULL DEFAULT '',
      signed_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      credential_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
      source_data JSONB NOT NULL,
      source_sha256 TEXT NOT NULL CHECK(source_sha256 ~ '^[a-f0-9]{64}$'),
      archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(voided_flight_id,source_verification_id)
    );

CREATE TABLE IF NOT EXISTS voided_flight_archive_items (
      id BIGSERIAL PRIMARY KEY,
      voided_flight_id BIGINT NOT NULL REFERENCES voided_certified_flights(id) ON DELETE RESTRICT,
      item_kind TEXT NOT NULL CHECK(item_kind IN ('INSTRUCTOR_APPROVAL','PARTICIPATION','CONNECTED_CREW','PUBLIC_SHARE','EXPENSE','TRACK','SOURCE_PROVENANCE')),
      source_key TEXT NOT NULL,
      source_data JSONB NOT NULL,
      source_sha256 TEXT NOT NULL CHECK(source_sha256 ~ '^[a-f0-9]{64}$'),
      archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(voided_flight_id,item_kind,source_key)
    );

CREATE TABLE IF NOT EXISTS flight_source_provenance (
      id BIGSERIAL PRIMARY KEY,
      participant_flight_id BIGINT NOT NULL,
      participant_user_id BIGINT NOT NULL,
      source_flight_id BIGINT NOT NULL,
      source_user_id BIGINT NOT NULL,
      source_revision INTEGER NOT NULL CHECK(source_revision>=1),
      source_hash TEXT NOT NULL,
      participant_role TEXT NOT NULL,
      pic_commander_basis TEXT,
      accepted_at TIMESTAMPTZ,
      source_voided_flight_id BIGINT REFERENCES voided_certified_flights(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT flight_source_provenance_participant_owner_fk
        FOREIGN KEY(participant_flight_id,participant_user_id) REFERENCES flights(id,user_id) ON DELETE CASCADE,
      UNIQUE(participant_flight_id,participant_user_id)
    );

INSERT INTO flight_source_provenance(
      participant_flight_id,participant_user_id,source_flight_id,source_user_id,source_revision,source_hash,
      participant_role,pic_commander_basis,accepted_at
    )
    SELECT p.participant_flight_id,p.participant_user_id,p.source_flight_id,p.source_user_id,
      GREATEST(COALESCE(p.source_revision,1),1),COALESCE(p.source_hash,''),
      COALESCE(p.participant_role,''),p.pic_commander_basis,COALESCE(p.responded_at,p.created_at)
    FROM flight_participations p
    JOIN flights own ON own.id=p.participant_flight_id AND own.user_id=p.participant_user_id
    WHERE p.status='accepted' AND p.participant_flight_id IS NOT NULL
    ON CONFLICT(participant_flight_id,participant_user_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_voided_certified_flights_user_date
      ON voided_certified_flights(user_id,voided_at DESC,id DESC);

CREATE INDEX IF NOT EXISTS idx_voided_flight_archive_items_parent_kind
      ON voided_flight_archive_items(voided_flight_id,item_kind,id);

CREATE INDEX IF NOT EXISTS idx_voided_flight_verifications_parent_revision
      ON voided_flight_verifications(voided_flight_id,record_revision,id);

CREATE INDEX IF NOT EXISTS idx_flight_source_provenance_source
      ON flight_source_provenance(source_user_id,source_flight_id,source_revision);

CREATE INDEX IF NOT EXISTS idx_flight_source_provenance_voided
      ON flight_source_provenance(source_voided_flight_id) WHERE source_voided_flight_id IS NOT NULL;

CREATE OR REPLACE FUNCTION logbook_protect_source_provenance() RETURNS TRIGGER AS $provenance$
      BEGIN
        IF TG_OP='DELETE' THEN
          RAISE EXCEPTION 'Flight source provenance is immutable';
        END IF;

        IF TG_OP='INSERT' THEN
          IF NEW.source_voided_flight_id IS NOT NULL
            AND NOT EXISTS(
              SELECT 1 FROM voided_certified_flights v
              WHERE v.id=NEW.source_voided_flight_id
                AND v.user_id=NEW.source_user_id
                AND v.original_flight_id=NEW.source_flight_id
                AND v.record_revision=NEW.source_revision
                AND v.certification_hash=NEW.source_hash
            )
          THEN
            RAISE EXCEPTION 'Flight source provenance does not match its source tombstone';
          END IF;
          RETURN NEW;
        END IF;

        IF OLD.source_voided_flight_id IS NULL
          AND NEW.source_voided_flight_id IS NOT NULL
          AND (to_jsonb(OLD)-'source_voided_flight_id'-'updated_at')
              IS NOT DISTINCT FROM
              (to_jsonb(NEW)-'source_voided_flight_id'-'updated_at')
          AND EXISTS(
            SELECT 1 FROM voided_certified_flights v
            WHERE v.id=NEW.source_voided_flight_id
              AND v.user_id=NEW.source_user_id
              AND v.original_flight_id=NEW.source_flight_id
              AND v.record_revision=NEW.source_revision
              AND v.certification_hash=NEW.source_hash
              AND v.created_txid=txid_current()
          )
        THEN
          RETURN NEW;
        END IF;
        IF to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN
          RAISE EXCEPTION 'Flight source provenance is immutable';
        END IF;
        RETURN NEW;
      END;
    $provenance$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_logbook_protect_source_provenance ON flight_source_provenance;

CREATE TRIGGER trg_logbook_protect_source_provenance
      BEFORE INSERT OR UPDATE OR DELETE ON flight_source_provenance
      FOR EACH ROW EXECUTE FUNCTION logbook_protect_source_provenance();

CREATE OR REPLACE FUNCTION logbook_require_void_archive_separation() RETURNS TRIGGER AS $$
      BEGIN
        IF EXISTS(
          SELECT 1 FROM flights f
          WHERE f.id=NEW.original_flight_id AND f.user_id=NEW.user_id
        ) THEN
          RAISE EXCEPTION 'Voided certified flight archive cannot coexist with its active flight';
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_logbook_require_void_archive_separation ON voided_certified_flights;

CREATE CONSTRAINT TRIGGER trg_logbook_require_void_archive_separation
      AFTER INSERT ON voided_certified_flights
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION logbook_require_void_archive_separation();

CREATE OR REPLACE FUNCTION logbook_validate_void_archive_child_insert() RETURNS TRIGGER AS $$
      BEGIN
        IF NOT EXISTS(
          SELECT 1 FROM voided_certified_flights v
          WHERE v.id=NEW.voided_flight_id AND v.created_txid=txid_current()
        ) THEN
          RAISE EXCEPTION 'Void archive evidence must be captured in the tombstone transaction';
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_logbook_validate_voided_flight_revisions_insert ON voided_flight_certified_revisions;

CREATE TRIGGER trg_logbook_validate_voided_flight_revisions_insert
      BEFORE INSERT ON voided_flight_certified_revisions
      FOR EACH ROW EXECUTE FUNCTION logbook_validate_void_archive_child_insert();

DROP TRIGGER IF EXISTS trg_logbook_validate_voided_flight_verifications_insert ON voided_flight_verifications;

CREATE TRIGGER trg_logbook_validate_voided_flight_verifications_insert
      BEFORE INSERT ON voided_flight_verifications
      FOR EACH ROW EXECUTE FUNCTION logbook_validate_void_archive_child_insert();

DROP TRIGGER IF EXISTS trg_logbook_validate_voided_flight_archive_items_insert ON voided_flight_archive_items;

CREATE TRIGGER trg_logbook_validate_voided_flight_archive_items_insert
      BEFORE INSERT ON voided_flight_archive_items
      FOR EACH ROW EXECUTE FUNCTION logbook_validate_void_archive_child_insert();

CREATE OR REPLACE FUNCTION logbook_protect_void_archive() RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Certified flight void archive is immutable';
      END;
    $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_logbook_protect_voided_certified_flights ON voided_certified_flights;

CREATE TRIGGER trg_logbook_protect_voided_certified_flights
      BEFORE UPDATE OR DELETE ON voided_certified_flights
      FOR EACH ROW EXECUTE FUNCTION logbook_protect_void_archive();

DROP TRIGGER IF EXISTS trg_logbook_protect_voided_flight_revisions ON voided_flight_certified_revisions;

CREATE TRIGGER trg_logbook_protect_voided_flight_revisions
      BEFORE UPDATE OR DELETE ON voided_flight_certified_revisions
      FOR EACH ROW EXECUTE FUNCTION logbook_protect_void_archive();

DROP TRIGGER IF EXISTS trg_logbook_protect_voided_flight_verifications ON voided_flight_verifications;

CREATE TRIGGER trg_logbook_protect_voided_flight_verifications
      BEFORE UPDATE OR DELETE ON voided_flight_verifications
      FOR EACH ROW EXECUTE FUNCTION logbook_protect_void_archive();

DROP TRIGGER IF EXISTS trg_logbook_protect_voided_flight_archive_items ON voided_flight_archive_items;

CREATE TRIGGER trg_logbook_protect_voided_flight_archive_items
      BEFORE UPDATE OR DELETE ON voided_flight_archive_items
      FOR EACH ROW EXECUTE FUNCTION logbook_protect_void_archive();

CREATE OR REPLACE FUNCTION logbook_prevent_voided_flight_id_reuse() RETURNS TRIGGER AS $$
      BEGIN
        IF EXISTS(
          SELECT 1 FROM voided_certified_flights v
          WHERE v.user_id=NEW.user_id AND v.original_flight_id=NEW.id
        ) THEN
          RAISE EXCEPTION 'Voided certified flight identity cannot be recreated as an active flight';
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_logbook_prevent_voided_flight_id_reuse ON flights;

CREATE TRIGGER trg_logbook_prevent_voided_flight_id_reuse
      BEFORE INSERT ON flights FOR EACH ROW EXECUTE FUNCTION logbook_prevent_voided_flight_id_reuse();

CREATE OR REPLACE FUNCTION logbook_protect_locked_flight() RETURNS TRIGGER AS $void$
      DECLARE correction_transition BOOLEAN:=FALSE; certified_void_transition BOOLEAN:=FALSE;
      BEGIN
        IF TG_OP='DELETE' THEN
          IF OLD.certified_at IS NOT NULL THEN
            certified_void_transition:=EXISTS(
              SELECT 1 FROM voided_certified_flights v
              WHERE v.user_id=OLD.user_id
                AND v.original_flight_id=OLD.id
                AND v.record_revision=COALESCE(OLD.record_revision,1)
                AND v.certification_hash=COALESCE(OLD.certification_hash,'')
                AND v.created_txid=txid_current()
                AND v.flight_snapshot IS NOT DISTINCT FROM to_jsonb(OLD)
            );
            IF NOT certified_void_transition THEN
              RAISE EXCEPTION 'Certified flight cannot be deleted without a matching same-transaction void archive';
            END IF;
            RETURN OLD;
          END IF;
          IF OLD.locked_at IS NOT NULL THEN RAISE EXCEPTION 'Locked flight cannot be deleted'; END IF;
          RETURN OLD;
        END IF;

        IF OLD.certified_at IS NOT NULL THEN
          correction_transition :=
            NEW.certified_at IS NULL
            AND COALESCE(NEW.certification_hash,'')=''
            AND NEW.locked_at IS NULL
            AND COALESCE(NEW.record_revision,1)=COALESCE(OLD.record_revision,1)+1
            AND NULLIF(TRIM(COALESCE(NEW.correction_reason,'')),'') IS NOT NULL
            AND (to_jsonb(OLD)-'certified_at'-'certified_by_user_id'-'certification_hash'-'locked_at'-'locked_by_user_id'-'record_revision'-'correction_reason'-'correction_opened_at'-'correction_opened_by_user_id')
                IS NOT DISTINCT FROM
                (to_jsonb(NEW)-'certified_at'-'certified_by_user_id'-'certification_hash'-'locked_at'-'locked_by_user_id'-'record_revision'-'correction_reason'-'correction_opened_at'-'correction_opened_by_user_id')
            AND EXISTS(
              SELECT 1 FROM flight_certified_revisions r
              WHERE r.user_id=OLD.user_id AND r.flight_id=OLD.id
                AND r.revision_number=COALESCE(OLD.record_revision,1)
                AND r.certification_hash=COALESCE(OLD.certification_hash,'')
            );
          IF NOT correction_transition THEN RAISE EXCEPTION 'Certified flight is immutable; start a traceable correction instead'; END IF;
          RETURN NEW;
        END IF;

        IF OLD.locked_at IS NOT NULL
          AND (to_jsonb(OLD)-'locked_at'-'locked_by_user_id') IS DISTINCT FROM (to_jsonb(NEW)-'locked_at'-'locked_by_user_id') THEN
          RAISE EXCEPTION 'Locked flight cannot be changed';
        END IF;
        RETURN NEW;
      END;
    $void$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_logbook_protect_locked_flight ON flights;

CREATE TRIGGER trg_logbook_protect_locked_flight
      BEFORE UPDATE OR DELETE ON flights
      FOR EACH ROW EXECUTE FUNCTION logbook_protect_locked_flight();

INSERT INTO public.flytally_schema_migrations(version,name)
VALUES(20,'certified flight void archive and provenance');

DO $v350$
DECLARE
  expected_candidates bigint;
  actual_provenance bigint;
BEGIN
  IF (SELECT COUNT(*) FROM public.flytally_schema_migrations
      WHERE version=20 AND name='certified flight void archive and provenance')<>1 THEN
    RAISE EXCEPTION '3.5 v20 migration: exact registry row missing or duplicated';
  END IF;

  SELECT COUNT(*) INTO expected_candidates
  FROM public.flight_participations p
  JOIN public.flights own ON own.id=p.participant_flight_id AND own.user_id=p.participant_user_id
  WHERE p.status='accepted' AND p.participant_flight_id IS NOT NULL;

  SELECT COUNT(*) INTO actual_provenance FROM public.flight_source_provenance;
  IF actual_provenance<>expected_candidates THEN
    RAISE EXCEPTION '3.5 v20 migration: provenance backfill count mismatch: expected %, observed %',expected_candidates,actual_provenance;
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
    RAISE EXCEPTION '3.5 v20 migration: provenance backfill content mismatch';
  END IF;

  IF EXISTS(SELECT 1 FROM public.voided_certified_flights)
     OR EXISTS(SELECT 1 FROM public.voided_flight_certified_revisions)
     OR EXISTS(SELECT 1 FROM public.voided_flight_verifications)
     OR EXISTS(SELECT 1 FROM public.voided_flight_archive_items) THEN
    RAISE EXCEPTION '3.5 v20 migration: migration unexpectedly created void history';
  END IF;
END
$v350$;

COMMIT;
