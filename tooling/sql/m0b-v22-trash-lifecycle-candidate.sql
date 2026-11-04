-- M0-B V22 transactional Trash candidate. NOT a registered migration or active runtime.
-- ONLY executable on disposable local PostgreSQL16 after full V21+passive V22.
-- Twelve-calendar-month minimal marker is a PROVISIONAL retention parameter.
BEGIN;
DO $preflight$ BEGIN
  IF current_database() !~ '^flytally_m0b_disposable_[a-z0-9_]+$'
    OR current_user<>'flytally'
    OR coalesce(host(inet_server_addr()),'')<>'127.0.0.1'
    OR current_setting('server_version_num')::integer NOT BETWEEN 160000 AND 169999
    THEN RAISE EXCEPTION 'V22 lifecycle candidate requires isolated loopback PG16 flytally target'; END IF;
  IF to_regclass('public.flytally_schema_migrations') IS NULL
    OR to_regclass('public.users') IS NULL
    OR to_regclass('public.flights') IS NULL
    OR to_regclass('public.deleted_flights') IS NULL
    OR to_regclass('public.logbook_event_uid_registry') IS NULL
    THEN RAISE EXCEPTION 'V22 lifecycle candidate requires complete registered V21 and passive V22 tables'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.flytally_schema_migrations
      WHERE version=21 AND name='source-backed currency exact-money')
    OR (SELECT count(*) FROM public.flytally_schema_migrations)<>21
    THEN RAISE EXCEPTION 'V22 lifecycle candidate requires exactly V21 migration chain'; END IF;
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public'
      AND ((table_name='flights' AND column_name IN ('id','user_id','event_uid'))
        OR (table_name='deleted_flights' AND column_name IN
          ('id','user_id','original_flight_id','event_uid','flight_data','purge_after','restored_at','restored_flight_id'))
        OR (table_name='logbook_event_uid_registry' AND column_name IN
          ('owner_id','event_kind','event_uid','lifecycle_state','original_trash_cutoff','marker_until'))))<>17
    THEN RAISE EXCEPTION 'V22 lifecycle candidate exact source columns unavailable'; END IF;
  IF to_regprocedure('public.logbook_v22_expire_owner_candidate(bigint,integer)') IS NOT NULL
    THEN RAISE EXCEPTION 'V22 lifecycle candidate already exists; review required'; END IF;
END $preflight$;


-- Append-only, owner-scoped attestations. These are NOT inferred from legacy
-- archive fingerprints or populated by a migration. Future trusted restore
-- and re-delete writers must issue verified attestations while records exist.
-- A terminal proof is written atomically by the guarded final purge below.
CREATE TABLE public.logbook_v22_redelete_edge_candidate (
  owner_id BIGINT NOT NULL,
  event_kind TEXT NOT NULL DEFAULT 'flight' CHECK(event_kind='flight'),
  event_uid UUID NOT NULL,
  prior_archive_id BIGINT NOT NULL CHECK(prior_archive_id>0),
  prior_original_flight_id BIGINT NOT NULL CHECK(prior_original_flight_id>0),
  restored_flight_id BIGINT NOT NULL CHECK(restored_flight_id>0),
  restored_at TIMESTAMPTZ NOT NULL,
  next_archive_id BIGINT NOT NULL CHECK(next_archive_id>0),
  next_original_flight_id BIGINT NOT NULL CHECK(next_original_flight_id>0),
  next_purge_after TIMESTAMPTZ NOT NULL,
  attested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT m0b_edge_distinct_archives CHECK(prior_archive_id<>next_archive_id),
  CONSTRAINT m0b_edge_restored_link CHECK(restored_flight_id=next_original_flight_id),
  CONSTRAINT m0b_edge_restore_before_attestation CHECK(restored_at<=attested_at),
  PRIMARY KEY(owner_id,event_kind,event_uid,prior_archive_id),
  UNIQUE(owner_id,event_kind,event_uid,next_archive_id),
  FOREIGN KEY(owner_id,event_kind,event_uid)
    REFERENCES public.logbook_event_uid_registry(owner_id,event_kind,event_uid)
    ON DELETE RESTRICT
);

