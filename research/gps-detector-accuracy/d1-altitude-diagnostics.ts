/**
 * D1-A: private-local, read-only explanations for frozen legacy rolling-altitude gates.
 * This is deliberately NOT an event detector and cannot establish wheel contact.
 * Mirrors only the current altitude candidate admission predicates. Accepted
 * event totals are always read from production touchAndGoEvents(), never this mirror.
 * Pinned to lib/track-processing.ts Git blob ff24b79c1e65ae911c0703ec8b750eb0d488b4d3.
 */
import {
  haversineKm,
  touchAndGoEvents,
  type KmlPoint,
} from "../../lib/track-processing.ts";

export const D1_ALTITUDE_DIAGNOSTIC_REVISION = "D1_A_LEGACY_ALTITUDE_V1" as const;
export const D1_LEGACY_SOURCE_BLOB = "ff24b79c1e65ae911c0703ec8b750eb0d488b4d3" as const;

export type D1AltitudeOutcome =
  | "NOT_IN_LEGACY_SCAN_REGION"
  | "MISSING_ALTITUDE"
  | "SPEED_OUTSIDE_LEGACY_RANGE"
  | "INSUFFICIENT_SIDE_SAMPLES"
  | "NOT_LOCAL_MINIMUM"
  | "DESCENT_30M_NOT_FOUND"
  | "CLIMB_30M_NOT_FOUND"
  | "NO_INTERMEDIATE_TIMED_CLIMB"
  | "DISCONTINUITY_IN_EVIDENCE_SPAN"
  | "ALTITUDE_SHAPE_ADMISSIBLE";

export type D1AltitudeProbe = {
  readonly outcome:D1AltitudeOutcome;
  /** Independent source quality observations, NOT overrides to legacy acceptance. */
  readonly invalidTimeEdgeInWindow:boolean;
  readonly unobservedOver15sInWindow:boolean;
  readonly sourceLineage:"NOT_ATTESTED";
  readonly physicalContact:"UNRESOLVED";
};

export type D1AltitudeSummary = {
  readonly revision:typeof D1_ALTITUDE_DIAGNOSTIC_REVISION;
  readonly status:"DIAGNOSTIC_ONLY";
  readonly sourceLineage:"NOT_ATTESTED";
  readonly physicalContact:"UNRESOLVED";
  readonly recordedPoints:number;
  /** Counts are frozen production touchAndGoEvents() output, NOT diagnostic guesses. */
  readonly legacyTgCount:number;
  readonly legacySpeedTgCount:number;
  readonly legacyAltitudeTgCount:number;
  /** One sampled altitude local-minimum may represent no physical manoeuvre. */
  readonly inspectedAltitudeMinima:number;
  readonly outcomes:Readonly<Partial<Record<D1AltitudeOutcome,number>>>;
  readonly sourceTimeWindowsWithInvalidEdges:number;
  readonly sourceTimeWindowsWithOver15sGaps:number;
};

function elapsed(a:KmlPoint,b:KmlPoint):number{
  if(!a.time||!b.time)return 0;
  const value=(Date.parse(b.time)-Date.parse(a.time))/1000;
  return Number.isFinite(value)&&value>0?value:0;
}

/** Deliberately reproduces frozen legacy five-index median, including invalid-time => 0. */
function legacySpeeds(points:readonly KmlPoint[]):number[]{
  const raw=points.map((point,index)=>{
    if(index===0)return 0;
    const duration=elapsed(points[index-1],point);
    return duration?Math.min(900,haversineKm(points[index-1],point)/(duration/3600)):0;
  });
  return raw.map((_,index)=>{
    const window=raw.slice(Math.max(0,index-2),Math.min(raw.length,index+3)).sort((a,b)=>a-b);
    return window[Math.floor(window.length/2)]||0;
  });
}

const validAlt=(value:number|null):value is number=>value!==null&&Number.isFinite(value);
function isLocalAltitudeMinimum(points:readonly KmlPoint[],index:number):boolean{
  const alt=points[index]?.alt;
  if(!validAlt(alt))return false;
  const neighborhood=points.slice(index-2,index+3).map(p=>p.alt).filter(validAlt);
  return neighborhood.length>0&&alt<=Math.min(...neighborhood)+2;
}

function temporalFlags(points:readonly KmlPoint[],start:number,end:number){
  let invalidTimeEdgeInWindow=false,unobservedOver15sInWindow=false;
  for(let i=Math.max(1,start+1);i<=Math.min(points.length-1,end);i++){
    const delta=elapsed(points[i-1],points[i]);
    if(delta===0)invalidTimeEdgeInWindow=true;
    if(delta>15)unobservedOver15sInWindow=true;
  }
  return{invalidTimeEdgeInWindow,unobservedOver15sInWindow};
}

