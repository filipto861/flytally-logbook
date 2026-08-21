"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { parseFlightInput } from "@/lib/flight-input";
import { landingCount,localParts,overview,parseTrackFile,splitPoints,suggestedSplits,trackStats } from "@/lib/kml";

export type FlightActionState = { error?: string; success?: string };

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

async function nearestOwnAirport(userId:number,point:{lat:number;lon:number}){const rows=await sql`SELECT ident,((latitude_deg-${point.lat})*(latitude_deg-${point.lat})+(longitude_deg-${point.lon})*(longitude_deg-${point.lon})) score FROM airports WHERE user_id=${userId} AND active=1 AND latitude_deg BETWEEN ${point.lat-.3} AND ${point.lat+.3} AND longitude_deg BETWEEN ${point.lon-.45} AND ${point.lon+.45} ORDER BY score LIMIT 1` as Array<{ident:string;score:number}>;return rows[0]&&Number(rows[0].score)<.04?String(rows[0].ident||"").toUpperCase():"";}

export async function createFlight(_: FlightActionState, form: FormData): Promise<FlightActionState> {
  const { userId } = await requireUser(); const parsed = parseFlightInput(form);
  if (!parsed.data) return { error: parsed.error }; const f = parsed.data;
  const price = await resolvedPrice(userId, f.registration, f.date);
  const rows = await sql`
    INSERT INTO flights (user_id,date,evidence,registration,aircraft_type,aircraft_class,departure,arrival,off_block,takeoff,landing,on_block,starts,commander,instructor,role,task,price_per_hour,billing_basis,note)
    VALUES (${userId},${f.date},${f.evidence},${f.registration},${f.aircraftType},${f.aircraftClass},${f.departure},${f.arrival},${f.offBlock},${f.takeoff},${f.landing},${f.onBlock},${f.starts},${f.commander},${f.instructor},${f.role},${f.task},${price},${f.billingBasis},${f.note}) RETURNING id
  ` as Array<{ id: number | string }>;
  const id = Number(rows[0]?.id); revalidatePath("/dashboard"); revalidatePath("/flights"); redirect(String(form.get("intent"))==="another"?"/flights/new?added=1":`/flights/${id}`);
}

