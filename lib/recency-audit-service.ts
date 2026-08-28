import "server-only";
import { sql } from "@/lib/db";
import { ensureV1353Schema } from "@/lib/v1353-schema";
import { buildCustomRecencyAudit,buildRecencyAudit,type RecencyAuditBundle,type RecencyAuditFlight } from "@/lib/recency-audit";
import { flightMinutes,parseCustomRecencyRules,type RecencyEvaluation,type RecencyEvidence } from "@/lib/recency-engine";

const text=(value:unknown)=>String(value??"").trim();

export async function getRecencyAuditForUser(userId:number,evaluations:RecencyEvaluation[],evidence:RecencyEvidence[],preferences:unknown,today:string):Promise<Record<string,RecencyAuditBundle>>{
  await ensureV1353Schema();
  const preferenceRecord=preferences&&typeof preferences==="object"&&!Array.isArray(preferences)?preferences as Record<string,unknown>:{};
  const customRules=parseCustomRecencyRules(preferenceRecord.recency_rules),maxDays=Math.max(730,...customRules.map(rule=>rule.windowDays));
  const rows=await sql`SELECT f.id,f.date,f.evidence,f.registration,f.aircraft_class,f.role,f.departure,f.arrival,f.off_block,f.on_block,f.landings_day,f.landings_night,f.movement_evidence_recorded,f.takeoffs_day,f.takeoffs_night,f.approaches_day,f.approaches_night,f.purpose_code,f.task,f.note,EXISTS(SELECT 1 FROM flight_verifications v WHERE v.flight_id=f.id AND v.flight_user_id=f.user_id AND v.record_revision=COALESCE(f.record_revision,1) AND v.flight_hash=f.certification_hash AND v.verification_role='INSTRUCTOR' AND v.status='signed') instructor_signed FROM flights f WHERE f.user_id=${userId} AND f.certified_at IS NOT NULL AND CASE WHEN f.date~'^\\d{4}-\\d{2}-\\d{2}$' THEN f.date::date ELSE NULL END>=CURRENT_DATE-(${maxDays}::int*INTERVAL '1 day') ORDER BY f.date DESC,f.id DESC` as Array<Record<string,unknown>>;
  const flights:RecencyAuditFlight[]=rows.map(row=>({id:Number(row.id)||0,date:text(row.date).slice(0,10),evidence:text(row.evidence),registration:text(row.registration),aircraftClass:text(row.aircraft_class),role:text(row.role),departure:text(row.departure),arrival:text(row.arrival),minutes:flightMinutes(row.off_block,row.on_block),landingsDay:Number(row.landings_day)||0,landingsNight:Number(row.landings_night)||0,movementEvidenceRecorded:Boolean(row.movement_evidence_recorded),takeoffsDay:Number(row.takeoffs_day)||0,takeoffsNight:Number(row.takeoffs_night)||0,approachesDay:Number(row.approaches_day)||0,approachesNight:Number(row.approaches_night)||0,purposeCode:text(row.purpose_code),task:text(row.task),note:text(row.note),instructorSigned:Boolean(row.instructor_signed)}));
  const rulesById=new Map(customRules.map(rule=>[rule.id,rule])),audit:Record<string,RecencyAuditBundle>={};
  for(const evaluation of evaluations){const rule=rulesById.get(evaluation.id);audit[evaluation.id]=rule?buildCustomRecencyAudit(rule,flights,today):buildRecencyAudit(evaluation,flights,evidence,today)}
  return audit;
}
