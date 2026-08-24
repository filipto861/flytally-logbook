import "server-only";
import { calculatedFlightPrice } from "@/lib/billing";
import { sql } from "@/lib/db";
import { flightDateKey,flightMinutes } from "@/lib/dashboard-math";
import { isAuxiliaryLogbookRole } from "@/lib/logbook-print";
import { measureServerTask } from "@/lib/performance";

export const PERIODS=["all","year","12m","previous"] as const;
export type DashboardPeriod=(typeof PERIODS)[number];
export type PrimaryMetric={minutes:number;landings:number;flights:number};
export type MonthlyPoint={month:string;total:number;ull:number;easa:number;picUll:number;picEasa:number;landings:number};
export type DashboardData={
  displayName:string;rangeLabel:string;total:PrimaryMetric;ull:PrimaryMetric;easa:PrimaryMetric;picUll:PrimaryMetric;picEasa:PrimaryMetric;
  airMinutes:number;picMinutes:number;copilotMinutes:number;dualMinutes:number;instructorMinutes:number;nightMinutes:number;ifrMinutes:number;dayLandings:number;nightLandings:number;safetyMinutes:number;cost:number;tracks:number;gpsKm:number;
  uniqueAircraft:number;uniqueAirports:number;chartFlights:number;invalidDateFlights:number;
  lastFlight:null|{id:number;date:string;registration:string;departure:string;arrival:string};monthly:MonthlyPoint[];
  recentFlights:Array<{id:number;date:string;registration:string;departure:string;arrival:string}>;
  topAircraft:Array<{registration:string;flights:number;minutes:number;cost:number}>;
  topRoutes:Array<{route:string;flights:number;minutes:number}>;
  yearly:Array<{year:number;flights:number;minutes:number;landings:number}>;
};

type NormalizedFlight={
  id:number;date:string;dateKey:string|null;offBlock:string;evidence:string;role:string;registration:string;departure:string;arrival:string;
  landings:number;dayLandings:number;nightLandings:number;blockMinutes:number;airMinutes:number;picMinutes:number;copilotMinutes:number;dualMinutes:number;instructorMinutes:number;nightMinutes:number;ifrMinutes:number;cost:number;trackCount:number;gpsKm:number;
};

const num=(value:unknown)=>Number(value??0)||0;
const text=(value:unknown)=>String(value??"").trim();
const emptyMetric=():PrimaryMetric=>({minutes:0,landings:0,flights:0});
const addMetric=(metric:PrimaryMetric,flight:NormalizedFlight)=>{metric.flights+=1;metric.minutes+=flight.blockMinutes;metric.landings+=flight.landings};

function bounds(period:DashboardPeriod,today=new Date()){
  const year=today.getUTCFullYear();
  const iso=(date:Date)=>date.toISOString().slice(0,10);
  if(period==="year")return{start:`${year}-01-01`,end:iso(today),label:String(year)};
  if(period==="previous")return{start:`${year-1}-01-01`,end:`${year-1}-12-31`,label:String(year-1)};
  if(period==="12m"){
    const start=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()-12,today.getUTCDate()+1));
    return{start:iso(start),end:iso(today),label:`${start.toLocaleDateString("en-GB")}–${today.toLocaleDateString("en-GB")}`};
  }
  return{start:null,end:null,label:"all time"};
}

function normalize(row:Record<string,unknown>):NormalizedFlight{
  const instructor=text(row.instructor);
  const rawRole=text(row.role).toUpperCase();
  const role=instructor||rawRole==="STUDENT"?"DUAL":rawRole;
  const blockMinutes=flightMinutes(row.off_block,row.on_block),airMinutes=flightMinutes(row.takeoff,row.landing);
  const rawDate=text(row.date),dateKey=flightDateKey(row.date);
  return{
    id:num(row.id),date:dateKey??rawDate,dateKey,offBlock:text(row.off_block),evidence:text(row.evidence).toUpperCase(),role,
    registration:text(row.registration).toUpperCase(),departure:text(row.departure).toUpperCase(),arrival:text(row.arrival).toUpperCase(),
    landings:Math.max(0,Math.round(num(row.starts))),dayLandings:num(row.landings_day),nightLandings:num(row.landings_night),blockMinutes,airMinutes,picMinutes:num(row.pic_minutes),copilotMinutes:num(row.copilot_minutes),dualMinutes:num(row.dual_minutes),instructorMinutes:num(row.instructor_minutes),nightMinutes:num(row.night_minutes),ifrMinutes:num(row.ifr_minutes),
    cost:calculatedFlightPrice(row.price_per_hour,blockMinutes,airMinutes,row.billing_basis),
    trackCount:Math.max(0,Math.round(num(row.track_count))),gpsKm:Math.max(0,num(row.gps_km)),
  };
}

