"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { parseFlightInput } from "@/lib/flight-input";
import { airportCandidateScore,flightEnvelope,landingCount,localParts,overview,parseTrackFile,splitPoints,trackEndpointCandidates,trackStats } from "@/lib/kml";
import { airportCatalogSize,nearestCatalogAirport } from "@/lib/airport-catalog";
import { serializeBilling } from "@/lib/billing";
import { shouldResolveStoredPrice } from "@/lib/rate-history";
import { flightFingerprint } from "@/lib/flight-dedup";
import { flightDateKey } from "@/lib/dashboard-math";

export type FlightActionState = { error?: string; success?: string };

async function resolvedPrice(userId: number, registration: string, date: string) {
  const rows = await sql`
    SELECT COALESCE(r.price_per_hour, a.default_price_per_hour) AS price_per_hour
    FROM aircraft a LEFT JOIN LATERAL (
      SELECT price_per_hour FROM rates WHERE user_id=${userId} AND UPPER(TRIM(registration))=UPPER(TRIM(${registration}))
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
  const rows=await sql`SELECT ident,COALESCE(name,'') name,latitude_deg,longitude_deg,user_id,COALESCE(source,'') source FROM airports WHERE active=1 AND COALESCE(closed,0)=0 AND latitude_deg BETWEEN ${minLat} AND ${maxLat} AND longitude_deg BETWEEN ${minLon} AND ${maxLon} AND (user_id=${userId} OR LOWER(COALESCE(source,'')) LIKE 'ourairports%') LIMIT 2500` as Array<{ident:string;name:string;latitude_deg:number;longitude_deg:number;user_id:number;source:string}>;
  const unique=new Map<string,typeof rows[number]>();for(const row of rows){const ident=String(row.ident||"").trim().toUpperCase();if(!ident)continue;const previous=unique.get(ident);if(!previous||Number(row.user_id)===userId)unique.set(ident,row)}
  let best:{row:typeof rows[number];distanceKm:number;score:number}|null=null;for(const row of unique.values()){const airport={lat:Number(row.latitude_deg),lon:Number(row.longitude_deg)};if(!Number.isFinite(airport.lat)||!Number.isFinite(airport.lon))continue;const ranked=airportCandidateScore(valid,airport);if(ranked.distanceKm<=35&&(!best||ranked.score<best.score))best={row,distanceKm:ranked.distanceKm,score:ranked.score}}
  if(best)return{ident:String(best.row.ident).toUpperCase(),name:String(best.row.name||""),distanceKm:Math.round(best.distanceKm*10)/10};
  const fallback=nearestCatalogAirport(valid,35);return fallback?{ident:fallback.ident,name:fallback.name,distanceKm:fallback.distanceKm}:null;
}

export async function detectTrackAirports(requests:AirportDetectionRequest[]):Promise<AirportDetectionResult>{
  const {userId}=await requireUser();const safe=requests.slice(0,20),countQuery=async()=>await sql`SELECT COUNT(DISTINCT UPPER(ident))::integer count FROM airports WHERE active=1 AND COALESCE(closed,0)=0 AND (user_id=${userId} OR LOWER(COALESCE(source,'')) LIKE 'ourairports%')` as Array<{count:number}>;const [parts,count]=await Promise.all([Promise.all(safe.map(async request=>{const [departure,arrival]=await Promise.all([nearestAirport(userId,request.departureCandidates),nearestAirport(userId,request.arrivalCandidates)]);return{departure,arrival}})),countQuery()]);
  return{parts,airportCount:Math.max(Number(count[0]?.count||0),airportCatalogSize())};
}

export async function redetectFlightAirports(flightId:number,_:FlightActionState,_form:FormData):Promise<FlightActionState>{
  const {userId}=await requireUser();if(!Number.isSafeInteger(flightId)||flightId<=0)return{error:"Neplatný let."};
  const rows=await sql`SELECT coordinates_json FROM flight_tracks WHERE user_id=${userId} AND flight_id=${flightId} ORDER BY start_utc NULLS LAST,id` as Array<{coordinates_json:unknown}>;
  const parts:Array<Array<{lat:number;lon:number}>>=[];for(const row of rows){try{const parsed=typeof row.coordinates_json==="string"?JSON.parse(row.coordinates_json):row.coordinates_json;if(!Array.isArray(parsed))continue;const valid=parsed.map(point=>({lat:Number(point?.lat),lon:Number(point?.lon)})).filter(point=>Number.isFinite(point.lat)&&Number.isFinite(point.lon)&&Math.abs(point.lat)<=90&&Math.abs(point.lon)<=180);if(valid.length>=2)parts.push(valid)}catch{}}
  if(!parts.length)return{error:"Let nemá použitelný GPS track."};
  const departureCandidates=trackEndpointCandidates(parts[0],false),arrivalCandidates=trackEndpointCandidates(parts.at(-1)!,true),[departure,arrival]=await Promise.all([nearestAirport(userId,departureCandidates),nearestAirport(userId,arrivalCandidates)]);
  if(!departure&&!arrival)return{error:"V okruhu 35 km od začátku ani konce tracku nebylo nalezeno letiště."};
  await sql`UPDATE flights SET departure=CASE WHEN ${departure?.ident||""}<>'' THEN ${departure?.ident||""} ELSE departure END,arrival=CASE WHEN ${arrival?.ident||""}<>'' THEN ${arrival?.ident||""} ELSE arrival END WHERE id=${flightId} AND user_id=${userId}`;
  revalidatePath(`/flights/${flightId}`);revalidatePath("/flights");revalidatePath("/database");revalidatePath("/map");
  const found=[departure?`odlet ${departure.ident} (${departure.distanceKm} km)`:"",arrival?`přílet ${arrival.ident} (${arrival.distanceKm} km)`:""].filter(Boolean).join(" · ");return{success:`Nalezeno a uloženo: ${found}.`};
}

export async function createFlight(_: FlightActionState, form: FormData): Promise<FlightActionState> {
  const { userId } = await requireUser(); const parsed = parseFlightInput(form);
  if (!parsed.data) return { error: parsed.error }; const f = parsed.data;
  const price = await resolvedPrice(userId, f.registration, f.date);
  const fingerprint=flightFingerprint(userId,{date:f.date,registration:f.registration,offBlock:f.offBlock,departure:f.departure,arrival:f.arrival});
  const results=await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${fingerprint},0))`,
    sql`INSERT INTO flights (user_id,date,evidence,registration,aircraft_type,aircraft_class,departure,arrival,off_block,takeoff,landing,on_block,starts,commander,instructor,role,task,price_per_hour,billing_basis,note)
      SELECT ${userId},${f.date},${f.evidence},${f.registration},${f.aircraftType},${f.aircraftClass},${f.departure},${f.arrival},${f.offBlock},${f.takeoff},${f.landing},${f.onBlock},${f.starts},${f.commander},${f.instructor},${f.role},${f.task},${price},${f.billingBasis},${f.note}
      WHERE NOT EXISTS(SELECT 1 FROM flights WHERE user_id=${userId} AND date::text=${f.date} AND UPPER(TRIM(registration))=${f.registration} AND COALESCE(off_block,'')=${f.offBlock} AND UPPER(TRIM(COALESCE(departure,'')))=${f.departure} AND UPPER(TRIM(COALESCE(arrival,'')))=${f.arrival}) RETURNING id`,
  ]);
  const rows=results[1] as Array<{id:number|string}>;
  if(!rows[0])return{error:"Stejný let už je v databázi uložený. Duplicitní odeslání bylo zablokováno."};
  const id = Number(rows[0]?.id); revalidatePath("/dashboard"); revalidatePath("/flights"); redirect(String(form.get("intent"))==="another"?"/flights/new?added=1":`/flights/${id}`);
}

