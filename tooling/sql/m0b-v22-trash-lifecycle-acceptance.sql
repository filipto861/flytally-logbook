-- Real PostgreSQL16 SQL acceptance, source-exact migrations 1..21, passive
-- V22 expand and unregistered SECURITY INVOKER owner-gated writer candidate.
-- Synthetic records only. Single transaction: any mismatch aborts everything.
BEGIN;
DO $pre$ BEGIN
  IF current_database()<>'flytally_m0b_disposable_full_v21'
    OR current_user<>'flytally'
    OR coalesce(host(inet_server_addr()),'')<>'127.0.0.1'
    OR (SELECT count(*) FROM public.flytally_schema_migrations)<>21
    OR to_regprocedure('public.logbook_v22_expire_owner_candidate(bigint,integer)') IS NULL
    THEN RAISE EXCEPTION 'V22 lifecycle SQL acceptance target mismatch'; END IF;
END $pre$;

INSERT INTO public.flights(id,user_id,date,registration,event_uid)
 VALUES(5015,9001,'2026-10-31','OK-SYNTH',
   '11111111-1111-4111-8111-111111111115');
INSERT INTO public.logbook_event_uid_registry
 (owner_id,event_kind,event_uid,lifecycle_state,original_trash_cutoff)
 VALUES
 (9001,'flight','11111111-1111-4111-8111-111111111111','trash',now()-interval '1 day'),
 (9002,'flight','22222222-2222-4222-8222-222222222222','trash',now()-interval '1 day'),
 (9001,'flight','11111111-1111-4111-8111-111111111114','trash',now()+interval '1 day'),
 (9001,'flight','11111111-1111-4111-8111-111111111115','active',NULL);
INSERT INTO public.deleted_flights
 (id,user_id,original_flight_id,delete_token,flight_data,purge_after,
  restored_at,restored_flight_id,event_uid)
 VALUES
 (11,9001,1011,'m0b11',
  jsonb_build_object('id',1011,'user_id',9001,'event_uid','11111111-1111-4111-8111-111111111111'),
  now()-interval '1 day',NULL,NULL,'11111111-1111-4111-8111-111111111111'),
 (12,9002,2012,'m0b12',
  jsonb_build_object('id',2012,'user_id',9002,'event_uid','22222222-2222-4222-8222-222222222222'),
  now()-interval '1 day',NULL,NULL,'22222222-2222-4222-8222-222222222222'),
 (13,9001,1013,'m0b13',jsonb_build_object('id',1013,'user_id',9001),
  now()-interval '1 day',NULL,NULL,NULL),
 (14,9001,1014,'m0b14',
  jsonb_build_object('id',1014,'user_id',9001,'event_uid','11111111-1111-4111-8111-111111111114'),
  now()+interval '1 day',NULL,NULL,'11111111-1111-4111-8111-111111111114'),
 (15,9001,1015,'m0b15',
  jsonb_build_object('id',1015,'user_id',9001,'event_uid','11111111-1111-4111-8111-111111111115'),
  now()-interval '1 day',now()-interval '2 days',5015,
  '11111111-1111-4111-8111-111111111115');

DO $batch$ DECLARE n int; BEGIN
  SELECT public.logbook_v22_expire_owner_candidate(9001,2) INTO n;
  IF n<>2 THEN RAISE EXCEPTION 'Wrong first bounded owner batch %',n; END IF;
  IF EXISTS(SELECT 1 FROM public.deleted_flights WHERE id IN(11,13))
    OR NOT EXISTS(SELECT 1 FROM public.deleted_flights WHERE id IN(12,14,15))
    OR (SELECT lifecycle_state FROM public.logbook_event_uid_registry
      WHERE owner_id=9001 AND event_uid='11111111-1111-4111-8111-111111111111')<>'purged'
    OR NOT EXISTS(SELECT 1 FROM public.logbook_event_uid_registry r
      WHERE r.owner_id=9001 AND r.event_uid='11111111-1111-4111-8111-111111111111'
        AND r.marker_until=r.original_trash_cutoff+INTERVAL '12 months')
    THEN RAISE EXCEPTION 'First batch owner/cutoff/legacy/marker mismatch'; END IF;
  SELECT public.logbook_v22_expire_owner_candidate(9001,25) INTO n;
  IF n<>1 OR NOT EXISTS (SELECT 1 FROM public.flights WHERE id=5015
    AND user_id=9001 AND event_uid='11111111-1111-4111-8111-111111111115')
    OR NOT EXISTS (SELECT 1 FROM public.logbook_event_uid_registry WHERE owner_id=9001
       AND event_uid='11111111-1111-4111-8111-111111111115' AND lifecycle_state='active')
    OR NOT EXISTS (SELECT 1 FROM public.deleted_flights WHERE id=14)
    THEN RAISE EXCEPTION 'Restored archive purge altered active event or future Trash'; END IF;
  SELECT public.logbook_v22_expire_owner_candidate(9001,25) INTO n;
  IF n<>0 THEN RAISE EXCEPTION 'Expiry retry must be idempotent'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.deleted_flights WHERE id=12)
    THEN RAISE EXCEPTION 'Cross-owner Trash was touched'; END IF;
  SELECT public.logbook_v22_expire_owner_candidate(9002,1) INTO n;
  IF n<>1 THEN RAISE EXCEPTION 'Second owner could not use same transaction function'; END IF;