export async function getDashboardData(userId:number,requested:string):Promise<DashboardData>{
  const period:DashboardPeriod=PERIODS.includes(requested as DashboardPeriod)?requested as DashboardPeriod:"all";
  const {start,end,label}=bounds(period);
  const [userRows,rawRows]=await measureServerTask("dashboard-data",()=>Promise.all([
    sql`SELECT COALESCE(display_name,'Pilot') display_name FROM users WHERE id=${userId} LIMIT 1`,
    sql`WITH track AS (
      SELECT flight_id,COUNT(*)::int track_count,COALESCE(SUM(distance_km),0) gps_km
      FROM flight_tracks WHERE user_id=${userId} GROUP BY flight_id
    )
    SELECT f.id,f.date::text date,COALESCE(f.evidence,'') evidence,COALESCE(f.role,'') role,COALESCE(f.instructor,'') instructor,
      COALESCE(f.registration,'') registration,COALESCE(f.departure,'') departure,COALESCE(f.arrival,'') arrival,
      COALESCE(f.starts,0) starts,COALESCE(f.landings_day,0) landings_day,COALESCE(f.landings_night,0) landings_night,COALESCE(f.night_minutes,0) night_minutes,COALESCE(f.ifr_minutes,0) ifr_minutes,COALESCE(f.pic_minutes,0) pic_minutes,COALESCE(f.copilot_minutes,0) copilot_minutes,COALESCE(f.dual_minutes,0) dual_minutes,COALESCE(f.instructor_minutes,0) instructor_minutes,COALESCE(f.off_block,'') off_block,COALESCE(f.on_block,'') on_block,
      COALESCE(f.takeoff,'') takeoff,COALESCE(f.landing,'') landing,f.price_per_hour,COALESCE(f.billing_basis,'BLOCK') billing_basis,
      COALESCE(t.track_count,0) track_count,COALESCE(t.gps_km,0) gps_km
    FROM flights f LEFT JOIN track t ON t.flight_id=f.id WHERE f.user_id=${userId}
      AND (${start}::text IS NULL OR f.date::text>=${start}::text)
      AND (${end}::text IS NULL OR f.date::text<=${end}::text)`,
  ])) as [Array<Record<string,unknown>>,Array<Record<string,unknown>>];

  const allFlights=rawRows.map(normalize);
  const flights=allFlights.filter(flight=>{
    if(!start&&!end)return true;
    if(!flight.dateKey)return false;
    return(!start||flight.dateKey>=start)&&(!end||flight.dateKey<=end);
  });

  const total=emptyMetric(),ull=emptyMetric(),easa=emptyMetric(),picUll=emptyMetric(),picEasa=emptyMetric();
  let airMinutes=0,picMinutes=0,copilotMinutes=0,dualMinutes=0,instructorMinutes=0,nightMinutes=0,ifrMinutes=0,dayLandings=0,nightLandings=0,safetyMinutes=0,cost=0,tracks=0,gpsKm=0;
  const airports=new Set<string>();
  const monthlyMap=new Map<string,MonthlyPoint>();
  const aircraftMap=new Map<string,{registration:string;flights:number;minutes:number;cost:number}>();
  const routeMap=new Map<string,{route:string;flights:number;minutes:number}>();
  const yearMap=new Map<number,{year:number;flights:number;minutes:number;landings:number}>();

  for(const flight of flights){
    const auxiliary=isAuxiliaryLogbookRole(flight.role);
    if(!auxiliary){
      addMetric(total,flight);
      if(flight.evidence==="ULL")addMetric(ull,flight);
      if(flight.evidence==="EASA")addMetric(easa,flight);
      if(flight.role==="PIC"&&flight.evidence==="ULL")addMetric(picUll,flight);
      if(flight.role==="PIC"&&flight.evidence==="EASA")addMetric(picEasa,flight);
      airMinutes+=flight.airMinutes;
      picMinutes+=flight.picMinutes;copilotMinutes+=flight.copilotMinutes;dualMinutes+=flight.dualMinutes;instructorMinutes+=flight.instructorMinutes;nightMinutes+=flight.nightMinutes;ifrMinutes+=flight.ifrMinutes;dayLandings+=flight.dayLandings;nightLandings+=flight.nightLandings;
    }
    if(flight.role==="SAFETY PILOT")safetyMinutes+=flight.blockMinutes;
    cost+=flight.cost;tracks+=flight.trackCount;gpsKm+=flight.gpsKm;
    if(flight.departure)airports.add(flight.departure);
    if(flight.arrival)airports.add(flight.arrival);

    if(flight.registration){
      const value=aircraftMap.get(flight.registration)??{registration:flight.registration,flights:0,minutes:0,cost:0};
      if(!auxiliary){value.flights+=1;value.minutes+=flight.blockMinutes;}
      value.cost+=flight.cost;aircraftMap.set(flight.registration,value);
    }
    if(!auxiliary&&flight.departure&&flight.arrival){
      const route=`${flight.departure}–${flight.arrival}`;
      const value=routeMap.get(route)??{route,flights:0,minutes:0};
      value.flights+=1;value.minutes+=flight.blockMinutes;routeMap.set(route,value);
    }
    if(!auxiliary&&flight.dateKey){
      const month=flight.dateKey.slice(0,7);
      const monthly=monthlyMap.get(month)??{month,total:0,ull:0,easa:0,picUll:0,picEasa:0,landings:0};
      monthly.total+=flight.blockMinutes;monthly.landings+=flight.landings;
      if(flight.evidence==="ULL")monthly.ull+=flight.blockMinutes;
      if(flight.evidence==="EASA")monthly.easa+=flight.blockMinutes;
      if(flight.role==="PIC"&&flight.evidence==="ULL")monthly.picUll+=flight.blockMinutes;
      if(flight.role==="PIC"&&flight.evidence==="EASA")monthly.picEasa+=flight.blockMinutes;
      monthlyMap.set(month,monthly);
      const year=Number(flight.dateKey.slice(0,4));
      const yearly=yearMap.get(year)??{year,flights:0,minutes:0,landings:0};
      yearly.flights+=1;yearly.minutes+=flight.blockMinutes;yearly.landings+=flight.landings;yearMap.set(year,yearly);
    }
  }

  const ordered=[...flights].sort((left,right)=>(right.dateKey??"").localeCompare(left.dateKey??"")||right.offBlock.localeCompare(left.offBlock)||right.id-left.id);
  const recentFlights=ordered.slice(0,8).map(({id,date,registration,departure,arrival})=>({id,date,registration,departure,arrival}));
  const creditableFlights=flights.filter(flight=>!isAuxiliaryLogbookRole(flight.role));
  return{
    displayName:text(userRows[0]?.display_name)||"Pilot",rangeLabel:label,total,ull,easa,picUll,picEasa,
    airMinutes,picMinutes,copilotMinutes,dualMinutes,instructorMinutes,nightMinutes,ifrMinutes,dayLandings,nightLandings,safetyMinutes,cost,tracks,gpsKm,
    uniqueAircraft:aircraftMap.size,uniqueAirports:airports.size,
    chartFlights:creditableFlights.filter(flight=>Boolean(flight.dateKey)).length,invalidDateFlights:creditableFlights.filter(flight=>!flight.dateKey).length,
    lastFlight:recentFlights[0]??null,recentFlights,
    monthly:[...monthlyMap.values()].sort((left,right)=>left.month.localeCompare(right.month)),
    topAircraft:[...aircraftMap.values()].sort((left,right)=>right.minutes-left.minutes||left.registration.localeCompare(right.registration)),
    topRoutes:[...routeMap.values()].sort((left,right)=>right.flights-left.flights||right.minutes-left.minutes).slice(0,8),
    yearly:[...yearMap.values()].sort((left,right)=>right.year-left.year),
  };
}

export function formatDuration(minutes:number){const value=Math.max(0,Math.round(minutes));return`${Math.floor(value/60)}:${String(value%60).padStart(2,"0")}`}
