import "server-only";
import { sql } from "@/lib/db";
import { getDatabaseData } from "@/lib/data/database";
import { ensureV164Schema } from "@/lib/v164-schema";

const key=(value:unknown)=>String(value??"").trim().toUpperCase();

export async function getDatabaseDataV164(userId:number){
  await ensureV164Schema();
  const[data,contexts]=await Promise.all([
    getDatabaseData(userId),
    sql`SELECT id,registration,COALESCE(regulatory_category,'') regulatory_category,COALESCE(balloon_class,'') balloon_class,COALESCE(balloon_group,'') balloon_group FROM aircraft WHERE user_id=${userId}` as Promise<Array<Record<string,unknown>>>,
  ]);
  const byId=new Map(contexts.map(row=>[Number(row.id),row])),byRegistration=new Map(contexts.map(row=>[key(row.registration),row]));
  return{...data,aircraft:data.aircraft.map(row=>({...row,...(byId.get(Number(row.id))??byRegistration.get(key(row.registration))??{})}))};
}
