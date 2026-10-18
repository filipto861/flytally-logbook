/**
 * Stage D4.1 — research-only KML source -> canonical provenance sidecar.
 *
 * NOT a V2 parser feature enablement. Does not feed an event detector, touch
 * flight records, infer physical contact, or establish sensor accuracy.
 * Result contains SOURCE ORDINALS only: never route, raw UTC or GPS height.
 */
import {parseKml, type KmlPoint} from "../../lib/track-processing.ts";

export const D4_LINEAGE_REVISION = "GPS_D4_MULTI_GX_SIDECAR_V1" as const;
const MAX_SOURCE_CHARS = 2_000_000;
const MAX_SOURCE_FIXES = 25_000;

export type D4SourceRef = Readonly<{blockOrdinal:number;fixOrdinal:number}>;
export type D4CanonicalProvenance = Readonly<{
  canonicalIndex:number;
  retained:D4SourceRef;
  collapsed:readonly D4SourceRef[];
  altitudeConflict:boolean;
}>;
export type D4BlockedReason =
  "SOURCE_BLOCK_BOUNDARY" | "CROSS_BLOCK_DEDUP" |
  "ALTITUDE_CONFLICT" | "TIMESTAMP_COLLISION";
export type D4LineageResult =
  | Readonly<{
      revision:typeof D4_LINEAGE_REVISION;
      status:"UNAVAILABLE";
      reason:"UNSUPPORTED_SOURCE"|"MALFORMED_SOURCE"|"SOURCE_ORDER_UNAVAILABLE"|
        "CANONICAL_SOURCE_MISMATCH"|"SOURCE_LIMIT";
      canAffectCanonicalFlight:false;
      physicalContact:"UNRESOLVED";
      actualLandings:"UNAVAILABLE";
      canonical:null;
      blockedEdges:null;
      blockedEdgeReasons:null;
      continuousIslands:null;
    }>
  | Readonly<{
      revision:typeof D4_LINEAGE_REVISION;
      status:"SOURCE_PARSED_DIAGNOSTIC_ONLY";
      reason:null;
      canAffectCanonicalFlight:false;
      physicalContact:"UNRESOLVED";
      actualLandings:"UNAVAILABLE";
      blockCount:number;
      canonicalFixCount:number;
      rawFixCount:number;
      canonical:readonly D4CanonicalProvenance[];
      /** Edge i means canonical[i] -> canonical[i+1] is NOT motion evidence. */
      blockedEdges:readonly number[];
      blockedEdgeReasons:readonly Readonly<{
        leftCanonicalIndex:number;reasons:readonly D4BlockedReason[];
      }>[];
      /** Closed fix-index ranges; single-fix ranges have NO velocity evidence. */
      continuousIslands:readonly Readonly<{first:number;last:number}>[];
    }>;

type Raw = {
  point:KmlPoint;
  source:D4SourceRef;
  collapsed:D4SourceRef[];
  altitudeConflict:boolean;
};
type RawBlock={content:string;ordinal:number};

function unavailable(reason:Extract<D4LineageResult,{status:"UNAVAILABLE"}>["reason"]):D4LineageResult {
  return {
    revision:D4_LINEAGE_REVISION,status:"UNAVAILABLE",reason,
    canAffectCanonicalFlight:false,physicalContact:"UNRESOLVED",
    actualLandings:"UNAVAILABLE",
    canonical:null,blockedEdges:null,blockedEdgeReasons:null,continuousIslands:null,
  };
}
function numeric(value:string):number|null {
  if(!/^-?\d+(?:\.\d+)?$/.test(value))return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}
