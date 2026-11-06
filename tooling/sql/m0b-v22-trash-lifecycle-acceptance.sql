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

-- A persisted purged marker cannot prove the prior restored-flight lineage.
-- Preserve this historical payload instead of guessing an event match.
INSERT INTO public.logbook_event_uid_registry
 (owner_id,event_kind,event_uid,lifecycle_state,original_trash_cutoff,marker_until)
 VALUES(9002,'flight','88888888-8888-4888-8888-888888888888','purged',
   now()-interval '20 days',now()+interval '11 months');
INSERT INTO public.deleted_flights
 (id,user_id,original_flight_id,delete_token,flight_data,purge_after,
  restored_at,restored_flight_id,event_uid)
 VALUES(80,9002,2080,'m0b80',
   jsonb_build_object('id',2080,'user_id',9002,
    'event_uid','88888888-8888-4888-8888-888888888888'),
   now()-interval '1 day',now()-interval '2 days',5080,
   '88888888-8888-4888-8888-888888888888');
DO $unknown_lineage$ BEGIN
  BEGIN
    PERFORM public.logbook_v22_expire_owner_candidate(9002,25);
    RAISE EXCEPTION 'Purged restored history was inappropriately deleted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'V22 expiry terminal lineage receipt unavailable'
      THEN RAISE; END IF;
  END;
  IF NOT EXISTS(SELECT 1 FROM public.deleted_flights WHERE id=80)
    OR NOT EXISTS(SELECT 1 FROM public.logbook_event_uid_registry
      WHERE owner_id=9002 AND event_uid='88888888-8888-4888-8888-888888888888'
        AND lifecycle_state='purged') THEN
    RAISE EXCEPTION 'Unproven historic restored archive was not retained';
  END IF;
END $unknown_lineage$;
SELECT 'PASS: purged marker and restored archive with unknown lineage fail closed';

-- Synthetic legacy archive with a wrong owner in its original snapshot.
INSERT INTO public.deleted_flights
 (id,user_id,original_flight_id,delete_token,flight_data,purge_after)
 VALUES(79,9002,2079,'m0b79',
   jsonb_build_object('id',2079,'user_id',9001),now()-interval '1 day');
DO $wrong_owner$ BEGIN
  BEGIN
    PERFORM public.logbook_v22_expire_owner_candidate(9002,25);
    RAISE EXCEPTION 'Wrong-owner legacy snapshot unexpectedly deleted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'V22 expiry archive owner/flight snapshot mismatch'
      THEN RAISE; END IF;
  END;
  IF NOT EXISTS(SELECT 1 FROM public.deleted_flights WHERE id=79)
    THEN RAISE EXCEPTION 'Wrong-owner payload was mutated'; END IF;
END $wrong_owner$;
DELETE FROM public.deleted_flights WHERE id=79;
SELECT 'PASS: legacy snapshot owner mismatch fails closed';

-- A registered UID in archived data is NOT a source authority when the
-- corresponding owner-scoped registry identity is missing.
INSERT INTO public.deleted_flights
 (id,user_id,original_flight_id,delete_token,flight_data,purge_after,event_uid)
 VALUES(78,9002,2078,'m0b78',
   jsonb_build_object('id',2078,'user_id',9002,
     'event_uid','77777777-7777-4777-8777-777777777777'),
   now()-interval '1 day','77777777-7777-4777-8777-777777777777');
DO $missing_uid$ BEGIN
  BEGIN
    PERFORM public.logbook_v22_expire_owner_candidate(9002,25);
    RAISE EXCEPTION 'Missing owner-scoped registry accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'V22 expiry missing owner event registry' THEN RAISE; END IF;
  END;
  IF NOT EXISTS(SELECT 1 FROM public.deleted_flights WHERE id=78)
    THEN RAISE EXCEPTION 'Unregistered UID archive was mutated'; END IF;
END $missing_uid$;
DELETE FROM public.deleted_flights WHERE id=78;
SELECT 'PASS: unknown registry UID preserved; no inferred source identity';

-- The restored target flight ID is insufficient: exact owner AND event UID
-- must match. We deliberately point owner 9002 to owner 9001's live flight.
INSERT INTO public.logbook_event_uid_registry
 (owner_id,event_kind,event_uid,lifecycle_state)
 VALUES(9002,'flight','66666666-6666-4666-8666-666666666666','active');
