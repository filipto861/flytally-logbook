-- Test backend B: independent source-owner lock and fresh materialization
-- snapshot are distinct statements in the same READ COMMITTED transaction.
BEGIN ISOLATION LEVEL READ COMMITTED;
SELECT 1 / COUNT(*)::integer AS source_owner_gate
 FROM (SELECT id FROM public.users WHERE id=9051 FOR UPDATE) held_owner;
WITH materialized AS (
 INSERT INTO public.flight_source_provenance(
  participant_flight_id,participant_user_id,source_flight_id,
  source_user_id,source_revision,source_hash,participant_role)
 SELECT 7052,9052,src.id,9051,1,'synthetic-reverse-source','OBSERVER'
 FROM public.flights src WHERE src.id=7051 AND src.user_id=9051
 RETURNING id
)
SELECT COUNT(*)::integer AS materialized_count FROM materialized;
COMMIT;
