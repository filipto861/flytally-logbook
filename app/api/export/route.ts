import { getSession } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { buildAccountBackup } from "@/lib/account-backup";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";

export const dynamic="force-dynamic";

const clean=(value:unknown)=>{const text=String(value??"").trim();return ["nan","null","undefined"].includes(text.toLowerCase())?"":text};
const esc=(value:unknown)=>`"${clean(value).replaceAll('"','""')}"`;
const xml=(value:unknown)=>clean(value).replace(/[<>&'\"]/g,char=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"}[char]!));
const hm=(value:unknown)=>{const total=Math.max(0,Math.round(Number(value)||0));return`${Math.floor(total/60)}:${String(total%60).padStart(2,"0")}`};
const durationMinutes=(value:unknown)=>{const parts=clean(value).split(":").map(Number);return parts.length===2&&parts.every(Number.isFinite)?Math.max(0,(parts[0]||0)*60+(parts[1]||0)):0};

const flightColumns=[
  "date","evidence","registration","aircraft_make","aircraft_model","aircraft_variant","aircraft_type","aircraft_class","operation_type","engine_type",
  "departure","arrival","off_block","takeoff","landing","on_block","block_time","air_time","landings_day","landings_night","night_minutes","ifr_minutes",
  "role","pic_minutes","copilot_minutes","dual_minutes","instructor_minutes","commander","instructor","verification_name","verification_reference","task","note",
  "certified_at","record_revision","correction_reason","price_per_hour","billing_basis","track_count","gps_km"
];
const fstdColumns=["session_date","device_type","qualification_number","instruction","total_time","accumulated_time","remarks","certified_at","record_revision","correction_reason"];

function worksheet(name:string,columns:string[],rows:Array<Record<string,unknown>>){
  return `<Worksheet ss:Name="${xml(name)}"><Table><Row>${columns.map(column=>`<Cell><Data ss:Type="String">${xml(column)}</Data></Cell>`).join("")}</Row>${rows.map(row=>`<Row>${columns.map(column=>`<Cell><Data ss:Type="String">${xml(row[column])}</Data></Cell>`).join("")}</Row>`).join("")}</Table></Worksheet>`;
}

export async function GET(request:Request){
  const session=await getSession();
  if(!session)return new Response("Unauthorized",{status:401});
  await ensureDatabaseOptimizations();

  const url=new URL(request.url),format=url.searchParams.get("format")||"csv",from=url.searchParams.get("from")||null,to=url.searchParams.get("to")||null,evidence=url.searchParams.get("evidence")||null,registration=url.searchParams.get("registration")?.trim().toUpperCase()||null,auxiliary=url.searchParams.get("auxiliary")==="include"?"include":"exclude";
  const stamp=new Date().toISOString().slice(0,10);

  if(format==="json"){
    const {json}=await buildAccountBackup(session.userId);
    return new Response(json,{headers:{"content-type":"application/json; charset=utf-8","content-disposition":`attachment; filename=flytally-backup-${stamp}.json`,"cache-control":"private, no-store"}});
  }

  const rows=await sql`
    WITH t AS (
      SELECT flight_id,COUNT(*)::int track_count,COALESCE(SUM(distance_km),0) gps_km
      FROM flight_tracks WHERE user_id=${session.userId} GROUP BY flight_id
    )
    SELECT f.*,
      CASE WHEN off_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND on_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        THEN (MOD((split_part(on_block,':',1)::int*60+split_part(on_block,':',2)::int)-(split_part(off_block,':',1)::int*60+split_part(off_block,':',2)::int)+1440,1440)/60)::text||':'||LPAD((MOD((split_part(on_block,':',1)::int*60+split_part(on_block,':',2)::int)-(split_part(off_block,':',1)::int*60+split_part(off_block,':',2)::int)+1440,1440)%60)::text,2,'0')
        ELSE '' END block_time,
      CASE WHEN takeoff ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND landing ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        THEN (MOD((split_part(landing,':',1)::int*60+split_part(landing,':',2)::int)-(split_part(takeoff,':',1)::int*60+split_part(takeoff,':',2)::int)+1440,1440)/60)::text||':'||LPAD((MOD((split_part(landing,':',1)::int*60+split_part(landing,':',2)::int)-(split_part(takeoff,':',1)::int*60+split_part(takeoff,':',2)::int)+1440,1440)%60)::text,2,'0')
        ELSE '' END air_time,
      COALESCE(t.track_count,0) track_count,COALESCE(t.gps_km,0) gps_km
    FROM flights f LEFT JOIN t ON t.flight_id=f.id
    WHERE f.user_id=${session.userId}
      AND (${from}::date IS NULL OR f.date::date>=${from}::date)
      AND (${to}::date IS NULL OR f.date::date<=${to}::date)
      AND (${evidence}::text IS NULL OR UPPER(TRIM(f.evidence))=UPPER(${evidence}::text))
      AND (${registration}::text IS NULL OR UPPER(TRIM(f.registration))=${registration}::text)
      AND (${auxiliary}='include' OR UPPER(TRIM(COALESCE(f.role,''))) NOT IN ('SAFETY PILOT','PAX','OBSERVER'))
    ORDER BY date,off_block,id
  ` as Array<Record<string,unknown>>;

  if(format==="xls"){
    const fstdRaw=await sql`
      SELECT session_date::text session_date,device_type,qualification_number,instruction,total_minutes,remarks,certified_at,record_revision,correction_reason
      FROM fstd_sessions WHERE user_id=${session.userId} ORDER BY session_date,id
    ` as Array<Record<string,unknown>>;
    let accumulatedFstd=0;
    const fstdRows=fstdRaw.map(row=>{const minutes=Math.max(0,Math.round(Number(row.total_minutes)||0));accumulatedFstd+=minutes;return{...row,total_time:hm(minutes),accumulated_time:hm(accumulatedFstd)}});

    const summarize=(key:(row:Record<string,unknown>)=>string)=>{const map=new Map<string,{flights:number;landings:number}>();for(const row of rows){const itemKey=key(row)||"—",value=map.get(itemKey)??{flights:0,landings:0};value.flights++;value.landings+=Number(row.landings_day||0)+Number(row.landings_night||0);map.set(itemKey,value)}return[...map].map(([name,value])=>({name,...value})).sort((a,b)=>b.flights-a.flights)};
    const aircraftSummary=summarize(row=>clean(row.registration)||"—").map(row=>({registration:row.name,flights:row.flights,landings:row.landings}));
    const routeSummary=summarize(row=>`${clean(row.departure)||"—"}→${clean(row.arrival)||"—"}`).map(row=>{const [departure,arrival]=row.name.split("→");return{departure,arrival,flights:row.flights,landings:row.landings}});
    const airportCounts=new Map<string,number>();for(const row of rows)for(const airport of [row.departure,row.arrival]){const key=clean(airport);if(key)airportCounts.set(key,(airportCounts.get(key)||0)+1)}
    const airportSummary=[...airportCounts].map(([airport,movements])=>({airport,movements})).sort((a,b)=>b.movements-a.movements);
    const totalMinutes=rows.reduce((total,row)=>total+durationMinutes(row.block_time),0),summary=[
      {metric:"Flights",value:rows.length},
      {metric:"BLOCK",value:hm(totalMinutes)},
      {metric:"Landings",value:rows.reduce((total,row)=>total+Number(row.landings_day||0)+Number(row.landings_night||0),0)},
      {metric:"FSTD",value:hm(accumulatedFstd)},
      {metric:"GPS km",value:rows.reduce((total,row)=>total+Number(row.gps_km||0),0).toFixed(1)}
    ];
    const data=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${worksheet("Flights",flightColumns,rows)}${worksheet("FSTD",fstdColumns,fstdRows)}${worksheet("Summary",["metric","value"],summary)}${worksheet("Aircraft",["registration","flights","landings"],aircraftSummary)}${worksheet("Routes",["departure","arrival","flights","landings"],routeSummary)}${worksheet("Airports",["airport","movements"],airportSummary)}</Workbook>`;
    return new Response(data,{headers:{"content-type":"application/vnd.ms-excel; charset=utf-8","content-disposition":`attachment; filename=logbook-${stamp}.xls`,"cache-control":"private, no-store"}});
  }

  const csv='\ufeff'+flightColumns.join(';')+'\n'+rows.map(row=>flightColumns.map(column=>esc(row[column])).join(';')).join('\n');
  return new Response(csv,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename=logbook-${stamp}.csv`,"cache-control":"private, no-store"}});
}
