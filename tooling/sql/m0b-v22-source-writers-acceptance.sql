-- Test ONLY: source-gated restoration and re-deletion on disposable PG16.
-- Synthetic V21 feature fixture plus passive V22 and guarded candidate SQL.
DO $preflight$
BEGIN
 IF current_database()<>'flytally_m0b_disposable_feature_v21'
   OR current_user<>'flytally'
   OR coalesce(host(inet_server_addr()),'')<>'127.0.0.1'
   OR current_setting('server_version_num')::INTEGER NOT BETWEEN 160000 AND 169999
   OR (SELECT count(*) FROM public.flytally_schema_migrations)<>21
   OR to_regclass('public.flight_public_shares') IS NULL
   OR to_regprocedure('public.logbook_v22_finalize_restored_source_candidate(bigint,bigint)') IS NULL
   OR to_regprocedure('public.logbook_v22_redelete_source_candidate(bigint,bigint,uuid)') IS NULL
   THEN RAISE EXCEPTION 'V22 source writer acceptance requires exact disposable V21 feature fixture';END IF;
END
$preflight$;

-- Old original flight was safely archived by an already verified V22 source
-- delete; its original snapshot has a source UID, not an inferred one.
BEGIN;
INSERT INTO public.users(id,email,display_name) VALUES
 (9031,'m0b9031@example.test','Synthetic Owner 31'),
 (9032,'m0b9032@example.test','Synthetic Owner 32'),
 (9033,'m0b9033@example.test','Synthetic Owner 33'),
 (9034,'m0b9034@example.test','Synthetic Owner 34');
INSERT INTO public.deleted_flights(
 id,user_id,original_flight_id,delete_token,flight_data,
 deleted_at,purge_after,event_uid)
VALUES(93031,9031,5031,'v22-archived-9031',
 jsonb_build_object('id',5031,'user_id',9031,
   'date','2026-10-30','registration','OK-M0B',
   'off_block','09:10','departure','LKPR','arrival','LKTB',
   'event_uid','73100000-0000-4000-8000-000000009031'),
 NOW()-INTERVAL '1 day',NOW()+INTERVAL '90 days',
 '73100000-0000-4000-8000-000000009031');
INSERT INTO public.logbook_event_uid_registry(
 owner_id,event_kind,event_uid,lifecycle_state,original_trash_cutoff)
SELECT user_id,'flight',event_uid,'trash',purge_after
  FROM public.deleted_flights WHERE id=93031;
COMMIT;

-- Canonical V21-style restore source: first the account gate, then INSERT
-- new flight and UPDATE the archive; finalizer must run INSIDE THIS transaction.
BEGIN;
SELECT id FROM public.users WHERE id=9031 FOR UPDATE;
INSERT INTO public.flights(id,user_id,date,registration,off_block,departure,arrival)
 VALUES(7031,9031,'2026-10-30','OK-M0B','09:10','LKPR','LKTB');
UPDATE public.deleted_flights SET restored_at=NOW(),restored_flight_id=7031
 WHERE id=93031 AND user_id=9031;
DO $restore$
DECLARE result BIGINT;
BEGIN
 result:=public.logbook_v22_finalize_restored_source_candidate(9031,93031);
 IF result<>7031 THEN RAISE EXCEPTION 'Restored source returned wrong ID';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.flights
     WHERE id=7031 AND user_id=9031
       AND event_uid='73100000-0000-4000-8000-000000009031')
   OR NOT EXISTS(SELECT 1 FROM public.logbook_event_uid_registry
     WHERE owner_id=9031 AND lifecycle_state='active'
       AND original_trash_cutoff IS NULL)
   OR NOT EXISTS(SELECT 1 FROM public.logbook_v22_restored_source_receipt_candidate
     WHERE owner_id=9031 AND archive_id=93031 AND restored_flight_id=7031)
   THEN RAISE EXCEPTION 'Same-transaction restore finalizer missing receipt/UID';END IF;
END
$restore$;
COMMIT;
SELECT 'PASS: same-transaction V21-style restore core plus immutable owner source receipt';

