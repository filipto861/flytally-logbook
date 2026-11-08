-- Synthetic, fresh, disposable localhost PG16 only: V22 invitation guard.
-- No production/migration/Neon SQL. Models just the exact gate columns.
DO $gate$ BEGIN
  IF current_database()<>'flytally_m0b_disposable_invite_gate'
    OR current_user<>'flytally'
    OR coalesce(host(inet_server_addr()),'')<>'127.0.0.1'
    OR current_setting('server_version_num')::integer NOT BETWEEN 160000 AND 169999
    OR EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public')
  THEN RAISE EXCEPTION 'Refused nonfresh disposable invitation-gate PostgreSQL16 target'; END IF;
END $gate$;
CREATE TABLE public.users(id BIGINT PRIMARY KEY);
CREATE TABLE public.flight_participations(
  id BIGINT PRIMARY KEY,participant_user_id BIGINT NOT NULL,
  source_user_id BIGINT NOT NULL,source_flight_id BIGINT NOT NULL,
  source_revision INTEGER NOT NULL,source_hash TEXT NOT NULL,
  status TEXT NOT NULL,participant_flight_id BIGINT
);
CREATE TABLE public.materialization_receipts(participation_id BIGINT NOT NULL);
INSERT INTO public.users(id) VALUES(11),(22);
INSERT INTO public.flight_participations(
  id,participant_user_id,source_user_id,source_flight_id,source_revision,source_hash,status)
 VALUES (101,22,11,701,1,'synthetic-hash','pending'),
        (102,22,11,701,1,'synthetic-hash','pending');
