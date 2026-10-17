/** Offline R2.1a research only. No production imports, DB access or contact inference. */
export type Known<T> = {status:"KNOWN";value:T}|{status:"UNKNOWN"};
export type SourceMetadata = {
  altitudeMode:Known<"absolute"|"relativeToGround"|"clampToGround"|"other">;
  altitudeUnit:Known<"m"|"ft">;
  verticalDatum:Known<string>;
  horizontalAccuracyM:Known<number>;
  verticalAccuracyM:Known<number>;
  sourceFormat:Known<string>;
  generator:Known<string>;
  sensorOrigin:Known<string>;
  timestampPrecisionMs:Known<number>;
};
export type SourceObservation={lat:number;lon:number;alt:number|null;time:string|null;ordinal:number};
export type EdgeReason="MISSING_TIME"|"NON_MONOTONIC_TIME"|"BAD_COORDINATES"|"GAP"|"POSITION_JUMP"|"ALTITUDE_DISCONTINUITY";
export type QualityEdge={from:number;to:number;status:"VALID"|"UNAVAILABLE";reason:EdgeReason|null;dtSeconds:number|null;speedKmh:number|null;verticalRateMps:number|null};
export type SignalIsland={start:number;end:number};
export type EventType="T_G_PATTERN_CANDIDATE"|"STOP_GO_PATTERN_CANDIDATE";
/** Evidence about the nearby unusable GPS edge; not proof of physical contact. */
export type InvalidBoundaryEvidence={side:"BEFORE_ISLAND"|"AFTER_ISLAND";edge:{from:number;to:number};reason:EdgeReason};
export type PatternCandidate={type:EventType;index:number;support:{start:number;end:number};time:string|null;
/** Legacy field name: true for ANY nearby invalid edge, not only a temporal GAP. */
gapAdjacent:boolean;invalidBoundaryEvidence:InvalidBoundaryEvidence[];
physicalContactStatus:"UNRESOLVED";evidence:"ALTITUDE_REVERSAL"|"SPEED_DIP"};
export type AdvisoryPatternCount={kind:"PATTERN_ONLY";status:"AVAILABLE";scope:"OBSERVED_VALID_ISLANDS_ONLY";value:number}|{kind:"PATTERN_ONLY";status:"UNAVAILABLE";reason:"INSUFFICIENT_OBSERVATIONS"|"NO_VALID_SPAN"|"INVALID_SOURCE_METADATA"};
export type VerticalEvidenceReason=
  "SOURCE_METADATA_UNKNOWN"|"ALTITUDE_UNIT_UNKNOWN"|"ALTITUDE_MODE_UNKNOWN"|
  "FEET_NOT_CONVERTED"|"CLAMPED_ALTITUDE"|"UNSUPPORTED_ALTITUDE_MODE"|
  "MALFORMED_VERTICAL_ACCURACY"|"DECLARED_METRIC_RELATIVE_CHANGE_ONLY";
export type SourceQualityAssessment={
  vertical:{status:"UNVERIFIED"|"RELATIVE_CHANGE_ONLY"|"UNAVAILABLE";reason:VerticalEvidenceReason;datum:"UNKNOWN"|"DECLARED_NOT_VERIFIED"};
  horizontalAccuracy:{status:"UNKNOWN"|"DECLARED_NOT_VERIFIED"|"INVALID";declaredMeters:number|null};
  runwayProximity:"UNAVAILABLE";
};
export type ResearchAnalysis={edges:QualityEdge[];islands:SignalIsland[];candidates:PatternCandidate[];patternCount:AdvisoryPatternCount;sourceQuality:SourceQualityAssessment};

// Experimental, predeclared falsification parameters; these are NOT aircraft limitations.
export const R21_PARAMETERS=Object.freeze({gapSeconds:60,maxSpeedKmh:900,maxVerticalRateMps:25,altitudeReversalM:30,altitudeWindowSeconds:90,altitudeMinSpeedKmh:28,altitudeMaxSpeedKmh:145,mergeSeconds:40,lowSpeedKmh:20,fastSpeedKmh:45,speedWindowSeconds:60,minLowDurationSeconds:5});