-- Persisted prior restoration cannot be retroactively blessed from a new
-- connection/transaction, even if ID/date/snapshot happen to match.
BEGIN;
INSERT INTO public.deleted_flights(
 id,user_id,original_flight_id,delete_token,flight_data,purge_after,
 restored_at,restored_flight_id,event_uid)
VALUES(93032,9032,5032,'v22-archived-9032',
 jsonb_build_object('id',5032,'user_id',9032,'date','2026-10-30',
  'registration','OK-M0B-2','off_block','10:10',
  'departure','LKPR','arrival','LKTB',
  'event_uid','73200000-0000-4000-8000-000000009032'),
 NOW()+INTERVAL '90 days',NOW(),7032,
 '73200000-0000-4000-8000-000000009032');
INSERT INTO public.logbook_event_uid_registry(
 owner_id,event_kind,event_uid,lifecycle_state,original_trash_cutoff)
SELECT user_id,'flight',event_uid,'trash',purge_after
 FROM public.deleted_flights WHERE id=93032;
INSERT INTO public.flights(id,user_id,date,registration,off_block,departure,arrival)
 VALUES(7032,9032,'2026-10-30','OK-M0B-2','10:10','LKPR','LKTB');
COMMIT;
DO $detached$
BEGIN
 BEGIN
   PERFORM public.logbook_v22_finalize_restored_source_candidate(9032,93032);
   RAISE EXCEPTION 'Detached source restoration improperly accepted';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM<>'V22 restore finalizer requires same transaction mark and insert'
     THEN RAISE;END IF;
 END;
 IF EXISTS(SELECT 1 FROM public.logbook_v22_restored_source_receipt_candidate
    WHERE owner_id=9032)
   OR NOT EXISTS(SELECT 1 FROM public.flights
      WHERE id=7032 AND event_uid IS NULL)
   THEN RAISE EXCEPTION 'Detached source finalizer modified original state';END IF;
END
$detached$;
SELECT 'PASS: detached/forged post-restore receipt refused and no event UID inferred';

DO $cross_owner$
BEGIN
 BEGIN
   PERFORM public.logbook_v22_finalize_restored_source_candidate(9033,93031);
   RAISE EXCEPTION 'Cross-owner restoration receipt forged';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM<>'V22 restore finalizer source archive absent' THEN RAISE;END IF;
 END;
END
$cross_owner$;
SELECT 'PASS: cross-owner source finalization denied';

-- Track and expense are archived by the same protected source before the
-- live flight is deleted; the canonical expense FK cascades on flight DELETE.
INSERT INTO public.flight_tracks(id,user_id,flight_id,file_name)
 VALUES(8031,9031,7031,'synthetic-no-gps.gpx');
INSERT INTO public.track_points(id,user_id,track_id) VALUES(8032,9031,8031);
INSERT INTO public.flight_expenses(user_id,flight_id,category,label,amount_minor,currency)
 VALUES(9031,7031,'OTHER','Synthetic fee',1250,'CZK');

DO $redelete$
DECLARE archive BIGINT;
BEGIN
 archive:=public.logbook_v22_redelete_source_candidate(
   9031,7031,'93100000-0000-4000-8000-000000009031');
 IF archive IS NULL THEN RAISE EXCEPTION 'Re-delete failed to create archive';END IF;
 IF EXISTS(SELECT 1 FROM public.flights WHERE id=7031)
   OR EXISTS(SELECT 1 FROM public.track_points WHERE track_id=8031)
   OR EXISTS(SELECT 1 FROM public.flight_tracks WHERE id=8031)
   OR EXISTS(SELECT 1 FROM public.flight_expenses WHERE flight_id=7031)
   OR NOT EXISTS(SELECT 1 FROM public.deleted_flights d
      WHERE d.id=archive AND d.user_id=9031 AND d.original_flight_id=7031
        AND d.event_uid='73100000-0000-4000-8000-000000009031'
        AND d.flight_data->>'id'='7031' AND jsonb_array_length(d.tracks_data)=1
        AND jsonb_array_length(d.expenses_data)=1)
   OR NOT EXISTS(SELECT 1 FROM public.logbook_event_uid_registry r
      WHERE r.owner_id=9031 AND r.lifecycle_state='trash'
        AND r.marker_until IS NULL AND r.original_trash_cutoff=(
          SELECT purge_after FROM public.deleted_flights WHERE id=archive))
   OR NOT EXISTS(SELECT 1 FROM public.logbook_v22_redelete_edge_candidate edge
      WHERE edge.owner_id=9031 AND edge.prior_archive_id=93031
        AND edge.next_archive_id=archive AND edge.restored_flight_id=7031)
   THEN RAISE EXCEPTION 'Protected V22 redelete atomic source/evidence mismatch';END IF;
