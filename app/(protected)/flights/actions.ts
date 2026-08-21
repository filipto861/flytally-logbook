"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { parseFlightInput } from "@/lib/flight-input";
import { flightEnvelope,haversineKm,landingCount,localParts,overview,parseTrackFile,splitPoints,trackStats } from "@/lib/kml";

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

export type AirportDetection={ident:string;name:string;distanceKm:number}|null;
export type AirportDetectionRequest={departureCandidates:Array<{lat:number;lon:number}>;arrivalCandidates:Array<{lat:number;lon:number}>};
export type AirportDetectionResult={parts:Array<{departure:AirportDetection;arrival:AirportDetection}>;airportCount:number};

async function nearestAirport(userId:number,candidates:Array<{lat:number;lon:number}>):Promise<AirportDetection>{
  const valid=candidates.filter(point=>Number.isFinite(point.lat)&&Number.isFinite(point.lon)&&Math.abs(point.lat)<=90&&Math.abs(point.lon)<=180).slice(0,20);if(!valid.length)return null;
  const minLat=Math.min(...valid.map(point=>point.lat))-.65,maxLat=Math.max(...valid.map(point=>point.lat))+.65,minLon=Math.min(...valid.map(point=>point.lon))-1,maxLon=Math.max(...valid.map(point=>point.lon))+1;
  const rows=await sql`SELECT ident,COALESCE(name,'') name,latitude_deg,longitude_deg,user_id,COALESCE(source,'') source FROM airports WHERE active=1 AND COALESCE(closed,0)=0 AND latitude_deg BETWEEN ${minLat} AND ${maxLat} AND longitude_deg BETWEEN ${minLon} AND ${maxLon} AND (user_id=${userId} OR source='ourairports_csv') LIMIT 2500` as Array<{ident:string;name:string;latitude_deg:number;longitude_deg:number;user_id:number;source:string}>;
  const unique=new Map<string,typeof rows[number]>();for(const row of rows){const ident=String(row.ident||"").trim().toUpperCase();if(!ident)continue;const previous=unique.get(ident);if(!previous||Number(row.user_id)===userId)unique.set(ident,row)}
  let best:{row:typeof rows[number];distanceKm:number}|null=null;for(const row of unique.values()){const airport={lat:Number(row.latitude_deg),lon:Number(row.longitude_deg),alt:null,time:null};if(!Number.isFinite(airport.lat)||!Number.isFinite(airport.lon))continue;for(const point of valid){const distanceKm=haversineKm({lat:point.lat,lon:point.lon,alt:null,time:null},airport);if(!best||distanceKm<best.distanceKm)best={row,distanceKm}}}
  return best&&best.distanceKm<=35?{ident:String(best.row.ident).toUpperCase(),name:String(best.row.name||""),distanceKm:Math.round(best.distanceKm*10)/10}:null;
}