-- This source receipt is issued ONLY after a canonical V21-style restore
-- INSERT+archive mark occurred within the SAME database transaction.
-- It outlives the archived payload and prevents re-delete lineage gaps.
CREATE TABLE public.logbook_v22_restored_source_receipt_candidate(
  owner_id BIGINT NOT NULL,
  event_kind TEXT NOT NULL DEFAULT 'flight' CHECK(event_kind='flight'),
  event_uid UUID NOT NULL,
  archive_id BIGINT NOT NULL CHECK(archive_id>0),
  original_flight_id BIGINT NOT NULL CHECK(original_flight_id>0),
  restored_flight_id BIGINT NOT NULL CHECK(restored_flight_id>0),
  restored_at TIMESTAMPTZ NOT NULL,
  attested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(owner_id,event_kind,event_uid,archive_id),
  UNIQUE(owner_id,event_kind,event_uid,restored_flight_id),
  FOREIGN KEY(owner_id,event_kind,event_uid)
   REFERENCES public.logbook_event_uid_registry(owner_id,event_kind,event_uid)
   ON DELETE RESTRICT
);
CREATE TABLE public.logbook_v22_terminal_purge_candidate (
  owner_id BIGINT NOT NULL,
  event_kind TEXT NOT NULL DEFAULT 'flight' CHECK(event_kind='flight'),
  event_uid UUID NOT NULL,
  terminal_archive_id BIGINT NOT NULL CHECK(terminal_archive_id>0),
  terminal_original_flight_id BIGINT NOT NULL CHECK(terminal_original_flight_id>0),
  original_trash_cutoff TIMESTAMPTZ NOT NULL,
  attested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(owner_id,event_kind,event_uid),
  UNIQUE(owner_id,event_kind,terminal_archive_id),
  FOREIGN KEY(owner_id,event_kind,event_uid)
    REFERENCES public.logbook_event_uid_registry(owner_id,event_kind,event_uid)
    ON DELETE RESTRICT
);

-- Immutable evidence. No update/delete without a separate, reviewed legal
-- retention/erasure operation, which this candidate intentionally omits.
CREATE FUNCTION public.logbook_v22_reject_witness_change_candidate()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp
AS $immutable$
BEGIN
  RAISE EXCEPTION 'V22 immutable event lineage cannot be updated/deleted';
END
$immutable$;
CREATE TRIGGER m0b_immutable_edge BEFORE UPDATE OR DELETE
  ON public.logbook_v22_redelete_edge_candidate FOR EACH ROW
  EXECUTE FUNCTION public.logbook_v22_reject_witness_change_candidate();
CREATE TRIGGER m0b_immutable_terminal BEFORE UPDATE OR DELETE
  ON public.logbook_v22_terminal_purge_candidate FOR EACH ROW
  EXECUTE FUNCTION public.logbook_v22_reject_witness_change_candidate();

CREATE TRIGGER m0b_immutable_restored_receipt BEFORE UPDATE OR DELETE
  ON public.logbook_v22_restored_source_receipt_candidate FOR EACH ROW
  EXECUTE FUNCTION public.logbook_v22_reject_witness_change_candidate();