export async function importKmlFlight(_:FlightActionState,form:FormData):Promise<FlightActionState>{
  const {userId}=await requireUser();const file=form.get("kml");if(!(file instanceof File)||!file.size)return {error:"Vyberte KML, GPX nebo CSV soubor."};if(file.size>8*1024*1024)return {error:"Soubor je větší než 8 MB."};
  let points;try{points=parseTrackFile(await file.text(),file.name)}catch{return {error:"Soubor se nepodařilo přečíst."}}if(points.length<2)return {error:"V souboru nebyl nalezen použitelný GPS track."};
  const registration=String(form.get("registration")??"").trim().toUpperCase();if(!registration)return {error:"Vyberte imatrikulaci."};const evidence=String(form.get("evidence")||"ULL"),role=String(form.get("role")||"PIC"),aircraftType=String(form.get("aircraftType")??""),aircraftClass=String(form.get("aircraftClass")||"ULL"),task=String(form.get("task")??"KML import"),billing=serializeBilling(form.get("billingBasis"),form.get("billingShare"));
  const rawIndices=String(form.get("splitIndices")||"").split(",").filter(Boolean).map(Number),indices=[...new Set(rawIndices)].filter(value=>Number.isSafeInteger(value)&&value>0&&value<points.length-1).sort((a,b)=>a-b);if(indices.length!==rawIndices.length)return{error:"Návrh rozdělení je neplatný. Nahrajte soubor znovu."};
  const parts=splitPoints(points,indices),partCount=Number(form.get("partCount"));if(!Number.isSafeInteger(partCount)||partCount!==parts.length||partCount<1||partCount>20)return{error:"Počet kontrolovaných letů neodpovídá rozdělení tracku."};
  const reviewed:Array<{date:string;offBlock:string;takeoff:string;landing:string;onBlock:string;departure:string;arrival:string;starts:number;note:string}>=[];
  const validTime=(value:string)=>!value||/^([01]\d|2[0-3]):[0-5]\d$/.test(value);for(let index=0;index<parts.length;index++){if(String(form.get(`part_${index}_reviewed`)||"")!=="yes")return{error:`Let ${index+1} nebyl jednotlivě potvrzen.`};const date=String(form.get(`part_${index}_date`)||""),offBlock=String(form.get(`part_${index}_offBlock`)||""),takeoff=String(form.get(`part_${index}_takeoff`)||""),landing=String(form.get(`part_${index}_landing`)||""),onBlock=String(form.get(`part_${index}_onBlock`)||"");if(flightDateKey(date)!==date||[offBlock,takeoff,landing,onBlock].some(value=>!validTime(value)))return{error:`Let ${index+1} má neplatné datum nebo čas.`};reviewed.push({date,offBlock,takeoff,landing,onBlock,departure:String(form.get(`part_${index}_departure`)||"").trim().toUpperCase().slice(0,16),arrival:String(form.get(`part_${index}_arrival`)||"").trim().toUpperCase().slice(0,16),starts:Math.max(0,Math.min(99,Number(form.get(`part_${index}_starts`)||1))),note:String(form.get(`part_${index}_note`)||"").trim().slice(0,2000)})}
  const priceCache=new Map<string,number|null>();const prepared=[];for(let index=0;index<parts.length;index++){const part=parts[index],stats=trackStats(part),envelope=flightEnvelope(part),values=reviewed[index];let price=priceCache.get(values.date);if(!priceCache.has(values.date)){price=await resolvedPrice(userId,registration,values.date);priceCache.set(values.date,price??null)}const [detectedDeparture,detectedArrival]=await Promise.all([values.departure?Promise.resolve(null):nearestAirport(userId,envelope.departureCandidates),values.arrival?Promise.resolve(null):nearestAirport(userId,envelope.arrivalCandidates)]),departure=values.departure||detectedDeparture?.ident||"",arrival=values.arrival||detectedArrival?.ident||"",partNote=parts.length>1?`${values.note}${values.note?' · ':''}Kontrolovaný import ${index+1}/${parts.length}`:values.note,suffix=parts.length>1?`__part${index+1}-of-${parts.length}.kml`:file.name;prepared.push({part,stats,values,price:price??null,departure,arrival,partNote,suffix:suffix.slice(0,240),fingerprint:flightFingerprint(userId,{date:values.date,registration,offBlock:values.offBlock,departure,arrival})})}
  if(new Set(prepared.map(item=>item.fingerprint)).size!==prepared.length)return{error:"Dvě části importu mají stejné datum, čas a trasu. Upravte rozdělení nebo časy před uložením."};
  const existing=await Promise.all(prepared.map(item=>sql`SELECT id FROM flights WHERE user_id=${userId} AND date::text=${item.values.date} AND UPPER(TRIM(registration))=${registration} AND COALESCE(off_block,'')=${item.values.offBlock} AND UPPER(TRIM(COALESCE(departure,'')))=${item.departure} AND UPPER(TRIM(COALESCE(arrival,'')))=${item.arrival} LIMIT 1`));
  if(existing.some(rows=>rows.length))return{error:"Nejméně jeden z kontrolovaných letů už je v databázi. Celý duplicitní import byl zablokován."};
  let lastId=0;try{const fingerprints=[...new Set(prepared.map(item=>item.fingerprint))].sort(),locks=fingerprints.map(value=>sql`SELECT pg_advisory_xact_lock(hashtextextended(${value},0))`),inserts=prepared.map(item=>sql`WITH inserted AS (INSERT INTO flights(user_id,date,evidence,registration,aircraft_type,aircraft_class,departure,arrival,off_block,takeoff,landing,on_block,starts,commander,instructor,role,task,price_per_hour,billing_basis,note) SELECT ${userId},${item.values.date},${evidence},${registration},${aircraftType},${aircraftClass},${item.departure},${item.arrival},${item.values.offBlock},${item.values.takeoff},${item.values.landing},${item.values.onBlock},${item.values.starts},'', '',${role},${task},${item.price},${billing},${item.partNote} WHERE NOT EXISTS(SELECT 1 FROM flights WHERE user_id=${userId} AND date::text=${item.values.date} AND UPPER(TRIM(registration))=${registration} AND COALESCE(off_block,'')=${item.values.offBlock} AND UPPER(TRIM(COALESCE(departure,'')))=${item.departure} AND UPPER(TRIM(COALESCE(arrival,'')))=${item.arrival}) RETURNING id) INSERT INTO flight_tracks(user_id,flight_id,file_name,imported_at,point_count,distance_km,start_utc,end_utc,min_alt_m,max_alt_m,coordinates_json,overview_coordinates_json,overview_version) SELECT ${userId},(SELECT id FROM inserted),${item.suffix},NOW(),${item.stats.pointCount},${item.stats.distanceKm},${item.stats.startUtc},${item.stats.endUtc},${item.stats.minAlt},${item.stats.maxAlt},${JSON.stringify(item.part)},${JSON.stringify(overview(item.part))},1 RETURNING flight_id`),results=await sql.transaction([...locks,...inserts]);const lastRows=results.at(-1) as Array<{flight_id:number|string}>;lastId=Number(lastRows?.[0]?.flight_id);if(!lastId)throw new Error("Import did not return a flight id")}catch(error){console.error("reviewed-import-transaction-failed",error);return{error:"Import se nepodařilo uložit. Databázová transakce byla celá vrácena zpět, takže nevznikly žádné částečné lety."}}
  revalidatePath("/dashboard");revalidatePath("/flights");revalidatePath("/map");redirect(`/flights/${lastId}`);
}