export async function importKmlFlight(_:FlightActionState,form:FormData):Promise<FlightActionState>{
  const {userId}=await requireUser();const file=form.get("kml");if(!(file instanceof File)||!file.size)return {error:"Vyberte KML, GPX nebo CSV soubor."};if(file.size>8*1024*1024)return {error:"Soubor je větší než 8 MB."};
  if(String(form.get("reviewed")||"")!=="yes")return {error:"Před uložením potvrďte finální kontrolu tracku."};
  let points;try{points=parseTrackFile(await file.text(),file.name)}catch{return {error:"Soubor se nepodařilo přečíst."}}if(points.length<2)return {error:"V souboru nebyl nalezen použitelný GPS track."};
  const registration=String(form.get("registration")??"").trim().toUpperCase();if(!registration)return {error:"Vyberte imatrikulaci."};const manualDeparture=String(form.get("departure")??"").trim().toUpperCase(),manualArrival=String(form.get("arrival")??"").trim().toUpperCase(),evidence=String(form.get("evidence")||"ULL"),role=String(form.get("role")||"PIC"),aircraftType=String(form.get("aircraftType")??""),aircraftClass=String(form.get("aircraftClass")||"ULL"),task=String(form.get("task")??"KML import"),note=String(form.get("note")??"");
  const splitMode=String(form.get("splitMode")),parts=splitMode==="single"?[points]:splitPoints(points,suggestedSplits(points)),multiple=parts.length>1;let lastId=0;
  for(let index=0;index<parts.length;index++){const part=parts[index],stats=trackStats(part),start=localParts(stats.startUtc),end=localParts(stats.endUtc),manualDate=String(form.get("date")??""),date=(!multiple?manualDate:"")||start?.date||manualDate||new Date().toISOString().slice(0,10),offBlock=(!multiple?String(form.get("offBlock")||""):"")||start?.time||"",onBlock=(!multiple?String(form.get("onBlock")||""):"")||end?.time||"",price=await resolvedPrice(userId,registration,date),partNote=multiple?`${note}${note?' · ':''}Smart KML ${index+1}/${parts.length}`:note,departure=manualDeparture||await nearestOwnAirport(userId,part[0]),arrival=manualArrival||await nearestOwnAirport(userId,part.at(-1)!);const detectedLandings=landingCount(part),starts=splitMode==="auto"?detectedLandings:Math.max(0,Number(form.get("starts")||detectedLandings));
    const rows=await sql`INSERT INTO flights(user_id,date,evidence,registration,aircraft_type,aircraft_class,departure,arrival,off_block,takeoff,landing,on_block,starts,commander,instructor,role,task,price_per_hour,billing_basis,note) VALUES(${userId},${date},${evidence},${registration},${aircraftType},${aircraftClass},${departure},${arrival},${offBlock},${offBlock},${onBlock},${onBlock},${starts},'', '',${role},${task},${price},'BLOCK',${partNote}) RETURNING id` as Array<{id:number|string}>;lastId=Number(rows[0].id);const suffix=parts.length>1?`__part${index+1}-of-${parts.length}.kml`:file.name;
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

export async function attachKmlTrack(flightId:number,_:FlightActionState,form:FormData):Promise<FlightActionState>{
  const {userId}=await requireUser();if(!Number.isSafeInteger(flightId)||flightId<=0)return{error:"Neplatný let."};
  const owned=await sql`SELECT id FROM flights WHERE id=${flightId} AND user_id=${userId}` as Array<{id:number}>;if(!owned[0])return{error:"Let nebyl nalezen."};
  const file=form.get("kml");if(!(file instanceof File)||!file.size)return{error:"Vyberte KML, GPX nebo CSV soubor."};if(file.size>8*1024*1024)return{error:"Soubor je větší než 8 MB."};
  let points;try{points=parseTrackFile(await file.text(),file.name)}catch{return{error:"Soubor se nepodařilo přečíst."}}if(points.length<2)return{error:"Soubor neobsahuje použitelný track."};
  const stats=trackStats(points);if(form.get("replace"))await sql`DELETE FROM flight_tracks WHERE user_id=${userId} AND flight_id=${flightId}`;
  await sql`INSERT INTO flight_tracks(user_id,flight_id,file_name,imported_at,point_count,distance_km,start_utc,end_utc,min_alt_m,max_alt_m,coordinates_json,overview_coordinates_json,overview_version) VALUES(${userId},${flightId},${file.name.slice(0,240)},NOW(),${stats.pointCount},${stats.distanceKm},${stats.startUtc},${stats.endUtc},${stats.minAlt},${stats.maxAlt},${JSON.stringify(points)},${JSON.stringify(overview(points))},1)`;
  revalidatePath(`/flights/${flightId}`);revalidatePath("/map");revalidatePath("/dashboard");return{success:"GPS track byl uložen."};
}

export async function deleteTrack(flightId:number,form:FormData){const {userId}=await requireUser();const trackId=Number(form.get("trackId"));if(!Number.isSafeInteger(trackId)||trackId<=0)return;await sql`DELETE FROM flight_tracks WHERE id=${trackId} AND flight_id=${flightId} AND user_id=${userId}`;revalidatePath(`/flights/${flightId}`);revalidatePath("/map");revalidatePath("/dashboard");}

export async function applyGpsTimes(flightId:number){const {userId}=await requireUser();const rows=await sql`SELECT start_utc,end_utc FROM flight_tracks WHERE user_id=${userId} AND flight_id=${flightId} AND start_utc IS NOT NULL AND end_utc IS NOT NULL ORDER BY start_utc LIMIT 1` as Array<{start_utc:string;end_utc:string}>;const row=rows[0];if(!row)return;const start=localParts(row.start_utc),end=localParts(row.end_utc);if(!start||!end)return;await sql`UPDATE flights SET off_block=${start.time},takeoff=${start.time},landing=${end.time},on_block=${end.time} WHERE id=${flightId} AND user_id=${userId}`;revalidatePath(`/flights/${flightId}`);revalidatePath("/flights");revalidatePath("/dashboard");}