function utcMs(value:string):number|null {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,32})?Z$/.test(value))
    return null;
  const n=Date.parse(value);
  if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,19)!==value.slice(0,19))
    return null;
  return n;
}
function duplicate(a:KmlPoint,b:KmlPoint):boolean {
  // Exactly the effective legacy pushUnique rule, including the lack of
  // altitude comparison. Never modify canonical normalization as a side effect.
  return Math.abs(a.lat-b.lat)<1e-7&&Math.abs(a.lon-b.lon)<1e-7&&
    (a.time??null)===(b.time??null);
}
function equals(a:KmlPoint,b:KmlPoint):boolean {
  return a.lat===b.lat&&a.lon===b.lon&&a.alt===b.alt&&a.time===b.time;
}

/**
 * A caller-supplied canonical array is NOT trusted as evidence: we always
 * recompute canonical points through the current production parser and require
 * exact equality before assigning source indices. No raw source is returned.
 */
export function inspectD4MultiGxLineage(
  sourceText:unknown, suppliedCanonical?:readonly KmlPoint[],
):D4LineageResult {
  if(typeof sourceText!=="string"||!sourceText||
    sourceText.length>MAX_SOURCE_CHARS)return unavailable("SOURCE_LIMIT");
  if(!/<(?:\w+:)?kml\b/i.test(sourceText)||
    !/<\/(?:\w+:)?kml\s*>/i.test(sourceText))return unavailable("UNSUPPORTED_SOURCE");
  const bodies=[...sourceText.matchAll(/<gx:Track\b[^>]*>([\s\S]*?)<\/gx:Track\s*>/gi)];
  const opens=[...sourceText.matchAll(/<gx:Track\b/gi)].length;
  const closes=[...sourceText.matchAll(/<\/gx:Track\s*>/gi)].length;
  // No native production parser changes: reject unsupported generic Track
  // forms that the canonical parser might also consume.
  const allOpens=[...sourceText.matchAll(/<(?:\w+:)?Track\b/gi)].length;
  if(!opens||opens!==closes||opens!==bodies.length||allOpens!==opens)
    return unavailable("UNSUPPORTED_SOURCE");
  const blocks:RawBlock[]=bodies.map((b,ordinal)=>({content:b[1],ordinal}));
  const all:Raw[]=[];
  let count=0;
  for(const block of blocks) {
    const when=[...block.content.matchAll(/<(?:\w+:)?when\b[^>]*>([\s\S]*?)<\/(?:\w+:)?when\s*>/gi)];
    const coord=[...block.content.matchAll(/<gx:coord\b[^>]*>([\s\S]*?)<\/gx:coord\s*>/gi)];
    if(!when.length||when.length!==coord.length||
      [...block.content.matchAll(/<(?:\w+:)?when\b/gi)].length!==when.length||
      [...block.content.matchAll(/<gx:coord\b/gi)].length!==coord.length||
      [...block.content.matchAll(/<\/gx:coord\s*>/gi)].length!==coord.length||
      [...block.content.matchAll(/<\/(?:\w+:)?when\s*>/gi)].length!==when.length)
      return unavailable("MALFORMED_SOURCE");
    count+=when.length;
    if(count>MAX_SOURCE_FIXES)return unavailable("SOURCE_LIMIT");
    for(let i=0;i<when.length;i++){
      const time=when[i][1].trim(),ms=utcMs(time);
      const tokens=coord[i][1].trim().split(/\s+/);
      if(ms===null||tokens.length<2||tokens.length>3)
        return unavailable("MALFORMED_SOURCE");
      const lon=numeric(tokens[0]),lat=numeric(tokens[1]);
      const alt=tokens.length===3?numeric(tokens[2]):null;
      if(lon===null||lat===null||Math.abs(lon)>180||Math.abs(lat)>90||
        (tokens.length===3&&alt===null))return unavailable("MALFORMED_SOURCE");
      const raw:Raw={
        point:{lat,lon,alt,time},
        source:{blockOrdinal:block.ordinal,fixOrdinal:i},
        collapsed:[],altitudeConflict:false,
      };
      all.push(raw);
    }
  }
  // The legacy importer discards adjacent same-UTC/near-position fixes before
  // sorting, across block boundaries too. Keep ALL discarded source refs.
  const normalized:Raw[]=[];
  for(const row of all){
    const prev=normalized.at(-1);
    if(prev&&duplicate(prev.point,row.point)){
      prev.collapsed.push(row.source);
      if(prev.point.alt!==row.point.alt)prev.altitudeConflict=true;
    }else normalized.push(row);
  }
  if(normalized.length<2)return unavailable("MALFORMED_SOURCE");

  // Never repair an ordering inversion into artificial segment continuity.
  for(let i=1;i<normalized.length;i++){
    const t0=utcMs(normalized[i-1].point.time!);
    const t1=utcMs(normalized[i].point.time!);
    if(t0===null||t1===null||t1<t0)
      return unavailable("SOURCE_ORDER_UNAVAILABLE");
  }
  // Stable chronological ordering should be a no-op after the source-order
  // requirement; still compare against the ACTUAL canonical importer.
  const actual=parseKml(sourceText);
  if(actual.length!==normalized.length ||
    actual.some((point,i)=>!equals(point,normalized[i].point)))
    return unavailable("CANONICAL_SOURCE_MISMATCH");
  if(suppliedCanonical && (suppliedCanonical.length!==actual.length||
    suppliedCanonical.some((p,i)=>!equals(p,actual[i]))))
    return unavailable("CANONICAL_SOURCE_MISMATCH");

  const reasons=new Map<number,Set<D4BlockedReason>>();
  const block=(edge:number,reason:D4BlockedReason)=>{
    if(edge<0||edge>=normalized.length-1)return;
    const set=reasons.get(edge)??new Set<D4BlockedReason>();
    set.add(reason);
    reasons.set(edge,set);
  };
  for(let i=0;i<normalized.length;i++){
    const item=normalized[i];
    if(i>0&&normalized[i-1].source.blockOrdinal!==item.source.blockOrdinal)
      block(i-1,"SOURCE_BLOCK_BOUNDARY");
    // A cross-block duplicate may have removed the explicit boundary. Protect
    // both edges neighboring the merged canonical fix; no hidden motion bridge.
    if(item.collapsed.some(ref=>ref.blockOrdinal!==item.source.blockOrdinal)){
      block(i-1,"CROSS_BLOCK_DEDUP");
      block(i,"CROSS_BLOCK_DEDUP");
    }
    if(item.altitudeConflict){
      block(i-1,"ALTITUDE_CONFLICT");
      block(i,"ALTITUDE_CONFLICT");
    }
    if(i>0&&utcMs(normalized[i-1].point.time!)===utcMs(item.point.time!)){
      block(i-2,"TIMESTAMP_COLLISION");
      block(i-1,"TIMESTAMP_COLLISION");
      block(i,"TIMESTAMP_COLLISION");
    }
  }
  const blockedEdges=[...reasons.keys()].sort((a,b)=>a-b);
  const continuousIslands:{first:number;last:number}[]=[];
  let start=0;
  for(const edge of blockedEdges){
    continuousIslands.push({first:start,last:edge});
    start=edge+1;
  }
  continuousIslands.push({first:start,last:normalized.length-1});
  return {
    revision:D4_LINEAGE_REVISION,status:"SOURCE_PARSED_DIAGNOSTIC_ONLY",
    reason:null,canAffectCanonicalFlight:false,physicalContact:"UNRESOLVED",
    actualLandings:"UNAVAILABLE",blockCount:blocks.length,rawFixCount:count,
    canonicalFixCount:normalized.length,
    canonical:normalized.map((row,i)=>({
      canonicalIndex:i,retained:row.source,collapsed:row.collapsed,
      altitudeConflict:row.altitudeConflict,
    })),
    blockedEdges,
    blockedEdgeReasons:blockedEdges.map(leftCanonicalIndex=>({
      leftCanonicalIndex,reasons:[...reasons.get(leftCanonicalIndex)!].sort(),
    })),
    continuousIslands,
  };
}
