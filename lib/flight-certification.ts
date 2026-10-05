import "server-only";

import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { ensureV132Schema } from "@/lib/v132-schema";
import { ensureV162Schema } from "@/lib/v162-schema";
import { ensureV164Schema } from "@/lib/v164-schema";
import { ensureV166Schema } from "@/lib/v166-schema";
import { blockingComplianceIssues,flightCertificationCompliance,type ComplianceIssue } from "@/lib/fcl050-compliance";
import { flightCertificationHash } from "@/lib/certification-integrity";
import { refreshRecencySnapshot } from "@/lib/recency-service";

const text=(value:unknown)=>String(value??"").trim();

export type StoredFlightCertificationResult=
  |{status:"certified";flightId:number;recordRevision:number;certificationHash:string}
  |{status:"blocked";flightId:number;issues:ComplianceIssue[]}
  |{status:"already-certified";flightId:number}
  |{status:"locked";flightId:number}
  |{status:"stale";flightId:number}
  |{status:"not-found";flightId:number};

async function certificationRow(userId:number,flightId:number){
  const rows=await sql`SELECT
    f.id,f.xmin::text row_xmin,
    f.date::text date,f.evidence,f.registration,
    f.aircraft_make,f.aircraft_model,f.aircraft_variant,f.aircraft_type,f.aircraft_class,
    f.regulatory_category,f.balloon_class,f.balloon_group,f.balloon_operation,
    f.launch_method,f.launches,
    f.departure,f.arrival,f.off_block,f.takeoff,f.landing,f.on_block,f.starts,
    f.operation_type,f.engine_type,f.operator_name,f.flight_number,f.operation_context,
    f.landings_day,f.landings_night,f.movement_evidence_recorded,
    f.takeoffs_day,f.takeoffs_night,f.approaches_day,f.approaches_night,
    f.night_minutes,f.ifr_minutes,
    f.pic_minutes,f.copilot_minutes,f.dual_minutes,f.instructor_minutes,
    f.commander,f.instructor,f.role,f.task,f.note,f.purpose_code,
    f.verification_name,f.verification_reference,
    f.certified_at,f.certification_version,f.record_revision,f.correction_reason,
    f.locked_at,u.display_name pilot_name
  FROM flights f
  JOIN users u ON u.id=f.user_id
  WHERE f.id=${flightId} AND f.user_id=${userId}
  LIMIT 1` as Array<Record<string,unknown>>;
  return rows[0]??null;
}

export async function certifyStoredFlight(userId:number,flightId:number):Promise<StoredFlightCertificationResult>{
  if(!Number.isSafeInteger(userId)||userId<=0||!Number.isSafeInteger(flightId)||flightId<=0)return{status:"not-found",flightId};
  await ensureDatabaseOptimizations();
  await Promise.all([ensureV132Schema(),ensureV162Schema(),ensureV164Schema(),ensureV166Schema()]);

  const row=await certificationRow(userId,flightId);
  if(!row)return{status:"not-found",flightId};
  if(row.certified_at)return{status:"already-certified",flightId};
  if(row.locked_at)return{status:"locked",flightId};

  const issues=blockingComplianceIssues(flightCertificationCompliance(row,text(row.pilot_name)));
  if(issues.length)return{status:"blocked",flightId,issues};

  const certificationHash=flightCertificationHash({...row,certification_version:8},userId,8);
  if(!certificationHash)return{status:"blocked",flightId,issues:[{code:"certification_hash",field:"record",message:"The flight certification fingerprint could not be created.",severity:"error"}]};

  const results=await sql.transaction([
    sql`UPDATE flights
      SET certified_at=NOW(),
          certified_by_user_id=${userId},
          certification_hash=${certificationHash},
          certification_version=8,
          locked_at=NOW(),
          locked_by_user_id=${userId}
      WHERE id=${flightId}
        AND user_id=${userId}
        AND certified_at IS NULL
        AND locked_at IS NULL
        AND xmin::text=${String(row.row_xmin??"")}
      RETURNING id,COALESCE(record_revision,1)::integer record_revision,certification_hash`,
  ]);
  const updated=(results[0] as Array<{id:number|string;record_revision:number|string;certification_hash:string}>)[0];
  if(!updated){
    const latest=await certificationRow(userId,flightId);
    if(!latest)return{status:"not-found",flightId};
    if(latest.certified_at)return{status:"already-certified",flightId};
    if(latest.locked_at)return{status:"locked",flightId};
    return{status:"stale",flightId};
  }

  await refreshRecencySnapshot(userId);
  return{
    status:"certified",
    flightId:Number(updated.id),
    recordRevision:Math.max(1,Number(updated.record_revision)||1),
    certificationHash:String(updated.certification_hash||certificationHash),
  };
}