INSERT INTO public.deleted_flights
 (id,user_id,original_flight_id,delete_token,flight_data,purge_after,
  restored_at,restored_flight_id,event_uid)
 VALUES(77,9002,2077,'m0b77',
   jsonb_build_object('id',2077,'user_id',9002,
     'event_uid','66666666-6666-4666-8666-666666666666'),
   now()-interval '1 day',now()-interval '2 days',5015,
   '66666666-6666-4666-8666-666666666666');
DO $wrong_restored_link$ BEGIN
  BEGIN
    PERFORM public.logbook_v22_expire_owner_candidate(9002,25);
    RAISE EXCEPTION 'Wrong-owner restored flight association accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'V22 expiry restored active flight owner/UID mismatch'
      THEN RAISE; END IF;
  END;
  IF NOT EXISTS(SELECT 1 FROM public.deleted_flights WHERE id=77)
    OR NOT EXISTS(SELECT 1 FROM public.flights WHERE id=5015 AND user_id=9001)
    THEN RAISE EXCEPTION 'Wrong restored link mutated protected owner data'; END IF;
END $wrong_restored_link$;
SELECT 'PASS: wrong restored flight ID/owner/UID cannot purge history';

-- Source-owned immutable edge is attested while both archives exist.
-- Simulated clock advancement later modifies only synthetic cutoff rows
-- because the test runner does not use fake global PostgreSQL time.
INSERT INTO public.users(id,email) VALUES
 (9003,'synthetic-lineage-1@example.test'),
 (9004,'synthetic-lineage-2@example.test'),
 (9005,'synthetic-no-edge@example.test');
INSERT INTO public.logbook_event_uid_registry
 (owner_id,event_kind,event_uid,lifecycle_state,original_trash_cutoff)
 VALUES
 (9003,'flight','aaaa0000-0000-4000-8000-000000000003','trash',now()-interval '2 hours'),
 (9004,'flight','bbbb0000-0000-4000-8000-000000000004','trash',now()+interval '5 hours'),
 (9005,'flight','cccc0000-0000-4000-8000-000000000005','trash',now()-interval '2 hours');
INSERT INTO public.deleted_flights
 (id,user_id,original_flight_id,delete_token,flight_data,deleted_at,purge_after,
  restored_at,restored_flight_id,event_uid)
 VALUES
 (91,9003,4091,'m0b91',
   jsonb_build_object('id',4091,'user_id',9003,'event_uid','aaaa0000-0000-4000-8000-000000000003'),
   now()-interval '8 days',now()+interval '2 days',
   now()-interval '6 days',5091,'aaaa0000-0000-4000-8000-000000000003'),
 (92,9003,5091,'m0b92',
   jsonb_build_object('id',5091,'user_id',9003,'event_uid','aaaa0000-0000-4000-8000-000000000003'),
   now()-interval '3 days',now()-interval '2 hours',
   NULL,NULL,'aaaa0000-0000-4000-8000-000000000003'),
 (130,9005,4130,'m0b130',
   jsonb_build_object('id',4130,'user_id',9005,'event_uid','cccc0000-0000-4000-8000-000000000005'),
   now()-interval '8 days',now()+interval '2 days',
   now()-interval '6 days',5130,'cccc0000-0000-4000-8000-000000000005'),
 (131,9005,5130,'m0b131',
   jsonb_build_object('id',5130,'user_id',9005,'event_uid','cccc0000-0000-4000-8000-000000000005'),
   now()-interval '3 days',now()-interval '2 hours',
   NULL,NULL,'cccc0000-0000-4000-8000-000000000005');

DO $unattested$ BEGIN
  BEGIN
    PERFORM public.logbook_v22_expire_owner_candidate(9005,25);
    RAISE EXCEPTION 'Terminal purge without predecessor attestation was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'V22 terminal purge missing immutable predecessor edge'
      THEN RAISE; END IF;
  END;
  IF NOT EXISTS(SELECT 1 FROM public.deleted_flights WHERE id=131)
    OR NOT EXISTS(SELECT 1 FROM public.logbook_event_uid_registry
      WHERE owner_id=9005 AND event_uid='cccc0000-0000-4000-8000-000000000005'
        AND lifecycle_state='trash')
    THEN RAISE EXCEPTION 'Unattested final purge failed to roll back'; END IF;