export async function updateFlight(id: number, _: FlightActionState, form: FormData): Promise<FlightActionState> {
  const { userId } = await requireUser(); if (!Number.isSafeInteger(id) || id <= 0) return { error: "Neplatný záznam." };
  const parsed = parseFlightInput(form); if (!parsed.data) return { error: parsed.error }; const f = parsed.data;
  const existingRows=await sql`SELECT registration,date::text date,price_per_hour FROM flights WHERE id=${id} AND user_id=${userId} LIMIT 1` as Array<{registration:string;date:string;price_per_hour:number|null}>;
  const existing=existingRows[0];if(!existing)return { error: "Let nebyl nalezen nebo k němu nemáte přístup." };
  const price=shouldResolveStoredPrice(existing,f.registration,f.date)?await resolvedPrice(userId,f.registration,f.date):existing.price_per_hour;
  const result = await sql`
    UPDATE flights SET date=${f.date},evidence=${f.evidence},registration=${f.registration},aircraft_type=${f.aircraftType},aircraft_class=${f.aircraftClass},departure=${f.departure},arrival=${f.arrival},off_block=${f.offBlock},takeoff=${f.takeoff},landing=${f.landing},on_block=${f.onBlock},starts=${f.starts},commander=${f.commander},instructor=${f.instructor},role=${f.role},task=${f.task},price_per_hour=${price},billing_basis=${f.billingBasis},note=${f.note}
    WHERE id=${id} AND user_id=${userId} RETURNING id
  ` as Array<{ id: number | string }>;
  if (!result[0]) return { error: "Let nebyl nalezen nebo k němu nemáte přístup." };
  revalidatePath("/dashboard"); revalidatePath("/flights"); revalidatePath(`/flights/${id}`); return {success:"Let byl uložen."};
}

