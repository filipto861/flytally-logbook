/**
 * Bounded GPS V2 ORIGINAL FILE -> canonical import index comparison inputs.
 * This independently validates a deliberately small, explicit subset of
 * existing GPS import formats. It does NOT authenticate instruments, source
 * device, accuracy, altitude mode/datum or runway contact.
 *
 * Unsupported/ambiguous XML or CSV must leave V2 unavailable while the legacy
 * import continues to work. Never silently discard malformed source fixes.
 */
import {
  CSV_LINEAGE_PARSER_REVISION,
  examineStrictCsvSourceLineage,
} from "./gps-v2-source-lineage.ts";

export const GPS_V2_IMPORT_LINEAGE_REVISION="GPS_V2_IMPORT_LINEAGE_V2" as const;
export type GpsV2LineageKind="STRICT_CSV"|"SKYDEMON_CSV"|"GPX_TRACK"|"KML_GX_TRACK";
export type GpsV2LineagePoint={lat:number;lon:number;altM:number|null;utc:string};
export type GpsV2ImportLineage=
  | {status:"UNAVAILABLE";reason:"UNSUPPORTED_SOURCE"|"SOURCE_UNAVAILABLE"}
  | {
    status:"SOURCE_PARSED_DIAGNOSTIC_ONLY";
    kind:GpsV2LineageKind;
    parserRevision:typeof CSV_LINEAGE_PARSER_REVISION|typeof GPS_V2_IMPORT_LINEAGE_REVISION;
    samples:readonly GpsV2LineagePoint[];
  };
