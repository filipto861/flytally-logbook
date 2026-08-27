import "server-only";
import { sql } from "@/lib/db";

declare global {
  // eslint-disable-next-line no-var
  var __flytallyV132Schema: Promise<void> | undefined;
}

const MIGRATION_KEY="v1.32-integrity-foundation";

async function applyV132Schema(){
  await sql`CREATE TABLE IF NOT EXISTS flytally_feature_migrations (
    migration_key TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const done=await sql`SELECT 1 ok FROM flytally_feature_migrations WHERE migration_key=${MIGRATION_KEY} LIMIT 1` as Array<{ok:number}>;
  if(done[0])return;

  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(132032026)`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS purpose_code TEXT NOT NULL DEFAULT ''`,
    sql`UPDATE flights SET purpose_code='LAPL_FCL140A_REFRESHER'
      WHERE UPPER(COALESCE(role,''))='DUAL'
        AND CONCAT_WS(' ',COALESCE(task,''),COALESCE(note,''))~*'(FCL[.]140[.]A|LAPL[[:space:]]+recency|recency[[:space:]]+training|refresher[[:space:]]+training)'`,
    sql`CREATE OR REPLACE FUNCTION flytally_sync_flight_purpose() RETURNS TRIGGER AS $$
      BEGIN
        IF UPPER(COALESCE(NEW.role,''))='DUAL'
          AND CONCAT_WS(' ',COALESCE(NEW.task,''),COALESCE(NEW.note,''))~*'(FCL[.]140[.]A|LAPL[[:space:]]+recency|recency[[:space:]]+training|refresher[[:space:]]+training)' THEN
          NEW.purpose_code:='LAPL_FCL140A_REFRESHER';
        ELSE
          NEW.purpose_code:='';
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`,
    sql`DROP TRIGGER IF EXISTS trg_flytally_sync_flight_purpose ON flights`,
    sql`CREATE TRIGGER trg_flytally_sync_flight_purpose BEFORE INSERT OR UPDATE OF role,task,note,purpose_code ON flights FOR EACH ROW EXECUTE FUNCTION flytally_sync_flight_purpose()`,

    sql`ALTER TABLE flight_participations ADD COLUMN IF NOT EXISTS decision_note TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE flight_participations ADD COLUMN IF NOT EXISTS approval_id BIGINT REFERENCES instructor_flight_approvals(id) ON DELETE SET NULL`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_flight_participations_approval_id ON flight_participations(approval_id) WHERE approval_id IS NOT NULL`,
    sql`INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,source_revision,source_hash,status,responded_at,decision_note,approval_id)
      SELECT a.flight_id,a.student_user_id,a.instructor_user_id,'INSTRUCTOR',a.record_revision,a.flight_hash,
        CASE
          WHEN a.status='approved' AND EXISTS(SELECT 1 FROM flight_verifications v WHERE v.flight_id=a.flight_id AND v.flight_user_id=a.student_user_id AND v.signer_user_id=a.instructor_user_id AND v.record_revision=a.record_revision AND v.flight_hash=a.flight_hash AND v.status='signed') THEN 'accepted'
          WHEN a.status='approved' THEN 'pending'
          WHEN a.status='revoked' THEN 'cancelled'
          ELSE a.status
        END,
        a.decided_at,COALESCE(a.decision_note,''),a.id
      FROM instructor_flight_approvals a
      ON CONFLICT(source_flight_id,source_revision,participant_user_id) DO UPDATE SET
        participant_role='INSTRUCTOR',source_hash=EXCLUDED.source_hash,
        status=CASE WHEN flight_participations.participant_flight_id IS NOT NULL THEN 'accepted' ELSE EXCLUDED.status END,
        responded_at=COALESCE(flight_participations.responded_at,EXCLUDED.responded_at),
        decision_note=CASE WHEN flight_participations.decision_note<>'' THEN flight_participations.decision_note ELSE EXCLUDED.decision_note END,
        approval_id=EXCLUDED.approval_id`,
    sql`UPDATE user_notifications n SET href='/connections/shared/'||p.id
      FROM flight_participations p
      WHERE p.approval_id IS NOT NULL AND n.href='/connections/flight/'||p.approval_id`,

    sql`CREATE OR REPLACE FUNCTION flytally_normalize_licence_type() RETURNS TRIGGER AS $$
      DECLARE compact TEXT;
      BEGIN
        compact:=regexp_replace(UPPER(TRIM(COALESCE(NEW.licence_type,''))),'[^A-Z0-9]','','g');
        IF compact='LAPLA' THEN NEW.licence_type:='LAPL(A)';
        ELSIF compact='PPLA' THEN NEW.licence_type:='PPL(A)';
        ELSIF compact='CPLA' THEN NEW.licence_type:='CPL(A)';
        ELSIF compact='ATPLA' THEN NEW.licence_type:='ATPL(A)';
        ELSE NEW.licence_type:=UPPER(TRIM(NEW.licence_type));
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`,
    sql`DROP TRIGGER IF EXISTS trg_flytally_normalize_licence_type ON pilot_licences`,
    sql`CREATE TRIGGER trg_flytally_normalize_licence_type BEFORE INSERT OR UPDATE OF licence_type ON pilot_licences FOR EACH ROW EXECUTE FUNCTION flytally_normalize_licence_type()`,
    sql`WITH normalized AS (
      SELECT id,user_id,licence_number,CASE regexp_replace(UPPER(TRIM(COALESCE(licence_type,''))),'[^A-Z0-9]','','g')
        WHEN 'LAPLA' THEN 'LAPL(A)' WHEN 'PPLA' THEN 'PPL(A)' WHEN 'CPLA' THEN 'CPL(A)' WHEN 'ATPLA' THEN 'ATPL(A)' ELSE UPPER(TRIM(licence_type)) END canonical
      FROM pilot_licences
    )
    UPDATE pilot_licences p SET licence_type=n.canonical FROM normalized n
      WHERE p.id=n.id AND p.licence_type<>n.canonical
        AND NOT EXISTS(SELECT 1 FROM pilot_licences q WHERE q.id<>p.id AND q.user_id=p.user_id AND q.licence_number=p.licence_number AND q.licence_type=n.canonical)`,

    sql`INSERT INTO flytally_feature_migrations(migration_key) VALUES(${MIGRATION_KEY}) ON CONFLICT(migration_key) DO NOTHING`,
  ]);
}

export function ensureV132Schema(){
  if(!globalThis.__flytallyV132Schema){
    globalThis.__flytallyV132Schema=applyV132Schema().catch(error=>{globalThis.__flytallyV132Schema=undefined;throw error});
  }
  return globalThis.__flytallyV132Schema;
}