export async function deleteFlight(id: number) {
  const { userId } = await requireUser(); if (!Number.isSafeInteger(id) || id <= 0) return;
  const owned=await sql`SELECT id FROM flights WHERE id=${id} AND user_id=${userId} LIMIT 1` as Array<{id:number}>;if(!owned[0])return;
  await sql.transaction([
    sql`DELETE FROM track_points WHERE user_id=${userId} AND track_id IN(SELECT id FROM flight_tracks WHERE user_id=${userId} AND flight_id=${id})`,
    sql`DELETE FROM flight_tracks WHERE user_id=${userId} AND flight_id=${id}`,
    sql`DELETE FROM flights WHERE id=${id} AND user_id=${userId}`,
  ]);
  revalidatePath("/dashboard"); revalidatePath("/flights"); redirect("/flights");
}

export async function attachKmlTrack(flightId:number,_:FlightActionState,form:FormData):Promise<FlightActionState>{
  const {userId}=await requireUser();if(!Number.isSafeInteger(flightId)||flightId<=0)return{error:"Neplatný let."};
  const owned=await sql`SELECT id FROM flights WHERE id=${flightId} AND user_id=${userId}` as Array<{id:number}>;if(!owned[0])return{error:"Let nebyl nalezen."};
  const file=form.get("kml");if(!(file instanceof File)||!file.size)return{error:"Vyberte KML, GPX nebo CSV soubor."};if(file.size>8*1024*1024)return{error:"Soubor je větší než 8 MB."};
  let points;try{points=parseTrackFile(await file.text(),file.name)}catch{return{error:"Soubor se nepodařilo přečíst."}}if(points.length<2)return{error:"Soubor neobsahuje použitelný track."};
  const stats=trackStats(points),envelope=flightEnvelope(points);
  const [departure,arrival]=await Promise.all([nearestAirport(userId,envelope.departureCandidates),nearestAirport(userId,envelope.arrivalCandidates)]),off=localParts(envelope.offBlockUtc),takeoff=localParts(envelope.takeoffUtc),landing=localParts(envelope.landingUtc),on=localParts(envelope.onBlockUtc);
  const replace=Boolean(form.get("replace")),queries=[];if(replace){queries.push(sql`DELETE FROM track_points WHERE user_id=${userId} AND track_id IN(SELECT id FROM flight_tracks WHERE user_id=${userId} AND flight_id=${flightId})`);queries.push(sql`DELETE FROM flight_tracks WHERE user_id=${userId} AND flight_id=${flightId}`)}queries.push(sql`INSERT INTO flight_tracks(user_id,flight_id,file_name,imported_at,point_count,distance_km,start_utc,end_utc,min_alt_m,max_alt_m,coordinates_json,overview_coordinates_json,overview_version) VALUES(${userId},${flightId},${file.name.slice(0,240)},NOW(),${stats.pointCount},${stats.distanceKm},${stats.startUtc},${stats.endUtc},${stats.minAlt},${stats.maxAlt},${JSON.stringify(points)},${JSON.stringify(overview(points))},1)`);queries.push(sql`UPDATE flights SET departure=CASE WHEN NULLIF(TRIM(COALESCE(departure,'')),'') IS NULL THEN ${departure?.ident||""} ELSE departure END,arrival=CASE WHEN NULLIF(TRIM(COALESCE(arrival,'')),'') IS NULL THEN ${arrival?.ident||""} ELSE arrival END,off_block=CASE WHEN NULLIF(TRIM(COALESCE(off_block,'')),'') IS NULL THEN ${off?.time||""} ELSE off_block END,takeoff=CASE WHEN NULLIF(TRIM(COALESCE(takeoff,'')),'') IS NULL THEN ${takeoff?.time||""} ELSE takeoff END,landing=CASE WHEN NULLIF(TRIM(COALESCE(landing,'')),'') IS NULL THEN ${landing?.time||""} ELSE landing END,on_block=CASE WHEN NULLIF(TRIM(COALESCE(on_block,'')),'') IS NULL THEN ${on?.time||""} ELSE on_block END WHERE id=${flightId} AND user_id=${userId}`);try{await sql.transaction(queries)}catch(error){console.error("attach-track-transaction-failed",error);return{error:"GPS track se nepodařilo bezpečně uložit. Původní data zůstala beze změny."}}
  revalidatePath(`/flights/${flightId}`);revalidatePath("/map");revalidatePath("/dashboard");return{success:"GPS track byl uložen."};
}