function hasLegacyDiscontinuity(points:readonly KmlPoint[],start:number,end:number):boolean{
  for(let i=Math.max(1,start+1);i<=Math.min(points.length-1,end);i++){
    const before=points[i-1].alt,after=points[i].alt,delta=elapsed(points[i-1],points[i]);
    if(!validAlt(before)||!validAlt(after)||delta<=0||delta>15)continue;
    if(Math.abs(after-before)/delta>25)return true;
  }
  return false;
}

/**
 * Probe ONE local index against exact frozen altitude-candidate predicates.
 * This result does not include later <8-index grouping or <=10-index speed dedup.
 * ALTITUDE_SHAPE_ADMISSIBLE must NOT be counted as a T&G.
 */
export function diagnoseLegacyAltitudeAtIndex(points:readonly KmlPoint[],index:number):D1AltitudeProbe{
  const flags=temporalFlags(points,Math.max(0,index-10),Math.min(points.length-1,index+10));
  const probe=(outcome:D1AltitudeOutcome):D1AltitudeProbe=>({
    outcome,...flags,sourceLineage:"NOT_ATTESTED",physicalContact:"UNRESOLVED",
  });
  if(!Number.isSafeInteger(index)||index<4||index>=points.length-4||points.length<10||
     points.filter(p=>validAlt(p.alt)).length<8)return probe("NOT_IN_LEGACY_SCAN_REGION");
  const altitude=points[index].alt;
  if(!validAlt(altitude))return probe("MISSING_ALTITUDE");
  const speed=legacySpeeds(points)[index];
  if(speed<28||speed>145)return probe("SPEED_OUTSIDE_LEGACY_RANGE");
  const leftStart=Math.max(0,index-10),rightEnd=Math.min(points.length-1,index+10);
  const left=points.slice(leftStart,index).map(p=>p.alt).filter(validAlt);
  const right=points.slice(index+1,rightEnd+1).map(p=>p.alt).filter(validAlt);
  if(left.length<3||right.length<3)return probe("INSUFFICIENT_SIDE_SAMPLES");
  if(!isLocalAltitudeMinimum(points,index))return probe("NOT_LOCAL_MINIMUM");
  let descentEvidence=-1,climbEvidence=-1;
  for(let cursor=index-1;cursor>=leftStart;cursor--){
    const value=points[cursor].alt;
    if(validAlt(value)&&value-altitude>=30){descentEvidence=cursor;break}
  }
  for(let cursor=index+1;cursor<=rightEnd;cursor++){
    const value=points[cursor].alt;
    if(validAlt(value)&&value-altitude>=30){climbEvidence=cursor;break}
  }
  if(descentEvidence<0)return probe("DESCENT_30M_NOT_FOUND");
  if(climbEvidence<0)return probe("CLIMB_30M_NOT_FOUND");
  let intermediateClimb=false;
  for(let cursor=index+1;cursor<climbEvidence;cursor++){
    const value=points[cursor].alt;
    if(validAlt(value)&&value>altitude&&elapsed(points[cursor-1],points[cursor])>0){
      intermediateClimb=true;break;
    }
  }
  if(!intermediateClimb)return probe("NO_INTERMEDIATE_TIMED_CLIMB");
  if(hasLegacyDiscontinuity(points,descentEvidence,climbEvidence))
    return probe("DISCONTINUITY_IN_EVIDENCE_SPAN");
  return probe("ALTITUDE_SHAPE_ADMISSIBLE");
}

/**
 * Aggregate-only safe output: no timestamps, source bytes, geo points, filenames,
 * source indices, registration, private identifiers or event coordinates.
 */
export function summarizeLegacyAltitudeDiagnostics(points:readonly KmlPoint[]):D1AltitudeSummary{
  const events=touchAndGoEvents([...points]);
  const outcomes:Partial<Record<D1AltitudeOutcome,number>>={};
  let inspectedAltitudeMinima=0,sourceTimeWindowsWithInvalidEdges=0,sourceTimeWindowsWithOver15sGaps=0;
  for(let index=4;index<points.length-4;index++){
    if(!isLocalAltitudeMinimum(points,index))continue;
    inspectedAltitudeMinima++;
    const result=diagnoseLegacyAltitudeAtIndex(points,index);
    outcomes[result.outcome]=(outcomes[result.outcome]??0)+1;
    if(result.invalidTimeEdgeInWindow)sourceTimeWindowsWithInvalidEdges++;
    if(result.unobservedOver15sInWindow)sourceTimeWindowsWithOver15sGaps++;
  }
  return{
    revision:D1_ALTITUDE_DIAGNOSTIC_REVISION,status:"DIAGNOSTIC_ONLY",
    sourceLineage:"NOT_ATTESTED",physicalContact:"UNRESOLVED",
    recordedPoints:points.length,legacyTgCount:events.length,
    legacySpeedTgCount:events.filter(e=>e.signal==="speed").length,
    legacyAltitudeTgCount:events.filter(e=>e.signal==="altitude").length,
    inspectedAltitudeMinima,outcomes,
    sourceTimeWindowsWithInvalidEdges,sourceTimeWindowsWithOver15sGaps,
  };
}