const timestamp=(raw:string|null):number|null=>{
  if(!raw||!/(?:Z|[+-]\d{2}:\d{2})$/i.test(raw))return null;
  const t=Date.parse(raw);return Number.isFinite(t)?t:null;
};
const coordinatesOk=(p:SourceObservation)=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
const haversineKm=(a:SourceObservation,b:SourceObservation)=>{
  const rad=Math.PI/180,dy=(b.lat-a.lat)*rad,dx=(b.lon-a.lon)*rad;
  const v=Math.sin(dy/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dx/2)**2;
  return 12742.0176*Math.asin(Math.min(1,Math.sqrt(v)));
};
function edge(a:SourceObservation,b:SourceObservation,from:number):QualityEdge{
  const failed=(reason:EdgeReason,dtSeconds:number|null=null):QualityEdge=>({from,to:from+1,status:"UNAVAILABLE",reason,dtSeconds,speedKmh:null,verticalRateMps:null});
  if(!coordinatesOk(a)||!coordinatesOk(b))return failed("BAD_COORDINATES");
  const t0=timestamp(a.time),t1=timestamp(b.time);if(t0===null||t1===null)return failed("MISSING_TIME");
  const dtSeconds=(t1-t0)/1000;if(dtSeconds<=0)return failed("NON_MONOTONIC_TIME",dtSeconds);
  if(dtSeconds>=R21_PARAMETERS.gapSeconds)return failed("GAP",dtSeconds);
  const speedKmh=haversineKm(a,b)*3600/dtSeconds;
  if(speedKmh>R21_PARAMETERS.maxSpeedKmh)return failed("POSITION_JUMP",dtSeconds);
  let verticalRateMps:number|null=null;
  if(a.alt!==null&&b.alt!==null&&Number.isFinite(a.alt)&&Number.isFinite(b.alt)){
    verticalRateMps=(b.alt-a.alt)/dtSeconds;
    if(Math.abs(verticalRateMps)>R21_PARAMETERS.maxVerticalRateMps)return failed("ALTITUDE_DISCONTINUITY",dtSeconds);
  }
  return{from,to:from+1,status:"VALID",reason:null,dtSeconds,speedKmh,verticalRateMps};
}
const sampleSpeed=(edges:QualityEdge[],i:number)=>{
  const values=[edges[i-1]?.speedKmh,edges[i]?.speedKmh].filter((n):n is number=>n!==null&&n!==undefined);
  return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
};
const elapsed=(a:SourceObservation,b:SourceObservation)=>{
  const t0=timestamp(a.time),t1=timestamp(b.time);
  return t0===null||t1===null?null:(t1-t0)/1000;
};
function signalIslands(points:SourceObservation[],edges:QualityEdge[]):SignalIsland[]{
  if(!points.length)return[];
  const islands:SignalIsland[]= [];let start=0;
  for(let i=0;i<edges.length;i++)if(edges[i].status!=="VALID"){
    if(i-start+1>=2)islands.push({start,end:i});
    start=i+1;
  }
  if(points.length-start>=2)islands.push({start,end:points.length-1});
  return islands;
}
/** Conservative boundary guard: unsupported edges break temporal evidence. An event
 * within the existing evidence lookback horizon of a broken island boundary
 * cannot have a precise time, even if its support does not touch that edge. */
