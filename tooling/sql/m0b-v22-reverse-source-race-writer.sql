-- Test backend A: source flight is deleted, then transaction stays open.
BEGIN;
SELECT public.logbook_v22_redelete_source_candidate(
 9051,7051,'95510000-0000-4000-8000-000000009051'::UUID);
SELECT pg_sleep(4);
COMMIT;