-- TEST-ONLY trusted writer prototype. This must eventually be called from
-- the authenticated source redel(et)e writer in the SAME owner transaction;
-- neither an imported archive nor a guessed source UID can create a witness.
CREATE FUNCTION public.logbook_v22_attest_redelete_candidate(
  p_owner BIGINT,p_uid UUID,p_prior_archive BIGINT,p_next_archive BIGINT
) RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,pg_temp SET lock_timeout='5s'
AS $attest$
DECLARE old_rec RECORD;next_rec RECORD;v_state TEXT;v_cutoff TIMESTAMPTZ;
BEGIN
  IF p_owner IS NULL OR p_owner<=0 OR p_uid IS NULL
    OR p_prior_archive IS NULL OR p_prior_archive<=0
    OR p_next_archive IS NULL OR p_next_archive<=0
    OR p_prior_archive=p_next_archive
    THEN RAISE EXCEPTION 'V22 lineage attestation requires verified owner/UID/two archives'; END IF;
  PERFORM 1 FROM public.users WHERE id=p_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'V22 lineage attestation missing owner gate'; END IF;
  SELECT r.lifecycle_state,r.original_trash_cutoff INTO v_state,v_cutoff
  FROM public.logbook_event_uid_registry r
  WHERE r.owner_id=p_owner AND r.event_kind='flight' AND r.event_uid=p_uid
  FOR UPDATE;
  IF NOT FOUND OR v_state<>'trash'
    THEN RAISE EXCEPTION 'V22 lineage attestation requires current Trash registry'; END IF;

  SELECT d.* INTO old_rec FROM public.deleted_flights d
    WHERE d.id=p_prior_archive AND d.user_id=p_owner AND d.event_uid=p_uid
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'V22 lineage attestation prior source unavailable'; END IF;
  SELECT d.* INTO next_rec FROM public.deleted_flights d
    WHERE d.id=p_next_archive AND d.user_id=p_owner AND d.event_uid=p_uid
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'V22 lineage attestation next source unavailable'; END IF;
  IF old_rec.restored_at IS NULL OR old_rec.restored_flight_id IS NULL
    OR old_rec.restored_at>next_rec.deleted_at
    OR old_rec.restored_at>NOW()
    OR next_rec.restored_at IS NOT NULL OR next_rec.restored_flight_id IS NOT NULL
    OR old_rec.restored_flight_id<>next_rec.original_flight_id
    OR v_cutoff IS DISTINCT FROM next_rec.purge_after
    OR NOT(old_rec.flight_data @> jsonb_build_object(
      'id',old_rec.original_flight_id,'user_id',p_owner,'event_uid',p_uid::text))
    OR NOT(next_rec.flight_data @> jsonb_build_object(
      'id',next_rec.original_flight_id,'user_id',p_owner,'event_uid',p_uid::text))
    THEN RAISE EXCEPTION 'V22 lineage attestation original/restore/redelete proof mismatch'; END IF;
  INSERT INTO public.logbook_v22_redelete_edge_candidate(
    owner_id,event_kind,event_uid,prior_archive_id,prior_original_flight_id,
    restored_flight_id,restored_at,next_archive_id,next_original_flight_id,
    next_purge_after)
  VALUES(p_owner,'flight',p_uid,old_rec.id,old_rec.original_flight_id,
    old_rec.restored_flight_id,old_rec.restored_at,next_rec.id,
    next_rec.original_flight_id,next_rec.purge_after);
END
$attest$;

-- SECURITY INVOKER, source-only function. The caller MUST separately prove
-- authenticated pilot ownership or authorized cron. A DB owner_id parameter
-- is not an authentication boundary. Each invocation is atomic.
CREATE FUNCTION public.logbook_v22_expire_owner_candidate(p_owner BIGINT,p_batch INTEGER)
RETURNS INTEGER LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,pg_temp
SET lock_timeout='5s'
AS $writer$
DECLARE rec RECORD; v_now TIMESTAMPTZ;
  v_state TEXT;v_cutoff TIMESTAMPTZ;v_marker TIMESTAMPTZ;
  v_pending INTEGER;v_linked INTEGER;v_affected INTEGER;v_expired INTEGER:=0;
  v_terminal BIGINT;v_terminal_cutoff TIMESTAMPTZ;v_matches INTEGER;
