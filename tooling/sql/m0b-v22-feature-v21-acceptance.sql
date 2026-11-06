-- Additional richer V21 application-feature fixture: based on current browser
-- bootstrap source + actual canonical v20/v21 SQL, NOT a production DB clone.
-- All tests operate only on isolated disposable local PostgreSQL16.
BEGIN;
DO $target$ BEGIN
 IF current_database()<>'flytally_m0b_disposable_feature_v21'
 OR current_user<>'flytally'
 OR coalesce(host(inet_server_addr()),'')<>'127.0.0.1'
 OR (SELECT count(*) FROM public.flytally_schema_migrations)<>21
 OR (SELECT count(*) FROM public.flytally_feature_migrations)<14
 OR to_regprocedure('public.logbook_v22_expire_owner_candidate(bigint,integer)') IS NULL
 OR to_regprocedure('public.logbook_v22_attest_redelete_candidate(bigint,uuid,bigint,bigint)') IS NULL
 THEN RAISE EXCEPTION 'V22 feature V21 acceptance isolated target or migration mismatch'; END IF;
 IF NOT(
   to_regclass('public.flight_participations') IS NOT NULL
   AND to_regclass('public.flight_verifications') IS NOT NULL
   AND to_regclass('public.flight_certified_revisions') IS NOT NULL
   AND to_regclass('public.instructor_flight_approvals') IS NOT NULL
   AND to_regclass('public.flight_connected_crew') IS NOT NULL
   AND to_regclass('public.flight_expenses') IS NOT NULL
   AND to_regclass('public.flight_source_provenance') IS NOT NULL
   AND to_regclass('public.voided_certified_flights') IS NOT NULL)
 THEN RAISE EXCEPTION 'V22 feature V21 evidence/sharing tables not modeled'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint c
     WHERE c.conrelid='public.flight_expenses'::regclass AND c.contype='f')
 THEN RAISE EXCEPTION 'V22 feature fixture owner FK not modeled'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_trigger
     WHERE tgrelid='public.flights'::regclass
       AND tgname='trg_logbook_protect_locked_flight' AND NOT tgisinternal)
 THEN RAISE EXCEPTION 'V22 feature fixture native flight protection not present'; END IF;
END $target$;

-- A real 1..19 feature-bearing browser fixture already has its own
-- synthetic active flight (id not assumed) and other owner-9001 evidence.
-- Only add artificial owner-9002 Trash and registry records.
INSERT INTO public.logbook_event_uid_registry
 (owner_id,event_kind,event_uid,lifecycle_state,original_trash_cutoff)
 VALUES(9002,'flight','fe000000-0000-4000-8000-000000000902','trash',
  now()-interval '2 hours');
INSERT INTO public.deleted_flights
 (id,user_id,original_flight_id,delete_token,flight_data,deleted_at,purge_after,
  restored_at,restored_flight_id,event_uid)
 VALUES
 (9901,9002,4901,'m0bfeat9901',
   jsonb_build_object('id',4901,'user_id',9002,
     'event_uid','fe000000-0000-4000-8000-000000000902'),
   now()-interval '10 days',now()+interval '2 days',
   now()-interval '7 days',5901,'fe000000-0000-4000-8000-000000000902'),
 (9902,9002,5901,'m0bfeat9902',
   jsonb_build_object('id',5901,'user_id',9002,
     'event_uid','fe000000-0000-4000-8000-000000000902'),
   now()-interval '3 days',now()-interval '2 hours',
   NULL,NULL,'fe000000-0000-4000-8000-000000000902');
DO $verify$ DECLARE v_before bigint;v_after bigint;n int; BEGIN
  SELECT count(*) INTO v_before FROM public.flights WHERE user_id=9001;
  IF v_before<1 THEN RAISE EXCEPTION 'Browser fixture source flight missing'; END IF;
  PERFORM public.logbook_v22_attest_redelete_candidate(
    9002,'fe000000-0000-4000-8000-000000000902',9901,9902);
  n:=public.logbook_v22_expire_owner_candidate(9002,25);
  IF n<>1 THEN RAISE EXCEPTION 'Feature fixture terminal purge result %, expected 1',n; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.deleted_flights WHERE id=9901)
    OR EXISTS(SELECT 1 FROM public.deleted_flights WHERE id=9902)
    THEN RAISE EXCEPTION 'Feature fixture archived rows not coherent'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.logbook_v22_terminal_purge_candidate
      WHERE owner_id=9002 AND terminal_archive_id=9902)
    THEN RAISE EXCEPTION 'Feature fixture immutable terminal receipt absent'; END IF;
  SELECT count(*) INTO v_after FROM public.flights WHERE user_id=9001;
  IF v_before<>v_after THEN RAISE EXCEPTION 'Unrelated owner flight modified'; END IF;
END $verify$;
-- Synthetic clock advance only; a live server would wait for original cutoff.
UPDATE public.deleted_flights SET purge_after=now()-interval '1 hour'
 WHERE id=9901 AND user_id=9002;
DO $older$ DECLARE n int;BEGIN
 n:=public.logbook_v22_expire_owner_candidate(9002,25);
 IF n<>1 THEN RAISE EXCEPTION 'Feature fixture old restored purge count %, expected 1',n;END IF;
 IF EXISTS(SELECT 1 FROM public.deleted_flights WHERE id IN(9901,9902))
   OR NOT EXISTS(SELECT 1 FROM public.logbook_event_uid_registry
     WHERE owner_id=9002 AND event_uid='fe000000-0000-4000-8000-000000000902'
       AND lifecycle_state='purged')
   OR NOT EXISTS(SELECT 1 FROM public.flights WHERE user_id=9001)
   THEN RAISE EXCEPTION 'Feature fixture old restored archive failed or cross-owner touched'; END IF;
END $older$;
SELECT 'PASS: richer V21 feature schema, protected shared/evidence tables, owner-scoped terminal lineage and rollback boundary';
COMMIT;