END $batch$;
SELECT 'PASS: bounded owner 1 and owner 2, cutoff, legacy, restored active, repeat, provisional marker';

-- Restored old archive with a later re-deletion of the same source event:
-- keep the current pending archive and the event identity in Trash.
INSERT INTO public.logbook_event_uid_registry
 (owner_id,event_kind,event_uid,lifecycle_state,original_trash_cutoff)
 VALUES(9001,'flight','33333333-3333-4333-8333-333333333333','trash',now()+interval '2 days');
INSERT INTO public.deleted_flights
 (id,user_id,original_flight_id,delete_token,flight_data,purge_after,
  restored_at,restored_flight_id,event_uid)
 VALUES
 (40,9001,4000,'m0b40',
  jsonb_build_object('id',4000,'user_id',9001,'event_uid','33333333-3333-4333-8333-333333333333'),
  now()-interval '1 day',now()-interval '3 days',5040,
  '33333333-3333-4333-8333-333333333333'),
 (41,9001,5040,'m0b41',
  jsonb_build_object('id',5040,'user_id',9001,'event_uid','33333333-3333-4333-8333-333333333333'),
  now()+interval '2 days',NULL,NULL,'33333333-3333-4333-8333-333333333333');
DO $redeleted$ DECLARE n int; BEGIN
  SELECT public.logbook_v22_expire_owner_candidate(9001,25) INTO n;
  IF n<>1 OR EXISTS(SELECT 1 FROM public.deleted_flights WHERE id=40)
    OR NOT EXISTS(SELECT 1 FROM public.deleted_flights WHERE id=41)
    OR NOT EXISTS(SELECT 1 FROM public.logbook_event_uid_registry
      WHERE owner_id=9001 AND event_uid='33333333-3333-4333-8333-333333333333'
        AND lifecycle_state='trash')
    THEN RAISE EXCEPTION 'Restored then re-deleted event lost current identity'; END IF;
END $redeleted$;
SELECT 'PASS: older restored archive expires while re-deleted event stays in Trash';

-- Intentional second-row failure MUST roll back first row's marker transition.
INSERT INTO public.logbook_event_uid_registry
 (owner_id,event_kind,event_uid,lifecycle_state,original_trash_cutoff)
 VALUES
 (9001,'flight','44444444-4444-4444-8444-444444444444','trash',now()-interval '2 hours'),
 (9001,'flight','55555555-5555-4555-8555-555555555555','active',NULL);
INSERT INTO public.deleted_flights
 (id,user_id,original_flight_id,delete_token,flight_data,purge_after,event_uid)
 VALUES
 (70,9001,4070,'m0b70',
   jsonb_build_object('id',4070,'user_id',9001,'event_uid','44444444-4444-4444-8444-444444444444'),
   now()-interval '2 hours','44444444-4444-4444-8444-444444444444'),
 (71,9001,4071,'m0b71',
   jsonb_build_object('id',4071,'user_id',9001,'event_uid','55555555-5555-4555-8555-555555555555'),
   now()-interval '2 hours','55555555-5555-4555-8555-555555555555');
DO $rollback$ BEGIN
  BEGIN
    PERFORM public.logbook_v22_expire_owner_candidate(9001,25);
    RAISE EXCEPTION 'Expected wrong-state rejection missing';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'V22 expiry un-restored archive state/cutoff mismatch' THEN RAISE; END IF;
  END;
  IF NOT EXISTS(SELECT 1 FROM public.deleted_flights WHERE id=70)
    OR NOT EXISTS(SELECT 1 FROM public.deleted_flights WHERE id=71)
    OR NOT EXISTS(SELECT 1 FROM public.logbook_event_uid_registry
      WHERE owner_id=9001 AND event_uid='44444444-4444-4444-8444-444444444444'
        AND lifecycle_state='trash' AND marker_until IS NULL)
    THEN RAISE EXCEPTION 'First deletion was not rolled back after later exception'; END IF;
END $rollback$;
SELECT 'PASS: atomic rollback on second-row state mismatch';

-- Other fail-closed inputs and provenance boundaries. All must retain rows.
DO $bad$ BEGIN
  BEGIN
    PERFORM public.logbook_v22_expire_owner_candidate(9999,25);
    RAISE EXCEPTION 'Missing gate accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'V22 expiry missing owner account gate' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.logbook_v22_expire_owner_candidate(9001,0);
    RAISE EXCEPTION 'Unbounded/zero batch accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'V22 expiry requires a positive owner and batch size 1..25' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.logbook_v22_expire_owner_candidate(9001,26);
    RAISE EXCEPTION 'Overlarge batch accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'V22 expiry requires a positive owner and batch size 1..25' THEN RAISE; END IF;
  END;
END $bad$;
SELECT 'PASS: missing owner gate and invalid bounded batch fail closed';
COMMIT;
