import "server-only";
import { cache } from "react";
import { sql } from "@/lib/db";
import { ensureV166Schema } from "@/lib/v166-schema";
import { intelligentLogbookAttention,intelligentMinutes,latestContinuationSuggestion,type IntelligentAttentionFlight,type IntelligentFlightHistory } from "@/lib/intelligent-logbook";
import { actionableIntelligentAttention } from "@/lib/actionable-intelligent-attention";
import type { IntelligentEntryContext } from "@/lib/intelligent-logbook-client-types";

const text=(value:unknown)=>String(value??"").trim();
const bool=(value:unknown)=>value===true||value===1||["1","true","yes"].includes(text(value).toLowerCase());

async function loadIntelligentHistory(userId:number,limit:number):Promise<IntelligentFlightHistory[]>{
  await ensureV166Schema();
  const rows=await sql`
    SELECT id,date::text date,registration,aircraft_type,aircraft_class,regulatory_category,evidence,role,operation_type,engine_type,
           operator_name,flight_number,operation_context,departure,arrival,off_block,on_block,takeoff,landing,starts,
           landings_day,landings_night,movement_evidence_recorded,takeoffs_day,takeoffs_night,approaches_day,approaches_night,certified_at
    FROM flights
    WHERE user_id=${userId}
    ORDER BY date DESC,off_block DESC NULLS LAST,id DESC
    LIMIT ${Math.max(1,Math.min(1000,limit))}
  ` as Array<Record<string,unknown>>;
  return rows.map(row=>({
    id:Number(row.id)||0,
    date:text(row.date).slice(0,10),
    registration:text(row.registration).toUpperCase(),
    aircraftType:text(row.aircraft_type),
    aircraftClass:text(row.aircraft_class).toUpperCase(),
    regulatoryCategory:text(row.regulatory_category).toUpperCase(),
    evidence:text(row.evidence).toUpperCase(),
    role:text(row.role).toUpperCase(),
    operationType:text(row.operation_type).toUpperCase(),
    engineType:text(row.engine_type).toUpperCase(),
    operatorName:text(row.operator_name),
    flightNumber:text(row.flight_number).toUpperCase(),
    operationContext:text(row.operation_context).toUpperCase(),
    departure:text(row.departure).toUpperCase(),
    arrival:text(row.arrival).toUpperCase(),
    offBlock:text(row.off_block),
    onBlock:text(row.on_block),
    takeoff:text(row.takeoff),
    landing:text(row.landing),
    blockMinutes:intelligentMinutes(row.off_block,row.on_block),
    starts:Number(row.starts)||0,
    landingsDay:Number(row.landings_day)||0,
    landingsNight:Number(row.landings_night)||0,
    movementEvidenceRecorded:bool(row.movement_evidence_recorded),
    takeoffsDay:Number(row.takeoffs_day)||0,
    takeoffsNight:Number(row.takeoffs_night)||0,
    approachesDay:Number(row.approaches_day)||0,
    approachesNight:Number(row.approaches_night)||0,
    certified:Boolean(row.certified_at),
  }));
}

export async function getIntelligentEntryContext(userId:number):Promise<IntelligentEntryContext>{
  const history=await loadIntelligentHistory(userId,100);
  return{history,continuation:latestContinuationSuggestion(history)};
}

export const getIntelligentLogbookAttention=cache(async(userId:number):Promise<IntelligentAttentionFlight[]>=>{
  const history=await loadIntelligentHistory(userId,500);
  return actionableIntelligentAttention(intelligentLogbookAttention(history));
});