END
$redelete$;
SELECT 'PASS: same-source protected redelete archives track/expense, removes live, writes owner-bound immutable edge';

-- A detached repeat call must not emit a duplicate or delete more records.
DO $duplicate$
BEGIN
 BEGIN
   PERFORM public.logbook_v22_redelete_source_candidate(
     9031,7031,'93100000-0000-4000-8000-000000009031');
   RAISE EXCEPTION 'Duplicate redelete accepted';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM<>'V22 redelete source protected or unknown live identity' THEN RAISE;END IF;
 END;
END
$duplicate$;
SELECT 'PASS: duplicate redelete refused without extra archive';

-- Protected share relation matches V21 A+ policy (including revoked links).
INSERT INTO public.flights(id,user_id,date,registration,off_block,departure,arrival,event_uid)
 VALUES(7034,9034,'2026-10-30','OK-SHARE','11:10','LKPR','LKTB',
  '73400000-0000-4000-8000-000000009034');
INSERT INTO public.logbook_event_uid_registry(owner_id,event_kind,event_uid,lifecycle_state)
 VALUES(9034,'flight','73400000-0000-4000-8000-000000009034','active');
INSERT INTO public.flight_public_shares(user_id,flight_id,token_hash)
 VALUES(9034,7034,'synthetic-share-m0b-9034');
DO $protected$
BEGIN
 BEGIN
  PERFORM public.logbook_v22_redelete_source_candidate(
    9034,7034,'93400000-0000-4000-8000-000000009034');
  RAISE EXCEPTION 'Protected shared flight accepted for deletion';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'V22 redelete source protected participant/certified evidence' THEN RAISE;END IF;
 END;
 IF NOT EXISTS(SELECT 1 FROM public.flights WHERE id=7034 AND user_id=9034)
  OR NOT EXISTS(SELECT 1 FROM public.flight_public_shares WHERE flight_id=7034)
  OR EXISTS(SELECT 1 FROM public.deleted_flights WHERE original_flight_id=7034)
  OR NOT EXISTS(SELECT 1 FROM public.logbook_event_uid_registry
    WHERE owner_id=9034 AND lifecycle_state='active')
  THEN RAISE EXCEPTION 'Protected flight/share/audit unexpectedly mutated';END IF;
END
$protected$;
SELECT 'PASS: linked shared flight protected and wrong-owner redelete refused';

DO $wrong_owner$
BEGIN
 BEGIN
  PERFORM public.logbook_v22_redelete_source_candidate(
    9033,7034,'93300000-0000-4000-8000-000000009033');
  RAISE EXCEPTION 'Wrong-owner source delete accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'V22 redelete source protected or unknown live identity' THEN RAISE;END IF;
 END;
END
$wrong_owner$;

-- Immutable receipt cannot be altered after the V21-style source commits.
DO $receipt_integrity$
BEGIN
 BEGIN
   DELETE FROM public.logbook_v22_restored_source_receipt_candidate
      WHERE owner_id=9031 AND archive_id=93031;
   RAISE EXCEPTION 'Restoration receipt delete unexpectedly accepted';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM<>'V22 immutable event lineage cannot be updated/deleted' THEN RAISE;END IF;
 END;
END
$receipt_integrity$;
SELECT 'PASS: immutable restore receipt cannot be deleted';

-- The official underlying V21 restore also validates all currency,
-- aircraft-class/variant, signed/certified and duplicate-flight contracts.
-- This focused SQL test proves only the same-transaction source handoff and
-- protected V21 delete policy; it is NOT an end-to-end restoration UI proof.