END $unattested$;
SELECT 'PASS: terminal purge without immutable predecessor edge refused atomically';

DO $witness$ BEGIN
  PERFORM public.logbook_v22_attest_redelete_candidate(
    9003,'aaaa0000-0000-4000-8000-000000000003',91,92);
  IF (SELECT count(*) FROM public.logbook_v22_redelete_edge_candidate
      WHERE owner_id=9003 AND event_uid='aaaa0000-0000-4000-8000-000000000003')<>1
    THEN RAISE EXCEPTION 'Source redelete attestation missing'; END IF;
  IF public.logbook_v22_expire_owner_candidate(9003,25)<>1
    THEN RAISE EXCEPTION 'Last Trash terminal archive was not purged'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.logbook_v22_terminal_purge_candidate t
    WHERE t.owner_id=9003 AND t.event_uid='aaaa0000-0000-4000-8000-000000000003'
      AND t.terminal_archive_id=92
      AND t.original_trash_cutoff=(
        SELECT original_trash_cutoff FROM public.logbook_event_uid_registry r
        WHERE r.owner_id=9003 AND r.event_uid=t.event_uid))
    OR NOT EXISTS(SELECT 1 FROM public.deleted_flights WHERE id=91)
    OR EXISTS(SELECT 1 FROM public.deleted_flights WHERE id=92)
    THEN RAISE EXCEPTION 'Terminal receipt or older restored archive lost'; END IF;
END $witness$;
-- Synthetic time advance only; this is NOT a production change to cutoff.
UPDATE public.deleted_flights SET purge_after=now()-interval '1 hour'
 WHERE id=91 AND user_id=9003;
DO $oldrestored$ DECLARE n INTEGER; BEGIN
  -- Separate SQL statements: read post-mutation state AFTER the writer call,
  -- never rely on the snapshot used by a single OR expression.
  n:=public.logbook_v22_expire_owner_candidate(9003,25);
  IF n<>1 THEN RAISE EXCEPTION 'Old restored purge count %, expected 1',n; END IF;
  IF EXISTS(SELECT 1 FROM public.deleted_flights WHERE id=91)
    THEN RAISE EXCEPTION 'Old restored archive retained after successful writer'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.logbook_v22_redelete_edge_candidate
      WHERE owner_id=9003 AND prior_archive_id=91 AND next_archive_id=92)
    THEN RAISE EXCEPTION 'Original immutable redelete edge lost'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.logbook_v22_terminal_purge_candidate
      WHERE owner_id=9003 AND terminal_archive_id=92)
    THEN RAISE EXCEPTION 'Original immutable terminal receipt lost'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.logbook_event_uid_registry
      WHERE owner_id=9003 AND event_uid='aaaa0000-0000-4000-8000-000000000003'
        AND lifecycle_state='purged')
    THEN RAISE EXCEPTION 'Terminal UID lifecycle changed'; END IF;
END $oldrestored$;
SELECT 'PASS: attest A->B, purge B, then safely expire older restored A with terminal witness';

-- Multi-restore event: A -> B -> C; both predecessors eventually expire
-- after terminal C has been deleted, but no source archive is invented.
INSERT INTO public.deleted_flights
 (id,user_id,original_flight_id,delete_token,flight_data,deleted_at,purge_after,
  restored_at,restored_flight_id,event_uid)
 VALUES
 (110,9004,4110,'m0b110',
  jsonb_build_object('id',4110,'user_id',9004,'event_uid','bbbb0000-0000-4000-8000-000000000004'),
  now()-interval '14 days',now()+interval '4 days',
  now()-interval '12 days',5110,'bbbb0000-0000-4000-8000-000000000004'),
 (111,9004,5110,'m0b111',
  jsonb_build_object('id',5110,'user_id',9004,'event_uid','bbbb0000-0000-4000-8000-000000000004'),
  now()-interval '9 days',now()+interval '5 hours',
  NULL,NULL,'bbbb0000-0000-4000-8000-000000000004');
DO $firsthop$ BEGIN
  PERFORM public.logbook_v22_attest_redelete_candidate(
    9004,'bbbb0000-0000-4000-8000-000000000004',110,111);
