import "server-only";
import { sql } from "@/lib/db";
import { resolveMovementCompatibility } from "@/lib/legacy-movement";
import { rollingDaysStart,type RecencyFlight } from "@/lib/recency-engine";

// 90 calendar days, one owner-scoped read. Reuse the canonical movement-compatibility
// interpretation; no full historical Recency workspace or migrations on Dashboard.
const text=(value:unknown)=>String(value??"").trim();
const count=(value:unknown)=>Math.max(0,Number(value)||0);
const validDay=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+"T00:00:00Z"))&&new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value;

export async function getDashboardPassengerFlights(userId:number,asOf:string):Promise<RecencyFlight[]>{
  if(!Number.isSafeInteger(userId)||userId<=0||!validDay(asOf))return[];
  const startDate=rollingDaysStart(asOf,90);
  const rows=await sql`SELECT f.date,f.starts,f.evidence,f.aircraft_class,f.role,
    f.landings_day,f.landings_night,f.movement_evidence_recorded,
    f.takeoffs_day,f.takeoffs_night,f.approaches_day,f.approaches_night,
    a.part_fcl_credit_class,a.part_fcl_credit_basis,a.part_fcl_credit_from,
    NOT EXISTS(SELECT 1 FROM flight_audit_log created_audit
      JOIN flytally_feature_migrations movement_migration
        ON movement_migration.migration_key='v1.35.3-fcl060-structured-movements'
      WHERE created_audit.flight_id=f.id AND created_audit.user_id=f.user_id
        AND created_audit.action='created' AND created_audit.changed_at>=movement_migration.applied_at
    ) legacy_movement_candidate
    FROM flights f LEFT JOIN aircraft a ON a.user_id=f.user_id
       AND UPPER(TRIM(a.registration))=UPPER(TRIM(f.registration))
    WHERE f.user_id=${userId} AND f.certified_at IS NOT NULL
      AND f.date>=${startDate} AND f.date<=${asOf}
    ORDER BY f.date DESC,f.id DESC` as Array<Record<string,unknown>>;
  return rows.flatMap(row=>{
    const date=text(row.date).slice(0,10);
    if(!validDay(date)||date<startDate||date>asOf)return[];
    const movement=resolveMovementCompatibility({
      evidence:row.evidence,movementEvidenceRecorded:row.movement_evidence_recorded,
      legacyMovementCandidate:row.legacy_movement_candidate,starts:row.starts,
      landingsDay:row.landings_day,landingsNight:row.landings_night,
      takeoffsDay:row.takeoffs_day,takeoffsNight:row.takeoffs_night,
      approachesDay:row.approaches_day,approachesNight:row.approaches_night,
    });
    return [{
      date,evidence:text(row.evidence),aircraftClass:text(row.aircraft_class),
      role:text(row.role),minutes:0,landingsDay:count(row.landings_day),
      landingsNight:count(row.landings_night),starts:count(row.starts),
      movementEvidenceRecorded:movement.movementEvidenceRecorded,
      takeoffsDay:movement.takeoffsDay,takeoffsNight:movement.takeoffsNight,
      approachesDay:movement.approachesDay,approachesNight:movement.approachesNight,
      partFclCreditClass:text(row.part_fcl_credit_class),
      partFclCreditBasis:text(row.part_fcl_credit_basis),
      partFclCreditFrom:text(row.part_fcl_credit_from).slice(0,10),
    }];
  });
}
