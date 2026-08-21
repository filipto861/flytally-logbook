"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { parseFlightInput } from "@/lib/flight-input";
import { localParts,overview,parseKml,splitPoints,suggestedSplits,trackStats } from "@/lib/kml";

export type FlightActionState = { error?: string };

async function resolvedPrice(userId: number, registration: string, date: string) {
  const rows = await sql`
    SELECT COALESCE(r.price_per_hour, a.default_price_per_hour) AS price_per_hour
    FROM aircraft a LEFT JOIN LATERAL (
      SELECT price_per_hour FROM rates WHERE user_id=${userId} AND UPPER(registration)=${registration}
        AND (valid_from IS NULL OR valid_from='' OR valid_from<=${date})
      ORDER BY valid_from DESC NULLS LAST, id DESC LIMIT 1
    ) r ON TRUE
    WHERE a.user_id=${userId} AND UPPER(a.registration)=${registration} LIMIT 1
  ` as Array<{ price_per_hour: number | null }>;
  return rows[0]?.price_per_hour ?? null;
}

export async function createFlight(_: FlightActionState, form: FormData): Promise<FlightActionState> {
  const { userId } = await requireUser(); const parsed = parseFlightInput(form);
  if (!parsed.data) return { error: parsed.error }; const f = parsed.data;
  const price = await resolvedPrice(userId, f.registration, f.date);
  const rows = await sql`
    INSERT INTO flights (user_id,date,evidence,registration,aircraft_type,aircraft_class,departure,arrival,off_block,takeoff,landing,on_block,starts,commander,instructor,role,task,price_per_hour,billing_basis,note)
    VALUES (${userId},${f.date},${f.evidence},${f.registration},${f.aircraftType},${f.aircraftClass},${f.departure},${f.arrival},${f.offBlock},${f.takeoff},${f.landing},${f.onBlock},${f.starts},${f.commander},${f.instructor},${f.role},${f.task},${price},${f.billingBasis},${f.note}) RETURNING id
  ` as Array<{ id: number | string }>;
  const id = Number(rows[0]?.id); revalidatePath("/dashboard"); revalidatePath("/flights"); redirect(`/flights/${id}`);
}

export async function importKmlFlight(_:FlightActionState,form:FormData):Promise<FlightActionState>{
  const {userId}=await requireUser();const file=form.get("kml");if(!(file instanceof File)||!file.size)return {error:"Vyberte KML soubor."};if(file.size>4*1024*1024)return {error:"KML soubor je větší než 4 MB."};
  let points;try{points=parseKml(await file.text())}catch{return {error:"KML soubor se nepodařilo přečíst."}}if(points.length<2)return {error:"V KML nebyl nalezen použitelný GPS track."};
  const registration=String(form.get("registration")??"").trim().toUpperCase();if(!registration)return {error:"Vyberte imatrikulaci."};const departure=String(form.get("departure")??"").trim().toUpperCase(),arrival=String(form.get("arrival")??"").trim().toUpperCase(),evidence=String(form.get("evidence")||"ULL"),role=String(form.get("role")||"PIC"),aircraftType=String(form.get("aircraftType")??""),aircraftClass=String(form.get("aircraftClass")||"ULL"),task=String(form.get("task")??"KML import"),note=String(form.get("note")??"");
  const parts=String(form.get("splitMode"))==="single"?[points]:splitPoints(points,suggestedSplits(points));let lastId=0;
  for(let index=0;index<parts.length;index++){const part=parts[index],stats=trackStats(part),start=localParts(stats.startUtc),end=localParts(stats.endUtc),manualDate=String(form.get("date")??""),date=manualDate||start?.date||new Date().toISOString().slice(0,10),offBlock=String(form.get("offBlock")||start?.time||""),onBlock=String(form.get("onBlock")||end?.time||""),price=await resolvedPrice(userId,registration,date),partNote=parts.length>1?`${note}${note?' · ':''}Smart KML ${index+1}/${parts.length}`:note;
    const rows=await sql`INSERT INTO flights(user_id,date,evidence,registration,aircraft_type,aircraft_class,departure,arrival,off_block,takeoff,landing,on_block,starts,commander,instructor,role,task,price_per_hour,billing_basis,note) VALUES(${userId},${date},${evidence},${registration},${aircraftType},${aircraftClass},${departure},${arrival},${offBlock},${offBlock},${onBlock},${onBlock},${parts.length>1?1:Math.max(0,Number(form.get("starts")||1))},'', '',${role},${task},${price},'BLOCK',${partNote}) RETURNING id` as Array<{id:number|string}>;lastId=Number(rows[0].id);const suffix=parts.length>1?`__part${index+1}-of-${parts.length}.kml`:file.name;
    await sql`INSERT INTO flight_tracks(user_id,flight_id,file_name,imported_at,point_count,distance_km,start_utc,end_utc,min_alt_m,max_alt_m,coordinates_json,overview_coordinates_json,overview_version) VALUES(${userId},${lastId},${suffix.slice(0,240)},NOW(),${stats.pointCount},${stats.distanceKm},${stats.startUtc},${stats.endUtc},${stats.minAlt},${stats.maxAlt},${JSON.stringify(part)},${JSON.stringify(overview(part))},1)`;
  }
  revalidatePath("/dashboard");revalidatePath("/flights");revalidatePath("/map");redirect(`/flights/${lastId}`);
}

export async function updateFlight(id: number, _: FlightActionState, form: FormData): Promise<FlightActionState> {
  const { userId } = await requireUser(); if (!Number.isSafeInteger(id) || id <= 0) return { error: "Neplatný záznam." };
  const parsed = parseFlightInput(form); if (!parsed.data) return { error: parsed.error }; const f = parsed.data;
  const result = await sql`
    UPDATE flights SET date=${f.date},evidence=${f.evidence},registration=${f.registration},aircraft_type=${f.aircraftType},aircraft_class=${f.aircraftClass},departure=${f.departure},arrival=${f.arrival},off_block=${f.offBlock},takeoff=${f.takeoff},landing=${f.landing},on_block=${f.onBlock},starts=${f.starts},commander=${f.commander},instructor=${f.instructor},role=${f.role},task=${f.task},billing_basis=${f.billingBasis},note=${f.note}
    WHERE id=${id} AND user_id=${userId} RETURNING id
  ` as Array<{ id: number | string }>;
  if (!result[0]) return { error: "Let nebyl nalezen nebo k němu nemáte přístup." };
  revalidatePath("/dashboard"); revalidatePath("/flights"); revalidatePath(`/flights/${id}`); return {};
}

export async function deleteFlight(id: number) {
  const { userId } = await requireUser(); if (!Number.isSafeInteger(id) || id <= 0) return;
  await sql`DELETE FROM flights WHERE id=${id} AND user_id=${userId}`;
  revalidatePath("/dashboard"); revalidatePath("/flights"); redirect("/flights");
}
