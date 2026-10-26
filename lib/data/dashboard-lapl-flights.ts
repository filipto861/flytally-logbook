import "server-only";
import { sql } from "@/lib/db";
import { resolveMovementCompatibility } from "@/lib/legacy-movement";
import { flightMinutes,rollingYearsStart,type RecencyFlight } from "@/lib/recency-engine";

// Bounded, read-only projection from the SAME certified evidence and signed
// instructor / legacy-movement contracts as the full Recency workspace.
// No ensure-schema calls or persisted snapshot reuse on the Dashboard.
const text=(value:unknown)=>String(value??"").trim();
const number=(value:unknown)=>Math.max(0,Number(value)||0);
const validDay=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!value.startsWith("0000")&&
  Number.isFinite(Date.parse(value+"T00:00:00Z"))&&new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value;

export async function getDashboardLaplFlights(userId:number,asOf:string):Promise<RecencyFlight[]|null>{
  if(!Number.isSafeInteger(userId)||userId<=0||!validDay(asOf))return[];
  const start=rollingYearsStart(asOf,2);
  const rows=await sql`SELECT f.date,f.starts,f.evidence,f.aircraft_class,f.role,
    f.off_block,f.on_block,f.landings_day,f.landings_night,
    f.movement_evidence_recorded,f.takeoffs_day,f.takeoffs_night,
    f.approaches_day,f.approaches_night,f.purpose_code,f.task,f.note,
    a.part_fcl_credit_class,a.part_fcl_credit_basis,a.part_fcl_credit_from,
    EXISTS(SELECT 1 FROM flight_verifications v
      WHERE v.flight_id=f.id AND v.flight_user_id=f.user_id
        AND v.record_revision=COALESCE(f.record_revision,1)
        AND v.flight_hash=f.certification_hash
        AND v.verification_role='INSTRUCTOR' AND v.status='signed'
    ) instructor_signed,
    NOT EXISTS(SELECT 1 FROM flight_audit_log created_audit
      JOIN flytally_feature_migrations movement_migration
        ON movement_migration.migration_key='v1.35.3-fcl060-structured-movements'
      WHERE created_audit.flight_id=f.id AND created_audit.user_id=f.user_id
        AND created_audit.action='created'
        AND created_audit.changed_at>=movement_migration.applied_at
    ) legacy_movement_candidate
    FROM flights f LEFT JOIN aircraft a ON a.user_id=f.user_id
      AND UPPER(TRIM(a.registration))=UPPER(TRIM(f.registration))
    WHERE f.user_id=${userId} AND f.certified_at IS NOT NULL
      -- Canonical ISO date text permits a bounded indexed string range.
      -- Never cast malformed legacy flight dates to PostgreSQL DATE.
      AND f.date>=${start} AND f.date<=${asOf}
    ORDER BY f.date DESC,f.id DESC` as Array<Record<string,unknown>>;
  // Any in-window malformed date invalidates the assessment. Do not skip a
  // relevant record and then accidentally report a positive/negative status.
  if(rows.some(row=>!validDay(text(row.date))))return null;
  return rows.flatMap(row=>{
    const date=text(row.date);
    if(!validDay(date)||date<start||date>asOf)return[];
    const movement=resolveMovementCompatibility({
      evidence:row.evidence,movementEvidenceRecorded:row.movement_evidence_recorded,
      legacyMovementCandidate:row.legacy_movement_candidate,starts:row.starts,
      landingsDay:row.landings_day,landingsNight:row.landings_night,
      takeoffsDay:row.takeoffs_day,takeoffsNight:row.takeoffs_night,
      approachesDay:row.approaches_day,approachesNight:row.approaches_night,
    });
    return [{
      date,evidence:text(row.evidence),aircraftClass:text(row.aircraft_class),
      role:text(row.role),minutes:flightMinutes(row.off_block,row.on_block),
      starts:number(row.starts),landingsDay:number(row.landings_day),
      landingsNight:number(row.landings_night),
      movementEvidenceRecorded:movement.movementEvidenceRecorded,
      takeoffsDay:movement.takeoffsDay,takeoffsNight:movement.takeoffsNight,
      approachesDay:movement.approachesDay,approachesNight:movement.approachesNight,
      purposeCode:text(row.purpose_code),task:text(row.task),note:text(row.note),
      instructorSigned:Boolean(row.instructor_signed),
      partFclCreditClass:text(row.part_fcl_credit_class),
      partFclCreditBasis:text(row.part_fcl_credit_basis),
      partFclCreditFrom:text(row.part_fcl_credit_from).slice(0,10),
    }];
  });
}
