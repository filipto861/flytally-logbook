import "server-only";
import { sql } from "@/lib/db";
import { flightEnvelope,landingCount,localParts } from "@/lib/kml";
import { getFlightTracks,type MapTrack } from "@/lib/data/tracks";
import type { KmlPoint } from "@/lib/track-processing";

export type FlightTrackSummary={
  id:number;
  fileName:string;
  pointCount:number;
  distanceKm:number;
  startUtc:string;
  endUtc:string;
  minAltM:number|null;
  maxAltM:number|null;
};

export type FlightGpsInference={
  trackId:number;
  offBlock:string;
  takeoff:string;
  landing:string;
  onBlock:string;
  landings:number;
};

export type FlightTrackReview={tracks:MapTrack[];inference:FlightGpsInference|null};

export async function getFlightTrackSummaries(userId:number,flightId:number):Promise<FlightTrackSummary[]>{
  const rows=await sql`
    SELECT t.id,COALESCE(t.file_name,'') file_name,COALESCE(t.point_count,0)::int point_count,
      COALESCE(t.distance_km,0) distance_km,t.start_utc,t.end_utc,t.min_alt_m,t.max_alt_m
    FROM flight_tracks t JOIN flights f ON f.id=t.flight_id AND f.user_id=t.user_id
    WHERE t.user_id=${userId} AND t.flight_id=${flightId}
    ORDER BY t.start_utc NULLS LAST,t.id
  ` as Array<Record<string,unknown>>;
  return rows.map(row=>({
    id:Number(row.id),fileName:String(row.file_name??""),pointCount:Number(row.point_count??0),distanceKm:Number(row.distance_km??0),
    startUtc:String(row.start_utc??""),endUtc:String(row.end_utc??""),
    minAltM:row.min_alt_m===null||row.min_alt_m===undefined?null:Number(row.min_alt_m),
    maxAltM:row.max_alt_m===null||row.max_alt_m===undefined?null:Number(row.max_alt_m),
  }));
}

function rawPoints(payload:unknown):KmlPoint[]{
  try{
    const parsed=typeof payload==="string"?JSON.parse(payload):payload;if(!Array.isArray(parsed))return[];
    return parsed.map(item=>{const lat=Number(item?.lat),lon=Number(item?.lon),rawAlt=item?.alt,alt=rawAlt===null||rawAlt===undefined?null:Number(rawAlt),time=item?.time?String(item.time):null;if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;return{lat,lon,alt:Number.isFinite(alt)?alt:null,time} satisfies KmlPoint}).filter((point):point is KmlPoint=>point!==null);
  }catch{return[]}
}

export async function getFlightTrackReview(userId:number,flightId:number):Promise<FlightTrackReview>{
  const [tracks,rows]=await Promise.all([
    getFlightTracks(userId,flightId),
    sql`SELECT t.id,t.coordinates_json FROM flight_tracks t JOIN flights f ON f.id=t.flight_id AND f.user_id=t.user_id
      WHERE t.user_id=${userId} AND t.flight_id=${flightId} ORDER BY t.start_utc NULLS LAST,t.id LIMIT 1` as Promise<Array<Record<string,unknown>>>,
  ]);
  const row=rows[0],points=rawPoints(row?.coordinates_json);
  if(!row||points.length<2)return{tracks,inference:null};
  try{
    const envelope=flightEnvelope(points),off=localParts(envelope.offBlockUtc),takeoff=localParts(envelope.takeoffUtc),landing=localParts(envelope.landingUtc),on=localParts(envelope.onBlockUtc);
    if(!off||!takeoff||!landing||!on)return{tracks,inference:null};
    return{tracks,inference:{trackId:Number(row.id),offBlock:off.time,takeoff:takeoff.time,landing:landing.time,onBlock:on.time,landings:landingCount(points)}};
  }catch{return{tracks,inference:null}}
}