const MAX_TEXT_LENGTH=2_000_000,MAX_POINTS=25_000;
const unavailable=(reason:"UNSUPPORTED_SOURCE"|"SOURCE_UNAVAILABLE"):GpsV2ImportLineage=>({status:"UNAVAILABLE",reason});
const numberToken=(text:string):number|null=>{
  if(!/^-?\d+(?:\.\d+)?$/.test(text))return null;
  const value=Number(text);
  return Number.isFinite(value)?value:null;
};
const utcMillis=(text:string,extendedPrecision=false):number|null=>{
  // SkyDemon gx:Track UTC can preserve sub-millisecond precision. Keep the
  // ORIGINAL UTC string verbatim; Date.parse is only a coarse ordering clock.
  // Never infer timezone or round coordinates/timestamps into distinct fixes.
  const fraction=extendedPrecision?"{1,32}":"{1,3}";
  if(!new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d${fraction})?Z$`).test(text))return null;
  const n=Date.parse(text);
  if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,19)!==text.slice(0,19))return null;
  return n;
};
type Observed={point:GpsV2LineagePoint;ms:number};
/** Strong source-order requirement. Sorting preserves only known one-to-one fixes. */
function finalized(kind:GpsV2LineageKind,rows:Observed[],gxTrack=false):GpsV2ImportLineage{
  if(rows.length<2||rows.length>MAX_POINTS)return unavailable("SOURCE_UNAVAILABLE");
  // Canonical KML normalization discards only *adjacent* same-time near-identical
  // fixes BEFORE stable timestamp ordering. Do not silently discard distinct
  // positions sharing a timestamp; they are retained as a discontinuity.
  const normalized:Observed[]=[];
  for(const row of rows){
    const prev=normalized.at(-1);
    if(gxTrack&&prev&&prev.point.utc===row.point.utc&&
      Math.abs(prev.point.lat-row.point.lat)<1e-7&&
      Math.abs(prev.point.lon-row.point.lon)<1e-7){
      // The legacy parser ignores height when deduplicating. If it differed,
      // refusing the entire V2 source is safer than hiding conflicting data.
      if(prev.point.altM!==row.point.altM)return unavailable("SOURCE_UNAVAILABLE");
      continue;
    }
    normalized.push(row);
  }
  if(normalized.length<2)return unavailable("SOURCE_UNAVAILABLE");
  const sorted=[...normalized].sort((a,b)=>a.ms-b.ms);
  // Retain identical times at differing positions ONLY in KML: V2 edge()
  // refuses dt<=0 and islands() cuts the motion evidence at that boundary.
  for(let i=1;i<sorted.length;i++)if(!gxTrack&&sorted[i].ms===sorted[i-1].ms)
    return unavailable("SOURCE_UNAVAILABLE");
  return {
    status:"SOURCE_PARSED_DIAGNOSTIC_ONLY",kind,
    parserRevision:GPS_V2_IMPORT_LINEAGE_REVISION,
    samples:sorted.map(item=>item.point)
  };
}

/** CSV tokenizer accepts quoted Note with embedded commas, never multiline. */
function cells(line:string):string[]|null{
  const result:string[]=[];
  let current="",quoted=false,closed=false,atFieldStart=true;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(quoted){
      if(ch==='"'&&line[i+1]==='"'){current+='"';i++;}
      else if(ch==='"'){quoted=false;closed=true;}
      else current+=ch;
    }else if(ch===","){
      result.push(current.trim());current="";closed=false;atFieldStart=true;
    }else if(ch==='"'&&atFieldStart){quoted=true;atFieldStart=false;}
    else if(ch==='"'||closed)return null;
    else{current+=ch;if(ch.trim())atFieldStart=false;}
  }
  if(quoted)return null;
  result.push(current.trim());
  return result;
}
const SKYDEMON_HEADER="Latitude,Longitude,Altitude ft,UTC Date,UTC Time,Note";
function skyDemonCsv(source:string):GpsV2ImportLineage{
  const lines=source.replace(/^\uFEFF/,"").split(/\r?\n/);
  if(lines.at(-1)==="")lines.pop();
  if(lines.length<3||lines.length-1>MAX_POINTS||lines[0]!==SKYDEMON_HEADER)
    return unavailable("UNSUPPORTED_SOURCE");
  const rows:Observed[]=[];
  for(let i=1;i<lines.length;i++){
    const row=cells(lines[i]);
    if(!row||row.length!==6)return unavailable("SOURCE_UNAVAILABLE");
    const lat=numberToken(row[0]),lon=numberToken(row[1]),rawAlt=row[2]===""?null:numberToken(row[2]);
    if(lat===null||lon===null||Math.abs(lat)>90||Math.abs(lon)>180||
      (row[2]!==""&&rawAlt===null))return unavailable("SOURCE_UNAVAILABLE");
    const utc=`${row[3]}T${row[4]}`,ms=utcMillis(utc);
    if(ms===null)return unavailable("SOURCE_UNAVAILABLE");
    const altM=rawAlt===null?null:rawAlt*0.3048;
    if(altM!==null&&!Number.isFinite(altM))return unavailable("SOURCE_UNAVAILABLE");
    rows.push({point:{lat,lon,altM,utc},ms});
  }
  return finalized("SKYDEMON_CSV",rows);
}
const singleTag=(body:string,tag:string):string|null=>{
  const open=new RegExp(`<(?:\\w+:)?${tag}\\b`,"gi");
  const all=[...body.matchAll(new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}\\s*>`,"gi"))];
  return [...body.matchAll(open)].length===1&&all.length===1?all[0][1].trim():null;
};
function gpxTrack(source:string):GpsV2ImportLineage{
  if(!/<(?:\w+:)?gpx\b/i.test(source)||!/<\/(?:\w+:)?gpx\s*>/i.test(source)||
    /<(?:\w+:)?rtept\b/i.test(source))return unavailable("UNSUPPORTED_SOURCE");
  // Multiple trkseg blocks can imply a true recording discontinuity; do not
  // invent an edge across segments before an explicit segmentation contract.
  if([...source.matchAll(/<(?:\w+:)?trkseg\b/gi)].length!==1)
    return unavailable("UNSUPPORTED_SOURCE");
  const matches=[...source.matchAll(/<(?:\w+:)?trkpt\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?trkpt\s*>/gi)];
  if(matches.length<2||matches.length>MAX_POINTS||
    [...source.matchAll(/<(?:\w+:)?trkpt\b/gi)].length!==matches.length)
    return unavailable("SOURCE_UNAVAILABLE");
  const rows:Observed[]=[];
  for(const match of matches){
    const attrs=match[1],body=match[2];
    const latText=attrs.match(/\blat=["']([^"']+)["']/i)?.[1],lonText=attrs.match(/\blon=["']([^"']+)["']/i)?.[1];
    const lat=numberToken(latText??""),lon=numberToken(lonText??"");
    if(lat===null||lon===null||Math.abs(lat)>90||Math.abs(lon)>180)return unavailable("SOURCE_UNAVAILABLE");
    const utc=singleTag(body,"time"),ms=utc===null?null:utcMillis(utc);
    if(ms===null)return unavailable("SOURCE_UNAVAILABLE");
    const hasAltitude=/<(?:\w+:)?ele\b/i.test(body);
    const rawAlt=hasAltitude?singleTag(body,"ele"):null;
    if(hasAltitude&&rawAlt===null)return unavailable("SOURCE_UNAVAILABLE");
    const altM=rawAlt===null?null:numberToken(rawAlt);
    if(rawAlt!==null&&altM===null)return unavailable("SOURCE_UNAVAILABLE");
    rows.push({point:{lat,lon,altM,utc:utc!},ms});
  }
  return finalized("GPX_TRACK",rows);
}
function kmlGxTrack(source:string):GpsV2ImportLineage{
  if(!/<(?:\w+:)?kml\b/i.test(source)||!/<\/(?:\w+:)?kml\s*>/i.test(source))
    return unavailable("UNSUPPORTED_SOURCE");
  const tracks=[...source.matchAll(/<gx:Track\b[^>]*>([\s\S]*?)<\/gx:Track\s*>/gi)];
  if(tracks.length!==1||[...source.matchAll(/<gx:Track\b/gi)].length!==1)
    return unavailable("UNSUPPORTED_SOURCE");
  const body=tracks[0][1];
  const times=[...body.matchAll(/<(?:\w+:)?when\b[^>]*>([\s\S]*?)<\/(?:\w+:)?when\s*>/gi)];
  const coords=[...body.matchAll(/<gx:coord\b[^>]*>([\s\S]*?)<\/gx:coord\s*>/gi)];
  if(times.length<2||times.length!==coords.length||times.length>MAX_POINTS||
    [...body.matchAll(/<(?:\w+:)?when\b/gi)].length!==times.length||
    [...body.matchAll(/<gx:coord\b/gi)].length!==coords.length)
    return unavailable("SOURCE_UNAVAILABLE");
  const rows:Observed[]=[];
  for(let i=0;i<times.length;i++){
    const utc=times[i][1].trim(),ms=utcMillis(utc,true);
    const tokens=coords[i][1].trim().split(/\s+/);
    if(ms===null||tokens.length<2||tokens.length>3)return unavailable("SOURCE_UNAVAILABLE");
    const lon=numberToken(tokens[0]),lat=numberToken(tokens[1]);
    const altM=tokens.length===3?numberToken(tokens[2]):null;
    if(lat===null||lon===null||Math.abs(lat)>90||Math.abs(lon)>180||
      (tokens.length===3&&altM===null))return unavailable("SOURCE_UNAVAILABLE");
    rows.push({point:{lat,lon,altM,utc},ms});
  }
  return finalized("KML_GX_TRACK",rows,true);
}
/** Entire source shape checked before comparison with the canonical importer. */
export function inspectGpsV2SourceLineage(source:unknown,fileName:unknown):GpsV2ImportLineage{
  if(typeof source!=="string"||typeof fileName!=="string"||
    !source||source.length>MAX_TEXT_LENGTH)return unavailable("SOURCE_UNAVAILABLE");
  const lower=fileName.toLowerCase();
  if(lower.endsWith(".csv")){
    const strict=examineStrictCsvSourceLineage(source);
    if(strict.status==="SOURCE_PARSED_DIAGNOSTIC_ONLY")
      return {
        status:"SOURCE_PARSED_DIAGNOSTIC_ONLY",kind:"STRICT_CSV",
        parserRevision:CSV_LINEAGE_PARSER_REVISION,
        samples:strict.samples.map(p=>({lat:p.lat,lon:p.lon,altM:p.altM,utc:p.utc}))
      };
    return source.replace(/^\uFEFF/,"").startsWith(SKYDEMON_HEADER+"\n")||
      source.replace(/^\uFEFF/,"").startsWith(SKYDEMON_HEADER+"\r\n")
      ?skyDemonCsv(source):unavailable("SOURCE_UNAVAILABLE");
  }
  if(lower.endsWith(".gpx"))return gpxTrack(source);
  if(lower.endsWith(".kml"))return kmlGxTrack(source);
  return unavailable("UNSUPPORTED_SOURCE");
}