END $firsthop$;
-- Synthetic restoration of B and next deletion C, always before testing
-- terminal cleanup and entirely within the disposable fixture.
UPDATE public.deleted_flights SET restored_at=now()-interval '6 days',
 restored_flight_id=5111 WHERE id=111;
UPDATE public.logbook_event_uid_registry SET original_trash_cutoff=now()-interval '1 hour'
 WHERE owner_id=9004 AND event_uid='bbbb0000-0000-4000-8000-000000000004';
INSERT INTO public.deleted_flights
 (id,user_id,original_flight_id,delete_token,flight_data,deleted_at,purge_after,
  restored_at,restored_flight_id,event_uid)
 VALUES(112,9004,5111,'m0b112',
  jsonb_build_object('id',5111,'user_id',9004,'event_uid','bbbb0000-0000-4000-8000-000000000004'),
  now()-interval '2 days',now()-interval '1 hour',
  NULL,NULL,'bbbb0000-0000-4000-8000-000000000004');
DO $secondhop$ BEGIN
  PERFORM public.logbook_v22_attest_redelete_candidate(
    9004,'bbbb0000-0000-4000-8000-000000000004',111,112);
  IF public.logbook_v22_expire_owner_candidate(9004,25)<>1
    THEN RAISE EXCEPTION 'Multi-hop terminal archive not purged'; END IF;
END $secondhop$;
UPDATE public.deleted_flights SET purge_after=now()-interval '20 minutes'
 WHERE id IN(110,111) AND user_id=9004;
DO $multihop$ DECLARE n INTEGER;BEGIN
  n:=public.logbook_v22_expire_owner_candidate(9004,25);
  IF n<>2 THEN RAISE EXCEPTION 'Multi-hop historical expiry count %, expected 2',n;END IF;
  IF EXISTS(SELECT 1 FROM public.deleted_flights WHERE id IN(110,111,112))
    THEN RAISE EXCEPTION 'Multi-hop historical archive survived cleanup';END IF;
  IF (SELECT count(*) FROM public.logbook_v22_redelete_edge_candidate
    WHERE owner_id=9004 AND event_uid='bbbb0000-0000-4000-8000-000000000004')<>2
    THEN RAISE EXCEPTION 'Multi-hop immutable edges disappeared';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.logbook_v22_terminal_purge_candidate
    WHERE owner_id=9004 AND terminal_archive_id=112)
    THEN RAISE EXCEPTION 'Multi-hop terminal receipt disappeared';END IF;
END $multihop$;
SELECT 'PASS: multi-hop attest A->B->C and purge historic A+B only with terminal C proof';

-- Append-only trigger protects the retained audit evidence.
DO $immutable$ BEGIN
  BEGIN
    UPDATE public.logbook_v22_redelete_edge_candidate
      SET next_archive_id=999 WHERE owner_id=9004 AND prior_archive_id=110;
    RAISE EXCEPTION 'Edge update unexpectedly allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'V22 immutable event lineage cannot be updated/deleted'
      THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.logbook_v22_terminal_purge_candidate
      WHERE owner_id=9004 AND terminal_archive_id=112;
    RAISE EXCEPTION 'Terminal proof delete unexpectedly allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'V22 immutable event lineage cannot be updated/deleted'
      THEN RAISE; END IF;
  END;
END $immutable$;
SELECT 'PASS: immutable owner-scoped lineage edges and terminal receipts cannot mutate';

-- Wrong owner, missing source and repeat attestation must NOT forge evidence.
DO $reject_attest$ BEGIN
  BEGIN
    PERFORM public.logbook_v22_attest_redelete_candidate(
      9005,'cccc0000-0000-4000-8000-000000000005',91,92);
    RAISE EXCEPTION 'Wrong-owner witness accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'V22 lineage attestation prior source unavailable' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.logbook_v22_attest_redelete_candidate(
      9005,'cccc0000-0000-4000-8000-000000000005',130,131);
    PERFORM public.logbook_v22_attest_redelete_candidate(
      9005,'cccc0000-0000-4000-8000-000000000005',130,131);
    RAISE EXCEPTION 'Repeated source attestation accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END $reject_attest$;
SELECT 'PASS: missing owner source rejected and duplicate immutable witness refused';

COMMIT;