export async function deleteTrack(flightId:number,form:FormData){const {userId}=await requireUser();const trackId=Number(form.get("trackId"));if(!Number.isSafeInteger(flightId)||flightId<=0||!Number.isSafeInteger(trackId)||trackId<=0)return;const owned=await sql`SELECT id FROM flight_tracks WHERE id=${trackId} AND flight_id=${flightId} AND user_id=${userId} LIMIT 1` as Array<{id:number}>;if(!owned[0])return;await sql.transaction([sql`DELETE FROM track_points WHERE user_id=${userId} AND track_id=${trackId}`,sql`DELETE FROM flight_tracks WHERE id=${trackId} AND flight_id=${flightId} AND user_id=${userId}`]);revalidatePath(`/flights/${flightId}`);revalidatePath("/map");revalidatePath("/dashboard");}

export async function applyGpsTimes(flightId:number){const {userId}=await requireUser();const rows=await sql`SELECT coordinates_json FROM flight_tracks WHERE user_id=${userId} AND flight_id=${flightId} ORDER BY start_utc NULLS LAST,id LIMIT 1` as Array<{coordinates_json:string}>;if(!rows[0])return;let points;try{points=JSON.parse(rows[0].coordinates_json)}catch{return}if(!Array.isArray(points)||points.length<2)return;const envelope=flightEnvelope(points),off=localParts(envelope.offBlockUtc),takeoff=localParts(envelope.takeoffUtc),landing=localParts(envelope.landingUtc),on=localParts(envelope.onBlockUtc);if(!off||!takeoff||!landing||!on)return;await sql`UPDATE flights SET off_block=${off.time},takeoff=${takeoff.time},landing=${landing.time},on_block=${on.time} WHERE id=${flightId} AND user_id=${userId}`;revalidatePath(`/flights/${flightId}`);revalidatePath("/flights");revalidatePath("/dashboard");}
