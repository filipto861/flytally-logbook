-- Test-only synthetic late-link race fixture for an owned Docker postgres:16.
-- Never install in actual Neon or any other database.
DO $race_preflight$ BEGIN
 IF current_database()<>'flytally_m0b_disposable_feature_v21'
 OR current_user<>'flytally'
 OR coalesce(host(inet_server_addr()),'')<>'127.0.0.1'
 OR current_setting('server_version_num')::integer NOT BETWEEN 160000 AND 169999
 OR (SELECT count(*) FROM public.flytally_schema_migrations)<>21
 OR to_regprocedure('public.logbook_v22_redelete_source_candidate(bigint,bigint,uuid)') IS NULL
 OR to_regclass('public.flight_source_provenance') IS NULL
 OR EXISTS(SELECT 1 FROM public.users WHERE id IN (9041,9042))
 THEN RAISE EXCEPTION 'M0-B source-race fixture requires fresh disposable feature V21';END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint c
   WHERE c.conrelid='public.flight_source_provenance'::regclass
     AND c.contype='f' AND pg_get_constraintdef(c.oid) LIKE '%source_flight_id%')
 THEN RAISE EXCEPTION 'M0-B race source edge unexpectedly has a parent FK';END IF;
END $race_preflight$;

BEGIN;
INSERT INTO public.users(id,email,display_name) VALUES
 (9041,'synthetic-race-source@example.test','Synthetic Race Source'),
 (9042,'synthetic-race-participant@example.test','Synthetic Race Participant');
INSERT INTO public.flights(id,user_id,date,registration,departure,arrival)
 VALUES (7041,9041,'2026-11-01','OK-RACE','LKPR','LKTB'),
        (7042,9042,'2026-11-01','OK-PARTICIPANT','LKPR','LKTB');
UPDATE public.flights SET event_uid='74410000-0000-4000-8000-000000009041'
 WHERE id=7041 AND user_id=9041;
INSERT INTO public.logbook_event_uid_registry(
 owner_id,event_kind,event_uid,lifecycle_state)
VALUES (9041,'flight','74410000-0000-4000-8000-000000009041','active');
COMMIT;

-- Control the window on the SQL writer's already-inserted archive:
-- after its first eligibility read, but before its final protected DELETE.
CREATE FUNCTION public.m0b_v22_test_pause_after_archive()
RETURNS TRIGGER LANGUAGE plpgsql AS $pause$
BEGIN
 IF NEW.user_id=9041 AND NEW.original_flight_id=7041
 THEN PERFORM pg_sleep(4); END IF;
 RETURN NEW;
END $pause$;
CREATE TRIGGER m0b_v22_test_race_pause
AFTER INSERT ON public.deleted_flights FOR EACH ROW
EXECUTE FUNCTION public.m0b_v22_test_pause_after_archive();
