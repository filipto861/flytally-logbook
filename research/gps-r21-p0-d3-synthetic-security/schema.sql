-- FlyTally GPS R2.1b-P0-D3: SYNTHETIC, THROWAWAY PostgreSQL PROOF ONLY.
-- NEVER execute against Neon, FlyTally production, or an existing user DB.
-- The runner runs this only in its own --network none, no-ports Docker container.
-- IDs, roles, and GPS payloads are fictitious; no actual flight data.
\set ON_ERROR_STOP on
DO $r21_guard$
BEGIN
  IF current_database() <> 'r21_synthetic_lab' OR
     current_setting('r21.synthetic_only',true) IS DISTINCT FROM 'NO_NETWORK_TEST_CONTAINER' THEN
    RAISE EXCEPTION 'Synthetic-only PostgreSQL fixture: runner marker missing';
  END IF;
END
$r21_guard$;
CREATE SCHEMA r21_lab;
CREATE ROLE r21_subject_alpha NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE r21_subject_beta NOLOGIN NOINHERIT NOBYPASSRLS;
-- Gamma deliberately has SELECT privileges without an applicable RLS policy.
CREATE ROLE r21_subject_gamma NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE r21_unrelated NOLOGIN NOINHERIT NOBYPASSRLS;
REVOKE TEMPORARY ON DATABASE r21_synthetic_lab FROM PUBLIC;
CREATE TABLE r21_lab.flights (
  id integer PRIMARY KEY,
  owner_role name NOT NULL,
  UNIQUE (id, owner_role)
);
CREATE TABLE r21_lab.tracks (
  id integer PRIMARY KEY,
  flight_id integer NOT NULL,
  owner_role name NOT NULL,
  payload jsonb NOT NULL,
  FOREIGN KEY (flight_id,owner_role) REFERENCES r21_lab.flights(id,owner_role)
);
CREATE TABLE r21_lab.participants (
  flight_id integer NOT NULL REFERENCES r21_lab.flights(id),
  participant_role name NOT NULL
);
CREATE SEQUENCE r21_lab.internal_sequence;
CREATE FUNCTION r21_lab.admin_count() RETURNS integer
  LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,r21_lab
  AS $$ SELECT count(*)::integer FROM r21_lab.tracks $$;
REVOKE ALL ON FUNCTION r21_lab.admin_count() FROM PUBLIC;
-- A superuser-owned SECURITY DEFINER would bypass RLS if granted EXECUTE.
-- This fixture is intentionally kept revoked as an adversarial negative object.
REVOKE ALL ON SCHEMA r21_lab FROM PUBLIC;
GRANT USAGE ON SCHEMA r21_lab TO r21_subject_alpha,r21_subject_beta,r21_subject_gamma;
GRANT SELECT ON r21_lab.flights,r21_lab.tracks TO r21_subject_alpha,r21_subject_beta,r21_subject_gamma;
INSERT INTO r21_lab.flights VALUES
  (101,'r21_subject_alpha'),(102,'r21_subject_alpha'),(201,'r21_subject_beta');
INSERT INTO r21_lab.tracks VALUES
  (1001,101,'r21_subject_alpha','[{"lat":0,"lon":0,"alt":null,"time":null}]'::jsonb),
  (1002,102,'r21_subject_alpha','[{"lat":0,"lon":0,"alt":0,"time":null}]'::jsonb),
  (2001,201,'r21_subject_beta','[{"lat":0,"lon":0,"alt":null,"time":null}]'::jsonb);
-- An alpha participant on beta's flight is NOT beta track ownership.
INSERT INTO r21_lab.participants VALUES (201,'r21_subject_alpha');
ALTER TABLE r21_lab.flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE r21_lab.flights FORCE ROW LEVEL SECURITY;
ALTER TABLE r21_lab.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE r21_lab.tracks FORCE ROW LEVEL SECURITY;
CREATE POLICY flights_by_login_role ON r21_lab.flights
  FOR SELECT TO r21_subject_alpha,r21_subject_beta
  USING (owner_role = CURRENT_USER::name);
CREATE POLICY tracks_by_login_role ON r21_lab.tracks
  FOR SELECT TO r21_subject_alpha,r21_subject_beta
  USING (
    owner_role = CURRENT_USER::name AND EXISTS (
      SELECT 1 FROM r21_lab.flights AS f
      WHERE f.id = r21_lab.tracks.flight_id
        AND f.owner_role = CURRENT_USER::name
    )
  );
-- The high-privilege setup role is used ONLY to create isolated fake fixtures.
-- Subject tests use SET SESSION AUTHORIZATION in fresh psql processes to verify
-- effective permissions. This models DB subject scoping, NOT identity issuance.