export async function detectTrackAirports(requests:AirportDetectionRequest[]):Promise<AirportDetectionResult>{
  const {userId}=await requireUser();const safe=requests.slice(0,20),countQuery=async()=>await sql`SELECT COUNT(DISTINCT UPPER(ident))::integer count FROM airports WHERE active=1 AND COALESCE(closed,0)=0 AND (user_id=${userId} OR source='ourairports_csv')` as Array<{count:number}>;const [parts,count]=await Promise.all([Promise.all(safe.map(async request=>{const [departure,arrival]=await Promise.all([nearestAirport(userId,request.departureCandidates),nearestAirport(userId,request.arrivalCandidates)]);return{departure,arrival}})),countQuery()]);
  return{parts,airportCount:Number(count[0]?.count||0)};
}

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
  let points;try{points=parseTrackFile(await file.text(),file.name)}catch{return {error:"Soubor se nepodařilo přečíst."}}if(points.length<2)return {error:"V souboru nebyl nalezen použitelný GPS track."};
  const registration=String(form.get("registration")??"").trim().toUpperCase();if(!registration)return {error:"Vyberte imatrikulaci."};const evidence=String(form.get("evidence")||"ULL"),role=String(form.get("role")||"PIC"),aircraftType=String(form.get("aircraftType")??""),aircraftClass=String(form.get("aircraftClass")||"ULL"),task=String(form.get("task")??"KML import");
  const rawIndices=String(form.get("splitIndices")||"").split(",").filter(Boolean).map(Number),indices=[...new Set(rawIndices)].filter(value=>Number.isSafeInteger(value)&&value>0&&value<points.length-1).sort((a,b)=>a-b);if(indices.length!==rawIndices.length)return{error:"Návrh rozdělení je neplatný. Nahrajte soubor znovu."};
  const parts=splitPoints(points,indices),partCount=Number(form.get("partCount"));if(!Number.isSafeInteger(partCount)||partCount!==parts.length||partCount<1||partCount>20)return{error:"Počet kontrolovaných letů neodpovídá rozdělení tracku."};
  const reviewed:Array<{date:string;offBlock:string;takeoff:string;landing:string;onBlock:string;departure:string;arrival:string;starts:number;note:string}>=[];
  const validTime=(value:string)=>!value||/^([01]\d|2[0-3]):[0-5]\d$/.test(value);for(let index=0;index<parts.length;index++){if(String(form.get(`part_${index}_reviewed`)||"")!=="yes")return{error:`Let ${index+1} nebyl jednotlivě potvrzen.`};const date=String(form.get(`part_${index}_date`)||""),offBlock=String(form.get(`part_${index}_offBlock`)||""),takeoff=String(form.get(`part_${index}_takeoff`)||""),landing=String(form.get(`part_${index}_landing`)||""),onBlock=String(form.get(`part_${index}_onBlock`)||"");if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||[offBlock,takeoff,landing,onBlock].some(value=>!validTime(value)))return{error:`Let ${index+1} má neplatné datum nebo čas.`};reviewed.push({date,offBlock,takeoff,landing,onBlock,departure:String(form.get(`part_${index}_departure`)||"").trim().toUpperCase().slice(0,16),arrival:String(form.get(`part_${index}_arrival`)||"").trim().toUpperCase().slice(0,16),starts:Math.max(0,Math.min(99,Number(form.get(`part_${index}_starts`)||1))),note:String(form.get(`part_${index}_note`)||"").trim().slice(0,2000)})}
  let lastId=0;for(let index=0;index<parts.length;index++){const part=parts[index],stats=trackStats(part),envelope=flightEnvelope(part),values=reviewed[index],price=await resolvedPrice(userId,registration,values.date),departure=values.departure||(await nearestAirport(userId,envelope.departureCandidates))?.ident||"",arrival=values.arrival||(await nearestAirport(userId,envelope.arrivalCandidates))?.ident||"",partNote=parts.length>1?`${values.note}${values.note?' · ':''}Kontrolovaný import ${index+1}/${parts.length}`:values.note,starts=values.starts;
    const rows=await sql`INSERT INTO flights(user_id,date,evidence,registration,aircraft_type,aircraft_class,departure,arrival,off_block,takeoff,landing,on_block,starts,commander,instructor,role,task,price_per_hour,billing_basis,note) VALUES(${userId},${values.date},${evidence},${registration},${aircraftType},${aircraftClass},${departure},${arrival},${values.offBlock},${values.takeoff},${values.landing},${values.onBlock},${starts},'', '',${role},${task},${price},'BLOCK',${partNote}) RETURNING id` as Array<{id:number|string}>;lastId=Number(rows[0].id);const suffix=parts.length>1?`__part${index+1}-of-${parts.length}.kml`:file.name;
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
  const stats=trackStats(points),envelope=flightEnvelope(points);if(form.get("replace"))await sql`DELETE FROM flight_tracks WHERE user_id=${userId} AND flight_id=${flightId}`;
  await sql`INSERT INTO flight_tracks(user_id,flight_id,file_name,imported_at,point_count,distance_km,start_utc,end_utc,min_alt_m,max_alt_m,coordinates_json,overview_coordinates_json,overview_version) VALUES(${userId},${flightId},${file.name.slice(0,240)},NOW(),${stats.pointCount},${stats.distanceKm},${stats.startUtc},${stats.endUtc},${stats.minAlt},${stats.maxAlt},${JSON.stringify(points)},${JSON.stringify(overview(points))},1)`;
  const [departure,arrival]=await Promise.all([nearestAirport(userId,envelope.departureCandidates),nearestAirport(userId,envelope.arrivalCandidates)]),off=localParts(envelope.offBlockUtc),takeoff=localParts(envelope.takeoffUtc),landing=localParts(envelope.landingUtc),on=localParts(envelope.onBlockUtc);
  await sql`UPDATE flights SET departure=CASE WHEN NULLIF(TRIM(COALESCE(departure,'')),'') IS NULL THEN ${departure?.ident||""} ELSE departure END,arrival=CASE WHEN NULLIF(TRIM(COALESCE(arrival,'')),'') IS NULL THEN ${arrival?.ident||""} ELSE arrival END,off_block=CASE WHEN NULLIF(TRIM(COALESCE(off_block,'')),'') IS NULL THEN ${off?.time||""} ELSE off_block END,takeoff=CASE WHEN NULLIF(TRIM(COALESCE(takeoff,'')),'') IS NULL THEN ${takeoff?.time||""} ELSE takeoff END,landing=CASE WHEN NULLIF(TRIM(COALESCE(landing,'')),'') IS NULL THEN ${landing?.time||""} ELSE landing END,on_block=CASE WHEN NULLIF(TRIM(COALESCE(on_block,'')),'') IS NULL THEN ${on?.time||""} ELSE on_block END WHERE id=${flightId} AND user_id=${userId}`;
  revalidatePath(`/flights/${flightId}`);revalidatePath("/map");revalidatePath("/dashboard");return{success:"GPS track byl uložen."};
}

export async function deleteTrack(flightId:number,form:FormData){const {userId}=await requireUser();const trackId=Number(form.get("trackId"));if(!Number.isSafeInteger(trackId)||trackId<=0)return;await sql`DELETE FROM flight_tracks WHERE id=${trackId} AND flight_id=${flightId} AND user_id=${userId}`;revalidatePath(`/flights/${flightId}`);revalidatePath("/map");revalidatePath("/dashboard");}

export async function applyGpsTimes(flightId:number){const {userId}=await requireUser();const rows=await sql`SELECT coordinates_json FROM flight_tracks WHERE user_id=${userId} AND flight_id=${flightId} ORDER BY start_utc NULLS LAST,id LIMIT 1` as Array<{coordinates_json:string}>;if(!rows[0])return;let points;try{points=JSON.parse(rows[0].coordinates_json)}catch{return}if(!Array.isArray(points)||points.length<2)return;const envelope=flightEnvelope(points),off=localParts(envelope.offBlockUtc),takeoff=localParts(envelope.takeoffUtc),landing=localParts(envelope.landingUtc),on=localParts(envelope.onBlockUtc);if(!off||!takeoff||!landing||!on)return;await sql`UPDATE flights SET off_block=${off.time},takeoff=${takeoff.time},landing=${landing.time},on_block=${on.time} WHERE id=${flightId} AND user_id=${userId}`;revalidatePath(`/flights/${flightId}`);revalidatePath("/flights");revalidatePath("/dashboard");}
