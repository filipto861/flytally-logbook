/**
 * D1-B: research-only shadow trace of FROZEN legacy speed admission, rolling
 * altitude <8-index grouping, and <=10-index speed/altitude suppression.
 * Never drives UI, persisted landing counts, or certification.
 *
 * Comparison must match the unmodified production touchAndGoEvents() exactly;
 * on mismatch there is NO diagnostic interpretation. See pinned-blob D1-A test.
 */
import {
  haversineKm,
  touchAndGoEvents,
  type KmlPoint,
  type TouchAndGoEvent,
} from "../../lib/track-processing.ts";
import {diagnoseLegacyAltitudeAtIndex} from "./d1-altitude-diagnostics.ts";

export const D1_ADMISSION_REVISION = "D1_B_FROZEN_LEGACY_ADMISSION_V1" as const;

export type D1AdmissionReport = {
  readonly revision:typeof D1_ADMISSION_REVISION;
  readonly status:"PARITY_MATCHED"|"UNAVAILABLE";
  readonly reason?:"INSUFFICIENT_SOURCE"|"SOURCE_TOO_LARGE_FOR_D1_MIRROR"|"LEGACY_EVENT_PARITY_MISMATCH";
  readonly sourceLineage:"NOT_ATTESTED";
  readonly physicalContact:"UNRESOLVED";
  /** Recorded events are drawn from production, not this mirror. */
  readonly legacyEventCount?:number;
  readonly legacySpeedEvents?:number;
  readonly legacyAltitudeEvents?:number;
  readonly speedGroundEvents?:number;
  readonly speedDurationRejected?:number;
  readonly speedDirectMotionRejected?:number;
  readonly speedAltitudeRangeRejected?:number;
  readonly speedAdmitted?:number;
  readonly rawAltitudeAdmissiblePoints?:number;
  readonly altitudeGroupedEvents?:number;
  readonly altitudeGroupingSuppressedPoints?:number;
  readonly altitudeSuppressedBySpeedOverlap?:number;
  readonly recomputedLegacyCount?:number;
};

function deltaSeconds(a:KmlPoint,b:KmlPoint){
  if(!a.time||!b.time)return 0;
  const delta=(Date.parse(b.time)-Date.parse(a.time))/1000;
  return Number.isFinite(delta)&&delta>0?delta:0;
}

/** Reproduce existing 5-point median, including the zero-time -> zero behavior. */
function frozenSpeeds(points:readonly KmlPoint[]):number[]{
  const raw=points.map((point,index)=>{
    if(index===0)return 0;
    const seconds=deltaSeconds(points[index-1],point);
    return seconds?Math.min(900,haversineKm(points[index-1],point)/(seconds/3600)):0;
  });
  return raw.map((_,index)=>{
    const window=raw.slice(Math.max(0,index-2),Math.min(raw.length,index+3)).sort((a,b)=>a-b);
    return window[Math.floor(window.length/2)]||0;
  });
}

type GroundEvent={start:number;end:number;duration:number};
function frozenGroundEvents(points:readonly KmlPoint[],speed:readonly number[]):GroundEvent[]{
  const events:GroundEvent[]=[];
  let start=-1;
  for(let i=2;i<speed.length-2;i++){
    const slow=speed[i]<20;
    if(slow&&start<0&&speed.slice(Math.max(0,i-10),i).some(value=>value>42))start=i;
    if(start>=0&&!slow&&speed.slice(i,Math.min(speed.length,i+10)).some(value=>value>42)){
      const duration=deltaSeconds(points[start],points[i]);
      if(duration>0)events.push({start,end:i,duration});
      start=-1;
    }
  }
  return events;
}
function sameEvents(a:readonly TouchAndGoEvent[],b:readonly TouchAndGoEvent[]):boolean{
  if(a.length!==b.length)return false;
  return a.every((event,i)=>{
    const other=b[i];
    return event.index===other.index&&event.time===other.time&&
      event.signal===other.signal&&event.confidence===other.confidence;
  });
}