BEGIN
  IF p_owner IS NULL OR p_owner<=0 OR p_batch IS NULL OR p_batch<1 OR p_batch>25
    THEN RAISE EXCEPTION 'V22 expiry requires a positive owner and batch size 1..25'; END IF;
  -- First table read/lock, before fresh Trash read; never create missing owner.
  PERFORM 1 FROM public.users WHERE id=p_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'V22 expiry missing owner account gate'; END IF;
  v_now:=transaction_timestamp();
  FOR rec IN SELECT d.* FROM public.deleted_flights d
    WHERE d.user_id=p_owner AND d.purge_after<=v_now
    ORDER BY d.id LIMIT p_batch FOR UPDATE
  LOOP
    IF jsonb_typeof(rec.flight_data) IS DISTINCT FROM 'object'
      OR NOT (rec.flight_data @> jsonb_build_object('id',rec.original_flight_id,'user_id',rec.user_id))
      THEN RAISE EXCEPTION 'V22 expiry archive owner/flight snapshot mismatch'; END IF;
    IF (rec.restored_at IS NULL)<>(rec.restored_flight_id IS NULL)
      OR (rec.restored_at IS NOT NULL AND
        (rec.restored_at>v_now OR rec.restored_at>rec.purge_after))
      THEN RAISE EXCEPTION 'V22 expiry archive restoration state malformed'; END IF;
    IF rec.event_uid IS NULL THEN
      -- Legacy records have no proven issuer; NEVER synthesize an event UID.
      IF rec.flight_data->>'event_uid' IS NOT NULL
        THEN RAISE EXCEPTION 'V22 expiry legacy archive conflicts with snapshot UID'; END IF;
    ELSE
      IF rec.flight_data->>'event_uid' IS DISTINCT FROM rec.event_uid::text
        THEN RAISE EXCEPTION 'V22 expiry registered archive UID mismatches snapshot'; END IF;
      SELECT r.lifecycle_state,r.original_trash_cutoff,r.marker_until
        INTO v_state,v_cutoff,v_marker
        FROM public.logbook_event_uid_registry r
        WHERE r.owner_id=p_owner AND r.event_kind='flight'
          AND r.event_uid=rec.event_uid FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'V22 expiry missing owner event registry'; END IF;
      IF rec.restored_at IS NULL THEN
        IF v_state<>'trash' OR v_cutoff IS DISTINCT FROM rec.purge_after
          OR v_marker IS NOT NULL
          THEN RAISE EXCEPTION 'V22 expiry un-restored archive state/cutoff mismatch'; END IF;
        SELECT count(*)::int INTO v_pending FROM public.deleted_flights d
          WHERE d.user_id=p_owner AND d.event_uid=rec.event_uid AND d.restored_at IS NULL;
        IF v_pending<>1 OR EXISTS(SELECT 1 FROM public.flights f
          WHERE f.user_id=p_owner AND f.event_uid=rec.event_uid)
          THEN RAISE EXCEPTION 'V22 expiry pending archive has ambiguous live event'; END IF;
        -- A still-retained restored predecessor is only purgeable if the
        -- trusted source writer previously attested its successor archive.
        IF EXISTS (SELECT 1 FROM public.deleted_flights old_d
          WHERE old_d.user_id=p_owner AND old_d.event_uid=rec.event_uid
            AND old_d.id<>rec.id AND old_d.restored_at IS NOT NULL
            AND old_d.restored_flight_id=rec.original_flight_id
            AND NOT EXISTS(
              SELECT 1 FROM public.logbook_v22_redelete_edge_candidate edge
              WHERE edge.owner_id=p_owner AND edge.event_kind='flight'
                AND edge.event_uid=rec.event_uid AND edge.prior_archive_id=old_d.id
                AND edge.next_archive_id=rec.id
                AND edge.prior_original_flight_id=old_d.original_flight_id
                AND edge.restored_flight_id=old_d.restored_flight_id
                AND edge.restored_at=old_d.restored_at
                AND edge.next_original_flight_id=rec.original_flight_id
                AND edge.next_purge_after=rec.purge_after))
          THEN RAISE EXCEPTION 'V22 terminal purge missing immutable predecessor edge'; END IF;
        UPDATE public.logbook_event_uid_registry r
          SET lifecycle_state='purged',original_trash_cutoff=rec.purge_after,
            marker_until=rec.purge_after+INTERVAL '12 months'
          WHERE r.owner_id=p_owner AND r.event_kind='flight'
            AND r.event_uid=rec.event_uid AND r.lifecycle_state='trash';
        GET DIAGNOSTICS v_affected=ROW_COUNT;
        IF v_affected<>1 THEN RAISE EXCEPTION 'V22 expiry state transition conflict'; END IF;
        INSERT INTO public.logbook_v22_terminal_purge_candidate(
          owner_id,event_kind,event_uid,terminal_archive_id,
          terminal_original_flight_id,original_trash_cutoff)
        VALUES(p_owner,'flight',rec.event_uid,rec.id,
          rec.original_flight_id,rec.purge_after);
      ELSE
        IF v_state='active' THEN
          SELECT count(*)::int INTO v_linked FROM public.flights f
            WHERE f.id=rec.restored_flight_id AND f.user_id=p_owner
              AND f.event_uid=rec.event_uid;
          IF v_linked<>1
            THEN RAISE EXCEPTION 'V22 expiry restored active flight owner/UID mismatch'; END IF;
        ELSIF v_state='trash' THEN
          -- A prior restored archive can expire after the event was deleted
          -- again. The new pending snapshot must prove the restored ID link.
          SELECT count(*)::int,count(*) FILTER
            (WHERE d.original_flight_id=rec.restored_flight_id AND d.purge_after=v_cutoff)::int
            INTO v_pending,v_linked
            FROM public.deleted_flights d WHERE d.user_id=p_owner
              AND d.event_uid=rec.event_uid AND d.restored_at IS NULL;
          IF v_pending<>1 OR v_linked<>1 OR v_marker IS NOT NULL
            THEN RAISE EXCEPTION 'V22 expiry re-deleted event lineage unavailable'; END IF;
        ELSIF v_state='purged' THEN
          -- Recover an immutable path of source-attested re-deletions from
          -- this older restored archive to the terminal purged archive.
          SELECT t.terminal_archive_id,t.original_trash_cutoff
            INTO v_terminal,v_terminal_cutoff
            FROM public.logbook_v22_terminal_purge_candidate t
            WHERE t.owner_id=p_owner AND t.event_kind='flight'
              AND t.event_uid=rec.event_uid;
          IF NOT FOUND OR v_terminal_cutoff IS DISTINCT FROM v_cutoff
            OR v_marker IS DISTINCT FROM v_cutoff+INTERVAL '12 months'
            THEN RAISE EXCEPTION 'V22 expiry terminal lineage receipt unavailable'; END IF;
          IF EXISTS(SELECT 1 FROM public.flights f
            WHERE f.user_id=p_owner AND f.event_uid=rec.event_uid)
            THEN RAISE EXCEPTION 'V22 expiry purged event still has a live flight'; END IF;
          -- Adjacent immutable edge validates the archived record's exact
          -- source owner, original flight ID, restored flight ID & timestamp.
          IF NOT EXISTS(SELECT 1 FROM public.logbook_v22_redelete_edge_candidate edge
            WHERE edge.owner_id=p_owner AND edge.event_kind='flight'
              AND edge.event_uid=rec.event_uid AND edge.prior_archive_id=rec.id
              AND edge.prior_original_flight_id=rec.original_flight_id
              AND edge.restored_flight_id=rec.restored_flight_id
              AND edge.restored_at=rec.restored_at)
            THEN RAISE EXCEPTION 'V22 expiry restored archive lacks immutable first edge'; END IF;
          WITH RECURSIVE chain(archive_id,depth,visited) AS(
            SELECT rec.id::BIGINT,0,ARRAY[rec.id::BIGINT]
            UNION ALL
            SELECT edge.next_archive_id,c.depth+1,c.visited||edge.next_archive_id
            FROM chain c
            JOIN public.logbook_v22_redelete_edge_candidate edge
              ON edge.owner_id=p_owner AND edge.event_kind='flight'
                AND edge.event_uid=rec.event_uid
                AND edge.prior_archive_id=c.archive_id
            WHERE c.depth<64 AND NOT(edge.next_archive_id=ANY(c.visited))
          ) SELECT count(*)::INTEGER INTO v_matches FROM chain
            WHERE archive_id=v_terminal AND depth>0;
          IF v_matches<>1 THEN
            RAISE EXCEPTION 'V22 expiry restored archive cannot reach immutable terminal purge'; END IF;
        ELSE
          RAISE EXCEPTION 'V22 expiry restored archive lifecycle provenance unavailable';
        END IF;
      END IF;
    END IF;
    DELETE FROM public.deleted_flights d WHERE d.id=rec.id AND d.user_id=p_owner
      AND d.purge_after<=v_now AND d.event_uid IS NOT DISTINCT FROM rec.event_uid;
    GET DIAGNOSTICS v_affected=ROW_COUNT;
    IF v_affected<>1 THEN RAISE EXCEPTION 'V22 expiry archived payload delete conflict'; END IF;
    v_expired:=v_expired+1;
  END LOOP;
  RETURN v_expired;