function nearbyInvalidBoundaryEvidence(points:SourceObservation[],edges:QualityEdge[],island:SignalIsland,support:{start:number;end:number},seconds:number):InvalidBoundaryEvidence[]{
  const found:InvalidBoundaryEvidence[]=[];
  const append=(side:InvalidBoundaryEvidence["side"],at:number,delta:number|null)=>{
    const edge=edges[at];
    if(edge?.status!=="UNAVAILABLE"||edge.reason===null)return;
    // If the temporal distance itself is unprovable, suppress a precise time.
    if(delta===null||(delta>=0&&delta<=seconds))
      found.push({side,edge:{from:edge.from,to:edge.to},reason:edge.reason});
  };
  if(island.start>0)
    append("BEFORE_ISLAND",island.start-1,elapsed(points[island.start],points[support.start]));
  if(island.end<points.length-1)
    append("AFTER_ISLAND",island.end,elapsed(points[support.end],points[island.end]));
  return found;
}
function altitudeCandidates(points:SourceObservation[],edges:QualityEdge[],island:SignalIsland):PatternCandidate[]{
  const results:PatternCandidate[]=[];
  for(let i=island.start+2;i<=island.end-2;i++){
    const center=points[i];if(center.alt===null||!Number.isFinite(center.alt))continue;
    const speed=sampleSpeed(edges,i);
    if(speed===null||speed<R21_PARAMETERS.altitudeMinSpeedKmh||speed>R21_PARAMETERS.altitudeMaxSpeedKmh)continue;
    const near=[i-2,i-1,i+1,i+2].filter(j=>j>=island.start&&j<=island.end&&elapsed(points[Math.min(i,j)],points[Math.max(i,j)])!==null&&Math.abs(elapsed(center,points[j])??Infinity)<=15);
    if(near.some(j=>points[j].alt!==null&&points[j].alt!<center.alt!-1))continue;
    let left=-1,right=-1;
    for(let j=i-1;j>=island.start;j--){const dt=elapsed(points[j],center);if(dt===null||dt>R21_PARAMETERS.altitudeWindowSeconds)break;if(points[j].alt!==null&&points[j].alt!-center.alt>=R21_PARAMETERS.altitudeReversalM){left=j;break}}
    for(let j=i+1;j<=island.end;j++){const dt=elapsed(center,points[j]);if(dt===null||dt>R21_PARAMETERS.altitudeWindowSeconds)break;if(points[j].alt!==null&&points[j].alt!-center.alt>=R21_PARAMETERS.altitudeReversalM){right=j;break}}
    if(left<0||right<0)continue;
    const sustained=points.slice(i+1,right).some(p=>p.alt!==null&&p.alt>center.alt!+1&&p.alt<center.alt!+R21_PARAMETERS.altitudeReversalM);
    if(!sustained)continue;
    const invalidBoundaryEvidence=nearbyInvalidBoundaryEvidence(points,edges,island,{start:left,end:right},R21_PARAMETERS.altitudeWindowSeconds);
    const gapAdjacent=invalidBoundaryEvidence.length>0;
    const previous=results.at(-1),delta=previous?elapsed(points[previous.index],center):null;
    if(previous&&delta!==null&&delta<=R21_PARAMETERS.mergeSeconds){
      if(points[previous.index].alt!>center.alt)
        results[results.length-1]={...previous,index:i,time:gapAdjacent?null:center.time,
          support:{start:left,end:right},gapAdjacent,invalidBoundaryEvidence};
      continue;
    }
    results.push({type:"T_G_PATTERN_CANDIDATE",index:i,support:{start:left,end:right},time:gapAdjacent?null:center.time,gapAdjacent,invalidBoundaryEvidence,physicalContactStatus:"UNRESOLVED",evidence:"ALTITUDE_REVERSAL"});
  }
  return results;
}
function speedDipCandidates(points:SourceObservation[],edges:QualityEdge[],island:SignalIsland):PatternCandidate[]{
  const results:PatternCandidate[]=[];
  if(island.end-island.start<7)return results;
  const speeds=points.map((_,i)=>sampleSpeed(edges,i));
  for(let i=island.start+1;i<island.end;){
    if(speeds[i]===null||speeds[i]!>R21_PARAMETERS.lowSpeedKmh){i++;continue}
    let last=i;
    while(last+1<island.end&&speeds[last+1]!==null&&speeds[last+1]!<=R21_PARAMETERS.lowSpeedKmh)last++;
    const dwell=elapsed(points[i],points[last]);if(dwell===null||dwell<R21_PARAMETERS.minLowDurationSeconds){i=last+1;continue}
    let left=-1,right=-1;
    for(let j=i-1;j>=island.start;j--){const dt=elapsed(points[j],points[i]);if(dt===null||dt>R21_PARAMETERS.speedWindowSeconds)break;if(speeds[j]!==null&&speeds[j]!>=R21_PARAMETERS.fastSpeedKmh){left=j;break}}
    for(let j=last+1;j<=island.end;j++){const dt=elapsed(points[last],points[j]);if(dt===null||dt>R21_PARAMETERS.speedWindowSeconds)break;if(speeds[j]!==null&&speeds[j]!>=R21_PARAMETERS.fastSpeedKmh){right=j;break}}
    if(left>=0&&right>=0){
      const index=Math.floor((i+last)/2);
      const invalidBoundaryEvidence=nearbyInvalidBoundaryEvidence(points,edges,island,{start:left,end:right},R21_PARAMETERS.speedWindowSeconds);
      const gapAdjacent=invalidBoundaryEvidence.length>0;
      results.push({type:"STOP_GO_PATTERN_CANDIDATE",index,support:{start:left,end:right},time:gapAdjacent?null:points[index].time,gapAdjacent,invalidBoundaryEvidence,physicalContactStatus:"UNRESOLVED",evidence:"SPEED_DIP"});
    }
    i=last+1;
  }
  return results;
}
/** Metadata is caller-declared, not independently verified sensor provenance.
 * Never infer AGL/runway/physical contact. Do not silently convert feet to m. */
