-- Disposable PG16 only: reverse-order non-FK source-provenance race.
-- A deletes its draft flight and holds an owner row lock until COMMIT.
-- B waits on SAME source owner, then in a fresh READ COMMITTED statement
-- must observe that the source no longer exists and insert NO provenance.
DO $preflight$ BEGIN
 IF current_database()<>'flytally_m0b_disposable_feature_v21'
   OR current_user<>'flytally'
   OR coalesce(host(inet_server_addr()),'')<>'127.0.0.1'
   OR current_setting('server_version_num')::integer NOT BETWEEN 160000 AND 169999
   OR (SELECT count(*) FROM public.flytally_schema_migrations)<>21
   OR to_regprocedure('public.logbook_v22_redelete_source_candidate(bigint,bigint,uuid)') IS NULL
   OR to_regclass('public.flight_source_provenance') IS NULL
   OR EXISTS(SELECT 1 FROM public.users WHERE id IN(9051,9052))
 THEN RAISE EXCEPTION 'M0B reverse source gate requires fresh disposable V21 fixture';END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint c
   WHERE c.conrelid='public.flight_source_provenance'::regclass
     AND c.contype='f' AND pg_get_constraintdef(c.oid) LIKE '%source_flight_id%')
 THEN RAISE EXCEPTION 'M0B reverse source race unexpectedly has parent source FK';END IF;
END $preflight$;
BEGIN;
INSERT INTO public.users(id,email,display_name) VALUES
 (9051,'synthetic-reverse-source@example.test','Reverse Source'),
 (9052,'synthetic-reverse-recipient@example.test','Reverse Recipient');
INSERT INTO public.flights(id,user_id,date,registration,departure,arrival)
 VALUES(7051,9051,'2026-11-01','OK-REV-SOURCE','LKPR','LKTB'),
       (7052,9052,'2026-11-01','OK-REV-RECIP','LKPR','LKTB');
UPDATE public.flights
 SET event_uid='75510000-0000-4000-8000-000000009051'
 WHERE id=7051 AND user_id=9051;
INSERT INTO public.logbook_event_uid_registry(
 owner_id,event_kind,event_uid,lifecycle_state)
VALUES(9051,'flight','75510000-0000-4000-8000-000000009051','active');
COMMIT;