END $writer$;

-- Tested post-restore adapter; NOT invoked from V21. The application V22
-- restoration transaction, when separately approved, must acquire the owner
-- gate then execute canonical V21 restore CTE and this finalizer in ONE
-- sql.transaction([...]) (no separate HTTP round-trip). SECURITY INVOKER
-- does not authenticate the owner: server-side requireUser remains mandatory.
CREATE FUNCTION public.logbook_v22_finalize_restored_source_candidate(
 p_owner BIGINT,p_archive BIGINT
) RETURNS BIGINT LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,pg_temp SET lock_timeout='5s'
AS $finalize$
DECLARE d RECORD;f RECORD;r RECORD;v_xid BIGINT;v_n INTEGER;
BEGIN
 IF p_owner IS NULL OR p_owner<=0 OR p_archive IS NULL OR p_archive<=0
   THEN RAISE EXCEPTION 'V22 restore finalizer requires positive owner/archive';END IF;
 PERFORM 1 FROM public.users WHERE id=p_owner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'V22 restore finalizer owner gate absent';END IF;
 SELECT a.* INTO d FROM public.deleted_flights a
   WHERE a.id=p_archive AND a.user_id=p_owner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'V22 restore finalizer source archive absent';END IF;
 IF d.event_uid IS NULL OR d.restored_at IS NULL
   OR d.restored_flight_id IS NULL OR d.restored_at>NOW()
   OR d.restored_at>d.purge_after
   OR NOT(d.flight_data @> jsonb_build_object(
       'id',d.original_flight_id,'user_id',p_owner,'event_uid',d.event_uid::text))
   THEN RAISE EXCEPTION 'V22 restore finalizer source identity malformed';END IF;
 SELECT live.* INTO f FROM public.flights live
   WHERE live.id=d.restored_flight_id AND live.user_id=p_owner FOR UPDATE;
 IF NOT FOUND OR f.event_uid IS NOT NULL
   OR f.certified_at IS NOT NULL OR f.locked_at IS NOT NULL
   OR COALESCE(f.record_revision,1)<>1
   OR f.date::text IS DISTINCT FROM d.flight_data->>'date'
   OR f.registration IS DISTINCT FROM d.flight_data->>'registration'
   OR f.off_block IS DISTINCT FROM d.flight_data->>'off_block'
   OR f.departure IS DISTINCT FROM d.flight_data->>'departure'
   OR f.arrival IS DISTINCT FROM d.flight_data->>'arrival'
   THEN RAISE EXCEPTION 'V22 restore finalizer live identity mismatch';END IF;
 -- Both archive mark and newly created flight MUST originate from this
 -- SAME PostgreSQL transaction, preventing after-the-fact receipt forgery.
 v_xid:=mod(txid_current(),4294967296::BIGINT);
 IF d.xmin::text::BIGINT<>v_xid OR f.xmin::text::BIGINT<>v_xid
   THEN RAISE EXCEPTION 'V22 restore finalizer requires same transaction mark and insert';END IF;
 SELECT reg.* INTO r FROM public.logbook_event_uid_registry reg
   WHERE reg.owner_id=p_owner AND reg.event_kind='flight'
     AND reg.event_uid=d.event_uid FOR UPDATE;
 IF NOT FOUND OR r.lifecycle_state<>'trash'
   OR r.original_trash_cutoff IS DISTINCT FROM d.purge_after
   OR r.marker_until IS NOT NULL
   OR EXISTS(SELECT 1 FROM public.deleted_flights other
     WHERE other.user_id=p_owner AND other.event_uid=d.event_uid
       AND other.restored_at IS NULL)
   OR EXISTS(SELECT 1 FROM public.flights other
     WHERE other.user_id=p_owner AND other.event_uid=d.event_uid)
   THEN RAISE EXCEPTION 'V22 restore finalizer registry conflict';END IF;
 UPDATE public.flights SET event_uid=d.event_uid
   WHERE id=d.restored_flight_id AND user_id=p_owner AND event_uid IS NULL;
 GET DIAGNOSTICS v_n=ROW_COUNT;
 IF v_n<>1 THEN RAISE EXCEPTION 'V22 restore finalizer UID assignment conflict';END IF;
 UPDATE public.logbook_event_uid_registry
   SET lifecycle_state='active',original_trash_cutoff=NULL,marker_until=NULL
   WHERE owner_id=p_owner AND event_kind='flight'
     AND event_uid=d.event_uid AND lifecycle_state='trash';
 GET DIAGNOSTICS v_n=ROW_COUNT;
 IF v_n<>1 THEN RAISE EXCEPTION 'V22 restore finalizer transition conflict';END IF;
 INSERT INTO public.logbook_v22_restored_source_receipt_candidate(
   owner_id,event_kind,event_uid,archive_id,original_flight_id,
   restored_flight_id,restored_at)
 VALUES(p_owner,'flight',d.event_uid,d.id,d.original_flight_id,
   d.restored_flight_id,d.restored_at);
 RETURN d.restored_flight_id;
