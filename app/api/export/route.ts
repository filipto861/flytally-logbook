import { getSession } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { buildAccountBackup } from "@/lib/account-backup";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { logbookScopeIncludesFstd,normalizeLogbookOutputCategory,normalizeLogbookPrintScope } from "@/lib/logbook-print";
import { normalizeOutputDateRange,outputRangeFileToken } from "@/lib/output-range";

export const dynamic="force-dynamic";

const clean=(value:unknown)=>{const text=String(value??"").trim();return ["nan","null","undefined"].includes(text.toLowerCase())?"":text};
const esc=(value:unknown)=>`"${clean(value).replaceAll('"','""')}"`;
const xml=(value:unknown)=>clean(value).replace(/[<>&'\"]/g,char=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"}[char]!));
const hm=(value:unknown)=>{const total=Math.max(0,Math.round(Number(value)||0));return`${Math.floor(total/60)}:${String(total%60).padStart(2,"0")}`};
const durationMinutes=(value:unknown)=>{const parts=clean(value).split(":").map(Number);return parts.length===2&&parts.every(Number.isFinite)?Math.max(0,(parts[0]||0)*60+(parts[1]||0)):0};

const flightColumns=[
  "date","evidence","regulatory_category","registration","aircraft_make","aircraft_model","aircraft_variant","aircraft_type","aircraft_class","operation_type","engine_type",
  "departure","arrival","off_block","takeoff","landing","on_block","block_time","air_time","logged_time",
  "launch_method","launches","takeoffs_day","takeoffs_night","landings_day","landings_night","balloon_class","balloon_group","balloon_operation","night_minutes","ifr_minutes",
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

  const url=new URL(request.url),format=(url.searchParams.get("format")||"csv").toLowerCase();
  if(!["csv","xls","json"].includes(format))return new Response("Unsupported export format.",{status:400,headers:{"content-type":"text/plain; charset=utf-8"}});
  const stamp=new Date().toISOString().slice(0,10);

  if(format==="json"){
    const {json}=await buildAccountBackup(session.userId);
    return new Response(json,{headers:{"content-type":"application/json; charset=utf-8","content-disposition":`attachment; filename=flytally-backup-${stamp}.json`,"cache-control":"private, no-store"}});
  }

  const range=normalizeOutputDateRange(url.searchParams.get("from"),url.searchParams.get("to"));
  if(range.error)return new Response(range.error,{status:400,headers:{"content-type":"text/plain; charset=utf-8","cache-control":"private, no-store"}});
  const legacyEvidence=clean(url.searchParams.get("evidence")).toUpperCase(),requestedScope=url.searchParams.has("scope")?url.searchParams.get("scope"):(legacyEvidence==="ULL"?"ull":legacyEvidence==="EASA"?"easa":"all"),scope=normalizeLogbookPrintScope(requestedScope),category=normalizeLogbookOutputCategory(url.searchParams.get("category")),includeFstd=logbookScopeIncludesFstd(scope)&&category==="all",registration=url.searchParams.get("registration")?.trim().toUpperCase()||null,auxiliary=url.searchParams.get("auxiliary")==="include"?"include":"exclude",from=range.from,to=range.to;

  const rawRows=await sql`
    WITH t AS (
      SELECT flight_id,COUNT(*)::int track_count,COALESCE(SUM(distance_km),0) gps_km
      FROM flight_tracks WHERE user_id=${session.userId} GROUP BY flight_id
    ),base0 AS MATERIALIZED(
      SELECT f.date,f.evidence,
        CASE
          WHEN UPPER(TRIM(COALESCE(f.regulatory_category,''))) IN ('AEROPLANE','HELICOPTER','BALLOON','SAILPLANE','ULL','OTHER') THEN UPPER(TRIM(COALESCE(f.regulatory_category,'')))
          WHEN UPPER(TRIM(COALESCE(f.aircraft_class,'')))='ULL' OR UPPER(TRIM(COALESCE(f.evidence,'')))='ULL' THEN 'ULL'
          WHEN UPPER(TRIM(COALESCE(f.aircraft_class,'')))='GLIDER' THEN 'SAILPLANE'
          WHEN UPPER(TRIM(COALESCE(f.aircraft_class,'')))='HELICOPTER' THEN 'HELICOPTER'
          WHEN UPPER(TRIM(COALESCE(f.aircraft_class,'')))='BALLOON' THEN 'BALLOON'
          WHEN UPPER(TRIM(COALESCE(f.aircraft_class,''))) IN ('SEP','TMG','MEP','SET') THEN 'AEROPLANE'
          ELSE 'OTHER' END regulatory_category,
        f.registration,f.aircraft_make,f.aircraft_model,f.aircraft_variant,f.aircraft_type,f.aircraft_class,f.operation_type,f.engine_type,
        f.departure,f.arrival,f.off_block,f.takeoff,f.landing,f.on_block,
        CASE WHEN f.off_block~'^([01][0-9]|2[0-3]):[0-5][0-9]$' AND f.on_block~'^([01][0-9]|2[0-3]):[0-5][0-9]$'
          THEN MOD((split_part(f.on_block,':',1)::int*60+split_part(f.on_block,':',2)::int)-(split_part(f.off_block,':',1)::int*60+split_part(f.off_block,':',2)::int)+1440,1440) ELSE 0 END::int block_minutes,
        CASE WHEN f.takeoff~'^([01][0-9]|2[0-3]):[0-5][0-9]$' AND f.landing~'^([01][0-9]|2[0-3]):[0-5][0-9]$'
          THEN MOD((split_part(f.landing,':',1)::int*60+split_part(f.landing,':',2)::int)-(split_part(f.takeoff,':',1)::int*60+split_part(f.takeoff,':',2)::int)+1440,1440) ELSE 0 END::int air_minutes,
        f.launch_method,f.launches,f.takeoffs_day,f.takeoffs_night,f.landings_day,f.landings_night,f.balloon_class,f.balloon_group,f.balloon_operation,
        f.night_minutes,f.ifr_minutes,f.role,f.pic_minutes,f.copilot_minutes,f.dual_minutes,f.instructor_minutes,f.commander,f.instructor,f.verification_name,f.verification_reference,f.task,f.note,
        f.certified_at,f.record_revision,f.correction_reason,f.price_per_hour,f.billing_basis,COALESCE(t.track_count,0) track_count,COALESCE(t.gps_km,0) gps_km
      FROM flights f LEFT JOIN t ON t.flight_id=f.id
      WHERE f.user_id=${session.userId}
    ),base AS MATERIALIZED(
      SELECT *,CASE WHEN regulatory_category IN ('SAILPLANE','BALLOON') THEN CASE WHEN air_minutes>0 THEN air_minutes ELSE block_minutes END ELSE block_minutes END::int logged_minutes
      FROM base0
    )
    SELECT * FROM base
    WHERE (${scope}='all' OR (${scope}='ull' AND UPPER(TRIM(evidence))='ULL') OR (${scope}='easa' AND UPPER(TRIM(evidence))='EASA') OR (${scope}='ull-easa' AND UPPER(TRIM(evidence)) IN ('ULL','EASA')))
      AND (${category}='all' OR regulatory_category=${category})
      AND (${from}::text IS NULL OR date::text>=${from}::text)
      AND (${to}::text IS NULL OR date::text<=${to}::text)
      AND (${registration}::text IS NULL OR UPPER(TRIM(registration))=${registration}::text)
      AND (${auxiliary}='include' OR UPPER(TRIM(COALESCE(role,''))) NOT IN ('SAFETY PILOT','PAX','OBSERVER'))
    ORDER BY date,off_block,registration
  ` as Array<Record<string,unknown>>;
  const rows:Array<Record<string,unknown>>=rawRows.map(row=>{const {block_minutes,air_minutes,logged_minutes,...rest}=row;return{...rest,block_time:hm(block_minutes),air_time:hm(air_minutes),logged_time:hm(logged_minutes)}});

  const fileBase=`flytally-logbook-${scope}-${outputRangeFileToken(range)}`;
  if(format==="xls"){
    const fstdRaw=await sql`
      SELECT session_date::text session_date,device_type,qualification_number,instruction,total_minutes,remarks,certified_at,record_revision,correction_reason
      FROM fstd_sessions
      WHERE user_id=${session.userId} AND ${includeFstd}::boolean
        AND (${from}::text IS NULL OR session_date::text>=${from}::text)
        AND (${to}::text IS NULL OR session_date::text<=${to}::text)
      ORDER BY session_date,id
    ` as Array<Record<string,unknown>>;
    let accumulatedFstd=0;
    const fstdRows=fstdRaw.map(row=>{const minutes=Math.max(0,Math.round(Number(row.total_minutes)||0));accumulatedFstd+=minutes;return{...row,total_time:hm(minutes),accumulated_time:hm(accumulatedFstd)}});

    const summarize=(key:(row:Record<string,unknown>)=>string)=>{const map=new Map<string,{flights:number;landings:number}>();for(const row of rows){const itemKey=key(row)||"—",value=map.get(itemKey)??{flights:0,landings:0};value.flights++;value.landings+=Number(row.landings_day||0)+Number(row.landings_night||0);map.set(itemKey,value)}return[...map].map(([name,value])=>({name,...value})).sort((a,b)=>b.flights-a.flights)};
    const aircraftSummary=summarize(row=>clean(row.registration)||"—").map(row=>({registration:row.name,flights:row.flights,landings:row.landings}));
    const routeSummary=summarize(row=>`${clean(row.departure)||"—"}→${clean(row.arrival)||"—"}`).map(row=>{const [departure,arrival]=row.name.split("→");return{departure,arrival,flights:row.flights,landings:row.landings}});
    const airportCounts=new Map<string,number>();for(const row of rows)for(const airport of [row.departure,row.arrival]){const key=clean(airport);if(key)airportCounts.set(key,(airportCounts.get(key)||0)+1)}
    const airportSummary=[...airportCounts].map(([airport,movements])=>({airport,movements})).sort((a,b)=>b.movements-a.movements);
    const categoryMap=new Map<string,{flights:number;minutes:number}>();for(const row of rows){const key=clean(row.regulatory_category)||"OTHER",value=categoryMap.get(key)??{flights:0,minutes:0};value.flights++;value.minutes+=durationMinutes(row.logged_time);categoryMap.set(key,value)}
    const categorySummary=[...categoryMap].map(([regulatory_category,value])=>({regulatory_category,flights:value.flights,logged_time:hm(value.minutes)})).sort((a,b)=>b.flights-a.flights||a.regulatory_category.localeCompare(b.regulatory_category));
    const totalLoggedMinutes=rows.reduce((total,row)=>total+durationMinutes(row.logged_time),0),totalBlockMinutes=rows.reduce((total,row)=>total+durationMinutes(row.block_time),0),totalAirMinutes=rows.reduce((total,row)=>total+durationMinutes(row.air_time),0),summary=[
      {metric:"Flights",value:rows.length},
      {metric:"Logged time",value:hm(totalLoggedMinutes)},
      {metric:"BLOCK",value:hm(totalBlockMinutes)},
      {metric:"AIR",value:hm(totalAirMinutes)},
      {metric:"Landings",value:rows.reduce((total,row)=>total+Number(row.landings_day||0)+Number(row.landings_night||0),0)},
      {metric:"FSTD",value:hm(accumulatedFstd)},
      {metric:"GPS km",value:rows.reduce((total,row)=>total+Number(row.gps_km||0),0).toFixed(1)}
    ];
    const data=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${worksheet("Flights",flightColumns,rows)}${worksheet("FSTD",fstdColumns,fstdRows)}${worksheet("Summary",["metric","value"],summary)}${worksheet("Categories",["regulatory_category","flights","logged_time"],categorySummary)}${worksheet("Aircraft",["registration","flights","landings"],aircraftSummary)}${worksheet("Routes",["departure","arrival","flights","landings"],routeSummary)}${worksheet("Airports",["airport","movements"],airportSummary)}</Workbook>`;
    return new Response(data,{headers:{"content-type":"application/vnd.ms-excel; charset=utf-8","content-disposition":`attachment; filename=${fileBase}.xls`,"cache-control":"private, no-store"}});
  }

  const csv='\ufeff'+flightColumns.join(';')+'\n'+rows.map(row=>flightColumns.map(column=>esc(row[column])).join(';')).join('\n');
  return new Response(csv,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename=${fileBase}.csv`,"cache-control":"private, no-store"}});
}