export function assessSourceQuality(metadata?:SourceMetadata):SourceQualityAssessment{
  const datum=metadata?.verticalDatum?.status==="KNOWN"?"DECLARED_NOT_VERIFIED" as const:"UNKNOWN" as const;
  const h=metadata?.horizontalAccuracyM;
  const hKnown=h?.status==="KNOWN";
  const hValid=hKnown&&typeof h.value==="number"&&Number.isFinite(h.value)&&h.value>=0;
  const horizontalAccuracy:SourceQualityAssessment["horizontalAccuracy"]=!hKnown?
    {status:"UNKNOWN",declaredMeters:null}:hValid?
    {status:"DECLARED_NOT_VERIFIED",declaredMeters:h.value}:{status:"INVALID",declaredMeters:null};
  const make=(status:SourceQualityAssessment["vertical"]["status"],reason:VerticalEvidenceReason):SourceQualityAssessment=>({
    vertical:{status,reason,datum},horizontalAccuracy,runwayProximity:"UNAVAILABLE"
  });
  const mode=metadata?.altitudeMode;
  const unit=metadata?.altitudeUnit;
  const v=metadata?.verticalAccuracyM;
  if(mode?.status==="KNOWN"&&mode.value==="clampToGround")return make("UNAVAILABLE","CLAMPED_ALTITUDE");
  if(mode?.status==="KNOWN"&&mode.value!=="absolute"&&mode.value!=="relativeToGround")
    return make("UNAVAILABLE","UNSUPPORTED_ALTITUDE_MODE");
  if(unit?.status==="KNOWN"&&unit.value==="ft")return make("UNAVAILABLE","FEET_NOT_CONVERTED");
  if(unit?.status==="KNOWN"&&unit.value!=="m")return make("UNAVAILABLE","ALTITUDE_UNIT_UNKNOWN");
  if(v?.status==="KNOWN"&&(!Number.isFinite(v.value)||typeof v.value!=="number"||v.value<0))
    return make("UNAVAILABLE","MALFORMED_VERTICAL_ACCURACY");
  if(!metadata)return make("UNVERIFIED","SOURCE_METADATA_UNKNOWN");
  if(unit?.status!=="KNOWN")return make("UNVERIFIED","ALTITUDE_UNIT_UNKNOWN");
  if(mode?.status!=="KNOWN")return make("UNVERIFIED","ALTITUDE_MODE_UNKNOWN");
  return make("RELATIVE_CHANGE_ONLY","DECLARED_METRIC_RELATIVE_CHANGE_ONLY");
}
/** Never sorts/deduplicates source points. Candidate support is wholly in one valid island. */
export function analyzeResearchTrack(points:readonly SourceObservation[],metadata?:SourceMetadata):ResearchAnalysis{
  // Source order is the persisted/acquired order, not a claim of event truth.
  const sourceQuality=assessSourceQuality(metadata);
  const samples=[...points],edges=samples.slice(1).map((p,i)=>edge(samples[i],p,i));
  const islands=signalIslands(samples,edges);
  // Invalid declared horizontal accuracy cannot be silently treated as UNKNOWN.
  const invalidHorizontal=sourceQuality.horizontalAccuracy.status==="INVALID";
  const candidates=invalidHorizontal?[]:islands.flatMap(island=>[
    ...(sourceQuality.vertical.status==="UNAVAILABLE"?[]:altitudeCandidates(samples,edges,island)),
    ...speedDipCandidates(samples,edges,island)
  ]).sort((a,b)=>a.index-b.index);
  const patternCount:AdvisoryPatternCount=invalidHorizontal?
    {kind:"PATTERN_ONLY",status:"UNAVAILABLE",reason:"INVALID_SOURCE_METADATA"}:
    samples.length<2?{kind:"PATTERN_ONLY",status:"UNAVAILABLE",reason:"INSUFFICIENT_OBSERVATIONS"}:
    islands.length===0?{kind:"PATTERN_ONLY",status:"UNAVAILABLE",reason:"NO_VALID_SPAN"}:
    {kind:"PATTERN_ONLY",status:"AVAILABLE",scope:"OBSERVED_VALID_ISLANDS_ONLY",value:candidates.length};
  return{edges,islands,candidates,patternCount,sourceQuality};
}