END
$finalize$;


-- Staged owner-gated source writer, NOT callable by any live V21 path.
-- Mirrors A+ protected/unlinked draft eligibility in moveFlightToTrash;
-- when source verification is missing, refuse BEFORE archived mutation.
-- One SQL function invocation is atomic: archive -> track cleanup -> live
-- deletion -> registry transition -> immutable event edge or full rollback.
CREATE FUNCTION public.logbook_v22_redelete_source_candidate(
 p_owner BIGINT,p_flight BIGINT,p_token UUID
) RETURNS BIGINT LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,pg_temp SET lock_timeout='5s'
AS $source_delete$
DECLARE f RECORD;reg RECORD;prior RECORD;v_archive BIGINT;
 v_cutoff TIMESTAMPTZ;v_count INTEGER;
BEGIN
 IF p_owner IS NULL OR p_owner<=0 OR p_flight IS NULL OR p_flight<=0
   OR p_token IS NULL THEN
   RAISE EXCEPTION 'V22 redelete source requires positive owner/flight and token';END IF;
 PERFORM 1 FROM public.users WHERE id=p_owner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'V22 redelete source owner gate absent';END IF;
 SELECT live.* INTO f FROM public.flights live
   WHERE live.id=p_flight AND live.user_id=p_owner FOR UPDATE;
 IF NOT FOUND OR f.event_uid IS NULL OR f.certified_at IS NOT NULL
   OR f.locked_at IS NOT NULL OR COALESCE(f.record_revision,1)<>1
   THEN RAISE EXCEPTION 'V22 redelete source protected or unknown live identity';END IF;

 -- No authorization by SQL parameter. These must be run only by an
 -- authenticated server owner-bound action once separately approved.
 IF to_regclass('public.flight_participations') IS NULL
   OR to_regclass('public.flight_connected_crew') IS NULL
   OR to_regclass('public.flight_verifications') IS NULL
   OR to_regclass('public.instructor_flight_approvals') IS NULL
   OR to_regclass('public.flight_source_provenance') IS NULL
   OR to_regclass('public.flight_public_shares') IS NULL
   OR to_regclass('public.flight_certified_revisions') IS NULL
   OR to_regclass('public.voided_certified_flights') IS NULL
   OR to_regclass('public.flight_expenses') IS NULL
   OR to_regclass('public.flight_tracks') IS NULL
   OR to_regclass('public.track_points') IS NULL
   THEN RAISE EXCEPTION 'V22 redelete source prerequisite protected tables absent';END IF;
 IF EXISTS(SELECT 1 FROM public.flight_participations p
     WHERE p.source_flight_id=f.id OR p.participant_flight_id=f.id)
   OR EXISTS(SELECT 1 FROM public.flight_connected_crew c
     WHERE c.source_flight_id=f.id)
   OR EXISTS(SELECT 1 FROM public.flight_verifications v
     WHERE v.flight_id=f.id)
   OR EXISTS(SELECT 1 FROM public.instructor_flight_approvals a
     WHERE a.flight_id=f.id)
   OR EXISTS(SELECT 1 FROM public.flight_source_provenance p
     WHERE p.source_flight_id=f.id OR p.participant_flight_id=f.id)
   OR EXISTS(SELECT 1 FROM public.flight_public_shares s
     WHERE s.flight_id=f.id)
   OR EXISTS(SELECT 1 FROM public.flight_certified_revisions v
     WHERE v.flight_id=f.id)
   OR EXISTS(SELECT 1 FROM public.voided_certified_flights v
     WHERE v.user_id=p_owner AND v.original_flight_id=f.id)
   THEN RAISE EXCEPTION 'V22 redelete source protected participant/certified evidence';END IF;
 SELECT r.* INTO reg FROM public.logbook_event_uid_registry r
   WHERE r.owner_id=p_owner AND r.event_kind='flight'
     AND r.event_uid=f.event_uid FOR UPDATE;
 IF NOT FOUND OR reg.lifecycle_state<>'active'
   OR reg.original_trash_cutoff IS NOT NULL OR reg.marker_until IS NOT NULL
   OR EXISTS(SELECT 1 FROM public.deleted_flights d
     WHERE d.user_id=p_owner AND d.event_uid=f.event_uid
       AND d.restored_at IS NULL)
   THEN RAISE EXCEPTION 'V22 redelete source registry/lifecycle unavailable';END IF;

 SELECT receipt.* INTO prior
   FROM public.logbook_v22_restored_source_receipt_candidate receipt
   WHERE receipt.owner_id=p_owner AND receipt.event_kind='flight'
     AND receipt.event_uid=f.event_uid AND receipt.restored_flight_id=f.id
   FOR UPDATE;
 IF NOT FOUND AND EXISTS(SELECT 1 FROM public.deleted_flights d
   WHERE d.user_id=p_owner AND d.event_uid=f.event_uid
     AND d.restored_flight_id=f.id)
   THEN RAISE EXCEPTION 'V22 redelete source missing trusted restoration receipt';END IF;

 INSERT INTO public.deleted_flights(user_id,original_flight_id,delete_token,
   flight_data,tracks_data,expenses_data,event_uid)
 SELECT f.user_id,f.id,p_token::text,to_jsonb(f),
   COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id)
     FROM public.flight_tracks t
     WHERE t.user_id=p_owner AND t.flight_id=f.id),'[]'::jsonb),
   COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id)
     FROM public.flight_expenses e
     WHERE e.user_id=p_owner AND e.flight_id=f.id),'[]'::jsonb),f.event_uid
 RETURNING id,purge_after INTO v_archive,v_cutoff;
 DELETE FROM public.track_points t WHERE t.user_id=p_owner AND
   t.track_id IN(SELECT id FROM public.flight_tracks
     WHERE user_id=p_owner AND flight_id=p_flight);
 DELETE FROM public.flight_tracks WHERE user_id=p_owner AND flight_id=p_flight;
 DELETE FROM public.flights WHERE id=p_flight AND user_id=p_owner
   AND event_uid=f.event_uid AND certified_at IS NULL AND locked_at IS NULL
   AND COALESCE(record_revision,1)=1;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>1 THEN RAISE EXCEPTION 'V22 redelete source flight deletion conflict';END IF;
 UPDATE public.logbook_event_uid_registry
   SET lifecycle_state='trash',original_trash_cutoff=v_cutoff,
     marker_until=NULL WHERE owner_id=p_owner AND event_kind='flight'
       AND event_uid=f.event_uid AND lifecycle_state='active';
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>1 THEN RAISE EXCEPTION 'V22 redelete source registry transition conflict';END IF;
 IF prior.archive_id IS NOT NULL THEN
   IF prior.restored_at>NOW() OR prior.restored_flight_id<>f.id
     OR (SELECT deleted_at FROM public.deleted_flights WHERE id=v_archive)<prior.restored_at
     THEN RAISE EXCEPTION 'V22 redelete source immutable receipt chronology mismatch';END IF;
   INSERT INTO public.logbook_v22_redelete_edge_candidate(
     owner_id,event_kind,event_uid,prior_archive_id,prior_original_flight_id,
     restored_flight_id,restored_at,next_archive_id,
     next_original_flight_id,next_purge_after)
   VALUES(p_owner,'flight',f.event_uid,prior.archive_id,
     prior.original_flight_id,prior.restored_flight_id,prior.restored_at,
     v_archive,f.id,v_cutoff);
 END IF;
 RETURN v_archive;
END
$source_delete$;

-- PostgreSQL defaults public EXECUTE; do not grant this even to read-only
-- test roles. The owning local fixture principal retains inherent access.
REVOKE ALL ON FUNCTION public.logbook_v22_expire_owner_candidate(BIGINT,INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.logbook_v22_attest_redelete_candidate(BIGINT,UUID,BIGINT,BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.logbook_v22_finalize_restored_source_candidate(BIGINT,BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.logbook_v22_redelete_source_candidate(BIGINT,BIGINT,UUID) FROM PUBLIC;
COMMIT;
