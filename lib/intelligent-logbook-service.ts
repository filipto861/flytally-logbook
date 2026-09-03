import "server-only";
import { sql } from "@/lib/db";
import { ensureV166Schema } from "@/lib/v166-schema";
import { intelligentMinutes,latestContinuationSuggestion,type IntelligentFlightHistory } from "@/lib/intelligent-logbook";

const text=(value:unknown)=>String(value??"").trim();
export type IntelligentEntryContext={history:IntelligentFlightHistory[];continuation:ReturnType<typeof latestContinuationSuggestion>};

export async function getIntelligentEntryContext(userId:number):Promise<IntelligentEntryContext>{
  await ensureV166Schema();
  const rows=await sql`SELECT id,date::text date,registration,departure,arrival,off_block,on_block,takeoff,landing,certified_at FROM flights WHERE user_id=${userId} ORDER BY date DESC,off_block DESC NULLS LAST,id DESC LIMIT 100` as Array<Record<string,unknown>>;
  const history:IntelligentFlightHistory[]=rows.map(row=>({
    id:Number(row.id)||0,date:text(row.date).slice(0,10),registration:text(row.registration).toUpperCase(),departure:text(row.departure).toUpperCase(),arrival:text(row.arrival).toUpperCase(),offBlock:text(row.off_block),onBlock:text(row.on_block),takeoff:text(row.takeoff),landing:text(row.landing),blockMinutes:intelligentMinutes(row.off_block,row.on_block),certified:Boolean(row.certified_at),
  }));
  return{history,continuation:latestContinuationSuggestion(history)};
}