export function diagnoseLegacyAdmission(points:readonly KmlPoint[]):D1AdmissionReport{
  const base={revision:D1_ADMISSION_REVISION,sourceLineage:"NOT_ATTESTED" as const,
    physicalContact:"UNRESOLVED" as const};
  const unavailable=(reason:NonNullable<D1AdmissionReport["reason"]>):D1AdmissionReport=>({
    ...base,status:"UNAVAILABLE",reason,
  });
  if(points.length<2)return unavailable("INSUFFICIENT_SOURCE");
  // D1-A's public per-index probe recomputes speed medians. Bound research-only
  // cost until the D1 mirror is optimized and separately source-parity verified.
  if(points.length>2048)return unavailable("SOURCE_TOO_LARGE_FOR_D1_MIRROR");

  const speed=frozenSpeeds(points);
  const ground=frozenGroundEvents(points,speed);
  const admittedSpeed:TouchAndGoEvent[]=[];
  let speedDurationRejected=0,speedDirectMotionRejected=0,speedAltitudeRangeRejected=0;
  for(const event of ground){
    if(!(event.duration>5&&event.duration<90)){speedDurationRejected++;continue}
    const endpointKmh=haversineKm(points[event.start],points[event.end])/(event.duration/3600);
    if(endpointKmh>145){speedDirectMotionRejected++;continue}
    const altitudes=points.slice(event.start,event.end+1)
      .map(point=>point.alt).filter((value):value is number=>value!==null&&Number.isFinite(value));
    if(altitudes.length>=2&&Math.max(...altitudes)-Math.min(...altitudes)>=30){
      speedAltitudeRangeRejected++;continue;
    }
    const index=Math.round((event.start+event.end)/2);
    admittedSpeed.push({index,time:points[index]?.time||null,signal:"speed",confidence:"high"});
  }
  // Inspect *exactly* the legacy scan region. One candidate point is NOT one
  // physical T&G. The frozen grouping below must collapse nearby minima.
  const rawAltitude:number[]=[];
  for(let index=4;index<points.length-4;index++){
    if(diagnoseLegacyAltitudeAtIndex(points,index).outcome==="ALTITUDE_SHAPE_ADMISSIBLE"){
      rawAltitude.push(index);
    }
  }
  const grouped:number[]=[];
  for(const index of rawAltitude){
    const previous=grouped.at(-1);
    if(previous!==undefined&&index-previous<8){
      if((points[index].alt??Infinity)<(points[previous].alt??Infinity)){
        grouped[grouped.length-1]=index;
      }
    }else grouped.push(index);
  }
  const combined:TouchAndGoEvent[]=[...admittedSpeed];
  let suppressedBySpeed=0;
  for(const index of grouped){
    if(combined.some(event=>Math.abs(event.index-index)<=10)){
      suppressedBySpeed++;
    }else combined.push({index,time:points[index]?.time||null,signal:"altitude",confidence:"medium"});
  }
  combined.sort((a,b)=>a.index-b.index);
  const production=touchAndGoEvents([...points]);
  if(!sameEvents(combined,production))return unavailable("LEGACY_EVENT_PARITY_MISMATCH");
  return {
    ...base,status:"PARITY_MATCHED",
    legacyEventCount:production.length,
    legacySpeedEvents:production.filter(event=>event.signal==="speed").length,
    legacyAltitudeEvents:production.filter(event=>event.signal==="altitude").length,
    speedGroundEvents:ground.length,
    speedDurationRejected,speedDirectMotionRejected,speedAltitudeRangeRejected,
    speedAdmitted:admittedSpeed.length,
    rawAltitudeAdmissiblePoints:rawAltitude.length,
    altitudeGroupedEvents:grouped.length,
    altitudeGroupingSuppressedPoints:rawAltitude.length-grouped.length,
    altitudeSuppressedBySpeedOverlap:suppressedBySpeed,
    recomputedLegacyCount:combined.length,
  };
}
