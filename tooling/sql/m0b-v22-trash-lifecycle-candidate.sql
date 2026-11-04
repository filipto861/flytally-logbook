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
        UPDATE public.logbook_event_uid_registry r
          SET lifecycle_state='purged',original_trash_cutoff=rec.purge_after,
            marker_until=rec.purge_after+INTERVAL '12 months'
          WHERE r.owner_id=p_owner AND r.event_kind='flight'
            AND r.event_uid=rec.event_uid AND r.lifecycle_state='trash';
        GET DIAGNOSTICS v_affected=ROW_COUNT;
        IF v_affected<>1 THEN RAISE EXCEPTION 'V22 expiry state transition conflict'; END IF;
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
        ELSE
          -- No immutable lineage exists to prove a restored historical
          -- archive after the latest event has already been purged/voided.
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
-- PostgreSQL defaults public EXECUTE; do not grant this even to read-only
-- test roles. The owning local fixture principal retains inherent access.
REVOKE ALL ON FUNCTION public.logbook_v22_expire_owner_candidate(BIGINT,INTEGER) FROM PUBLIC;
COMMIT;
