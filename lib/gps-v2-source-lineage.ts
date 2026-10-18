/** Production-preview GPS V2 source syntax / normalized index gate.
 * This is a conservative standalone strict CSV subset copied from the exact
 * owner-tested R21 D2-B2 research source as of main@0fb33a88.
 * Its parser revision describes syntax and transform only, NOT accuracy,
 * sensor origin, actual AGL/MSL or aircraft ground contact.
 * Keep research and runtime parity under direct tests.
 */
export const CSV_LINEAGE_PARSER_REVISION="R21_D2B2_CSV_SUBSET_V1" as const;
export type CsvLineageFailure=
  "UNSUPPORTED_CSV_DIALECT"|"INVALID_SOURCE_SHAPE"|"INVALID_POSITION"|
  "INVALID_ALTITUDE"|"INVALID_UTC"|"DUPLICATE_TIMESTAMP"|"LIMIT_EXCEEDED";
export type CsvLineagePoint={
  sourceLine:number;
  normalizedIndex:number;
  lat:number;
  lon:number;
  altM:number|null;
  utc:string;
  altitudeInput:"MISSING"|"DECLARED_METRIC"|"CONVERTED_FEET_HEADER";
};
export type CsvLineageReport={
  status:"SOURCE_PARSED_DIAGNOSTIC_ONLY";
  parserRevision:typeof CSV_LINEAGE_PARSER_REVISION;
  sourceUnit:"m"|"ft";
  conversion:"NONE"|"SOURCE_HEADER_FT_TO_M_EXACT_0_3048";
  reorder:"UNCHANGED"|"SORTED_BY_EXPLICIT_UTC";
  droppedSourceLines:0;
  /** Indices identify lines within this one exact string, not persistent track IDs. */
  samples:CsvLineagePoint[];
  sourceClaims:{
    unitSemantics:"HEADER_DECLARATION_ONLY";
    altitudeMode:"UNKNOWN";
    verticalDatum:"UNKNOWN";
    sensorAccuracy:"UNKNOWN";
    originalSensorIdentity:"UNKNOWN";
  };
  pilot:{
    status:"UNAVAILABLE";
    physicalContact:"UNRESOLVED";
    wholeFlightLandings:"UNAVAILABLE";
    canAffectCanonicalFlight:false;
  };
};
export type CsvLineageResult=
  | {status:"UNAVAILABLE";reason:CsvLineageFailure}
  | CsvLineageReport;

const unavailable=(reason:CsvLineageFailure):CsvLineageResult=>({status:"UNAVAILABLE",reason});
const numberToken=(text:string):number|null=>{
  if(!/^-?(?:[0-9]+)(?:\.[0-9]+)?$/.test(text))return null;
  const n=Number(text);
  return Number.isFinite(n)?n:null;
};
const verifiedUtc=(text:string):number|null=>{
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(text))return null;
  const n=Date.parse(text);
  return Number.isFinite(n)&&new Date(n).toISOString().replace(".000Z","Z")===text?n:null;
};

/** Fixed four-column CSV subset; strictly reject syntax we cannot map.
 * This parser does not claim parity with lib/track-processing.ts.
 * A source header is NOT independent evidence about actual instrument units.
 */
export function examineStrictCsvSourceLineage(source:unknown):CsvLineageResult{
  if(typeof source!=="string")return unavailable("INVALID_SOURCE_SHAPE");
  if(source.length>120_000)return unavailable("LIMIT_EXCEEDED");
  if(source.includes("\r")||source.includes('"')||source.includes(";")||
    source.includes("\t")||source.startsWith("\uFEFF"))return unavailable("UNSUPPORTED_CSV_DIALECT");
  const text=source.endsWith("\n")?source.slice(0,-1):source;
  const lines=text.split("\n");
  if(lines.length<3||lines.length>5_001)return unavailable("INVALID_SOURCE_SHAPE");
  const header=lines[0];
  if(header!=="lat,lon,altitudeM,time"&&header!=="lat,lon,altitudeFt,time")
    return unavailable("UNSUPPORTED_CSV_DIALECT");
  const feet=header==="lat,lon,altitudeFt,time";
  const rows:Array<{sourceLine:number;lat:number;lon:number;altM:number|null;utc:string;ms:number;altitudeInput:CsvLineagePoint["altitudeInput"]}>=[];
  for(let i=1;i<lines.length;i++){
    const cells=lines[i].split(",");
    if(cells.length!==4)return unavailable("INVALID_SOURCE_SHAPE");
    const [latText,lonText,altText,utc]=cells;
    const lat=numberToken(latText),lon=numberToken(lonText);
    if(lat===null||lon===null||Math.abs(lat)>90||Math.abs(lon)>180)
      return unavailable("INVALID_POSITION");
    const alt=altText===""?null:numberToken(altText);
    if(altText!==""&&alt===null)return unavailable("INVALID_ALTITUDE");
    const ms=verifiedUtc(utc);
    if(ms===null)return unavailable("INVALID_UTC");
    const altM=alt===null?null:(feet?alt*0.3048:alt);
    if(altM!==null&&!Number.isFinite(altM))return unavailable("INVALID_ALTITUDE");
    rows.push({
      sourceLine:i+1,lat,lon,altM,utc,ms,
      altitudeInput:alt===null?"MISSING":feet?"CONVERTED_FEET_HEADER":"DECLARED_METRIC"
    });
  }
  const order=[...rows].sort((a,b)=>a.ms-b.ms);
  for(let i=1;i<order.length;i++)
    if(order[i].ms===order[i-1].ms)return unavailable("DUPLICATE_TIMESTAMP");
  const samples:CsvLineagePoint[]=order.map((r,index)=>({
    sourceLine:r.sourceLine,normalizedIndex:index,lat:r.lat,lon:r.lon,
    altM:r.altM,utc:r.utc,altitudeInput:r.altitudeInput
  }));
  return{
    status:"SOURCE_PARSED_DIAGNOSTIC_ONLY",
    parserRevision:CSV_LINEAGE_PARSER_REVISION,
    sourceUnit:feet?"ft":"m",
    conversion:feet?"SOURCE_HEADER_FT_TO_M_EXACT_0_3048":"NONE",
    reorder:order.every((r,i)=>r.sourceLine===i+2)?"UNCHANGED":"SORTED_BY_EXPLICIT_UTC",
    droppedSourceLines:0,
    samples,
    sourceClaims:{
      unitSemantics:"HEADER_DECLARATION_ONLY",
      altitudeMode:"UNKNOWN",verticalDatum:"UNKNOWN",
      sensorAccuracy:"UNKNOWN",originalSensorIdentity:"UNKNOWN"
    },
    pilot:{
      status:"UNAVAILABLE",physicalContact:"UNRESOLVED",
      wholeFlightLandings:"UNAVAILABLE",canAffectCanonicalFlight:false
    }
  };
}
