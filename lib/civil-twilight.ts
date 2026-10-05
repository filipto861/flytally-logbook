import { trackTimestampBasis } from "./track-time.ts";
import { TRACK_GENERAL_IMPLAUSIBLE_SPEED_KMH,flightEnvelope,haversineKm,isImplausiblePositionTransition,touchAndGoEvents,type KmlPoint } from "./track-processing.ts";

export const CIVIL_TWILIGHT_ALTITUDE_DEG=-6;
export const CIVIL_TWILIGHT_CONFIDENCE_GUARD_DEG=.5;
export const CIVIL_TWILIGHT_MIN_YEAR=1800;
export const CIVIL_TWILIGHT_MAX_YEAR=2100;
export const CIVIL_TWILIGHT_MAX_ABS_LATITUDE=72;

export type CivilTwilightClass="DAY"|"NIGHT"|"UNAVAILABLE";
export type CivilTwilightLandingSuggestion=
  |{status:"AVAILABLE";day:number;night:number;total:number}
  |{status:"UNAVAILABLE";total:number};
export type NightTimeUnavailableReason=
  |"INSUFFICIENT_POINTS"
  |"MISSING_OR_AMBIGUOUS_TIMESTAMP"
  |"NON_MONOTONIC_TIMESTAMP"
  |"INVALID_OR_UNSUPPORTED_POSITION"
  |"UNSUPPORTED_SOLAR_ENVELOPE"
  |"ZERO_DURATION_CONFLICT"
  |"SEGMENT_GAP_TOO_LARGE"
  |"TRACK_DISCONTINUITY"
  |"TWILIGHT_CONFIDENCE_GUARD"
  |"CROSSING_UNRESOLVED";
export type CivilTwilightNightTimeSuggestion=
  |{status:"AVAILABLE";minutes:number}
  |{status:"UNAVAILABLE";reasons:NightTimeUnavailableReason[];firstAffectedSegment?:number;largestGapSeconds?:number};
export type CivilTwilightMovementSuggestion=
  |{status:"AVAILABLE";takeoffsDay:number;takeoffsNight:number;approachesDay:number;approachesNight:number}
  |{status:"UNAVAILABLE"};

const radians=(degrees:number)=>degrees*Math.PI/180;
const degrees=(radiansValue:number)=>radiansValue*180/Math.PI;
const normalizeDegrees=(value:number)=>((value%360)+360)%360;

function parsedInstant(value:unknown){
  const timestamp=String(value??"").trim();
  const basis=trackTimestampBasis(timestamp);
  if(basis!=="utc"&&basis!=="offset")return null;
  const date=new Date(timestamp),millis=date.getTime();
  if(!Number.isFinite(millis))return null;
  const year=date.getUTCFullYear();
  if(year<CIVIL_TWILIGHT_MIN_YEAR||year>CIVIL_TWILIGHT_MAX_YEAR)return null;
  return{date,millis};
}

/**
 * Geometric solar-centre altitude using the published NOAA/Meeus equations.
 * Atmospheric-refraction correction is deliberately not applied because the
 * SERA civil-twilight definition uses the geometric centre of the Sun at -6°.
 */
export function geometricSolarAltitudeDegrees(timestamp:unknown,lat:unknown,lon:unknown):number|null{
  const latitude=Number(lat),longitude=Number(lon),instant=parsedInstant(timestamp);
  if(!instant||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>CIVIL_TWILIGHT_MAX_ABS_LATITUDE||Math.abs(longitude)>180)return null;

  const julianDay=instant.millis/86_400_000+2_440_587.5;
  const century=(julianDay-2_451_545)/36_525;
  const geomMeanLong=normalizeDegrees(280.46646+century*(36_000.76983+century*.0003032));
  const geomMeanAnomaly=357.52911+century*(35_999.05029-.0001537*century);
  const eccentricity=.016708634-century*(.000042037+.0000001267*century);
  const anomalyRad=radians(geomMeanAnomaly);
  const sunEquation=
    Math.sin(anomalyRad)*(1.914602-century*(.004817+.000014*century))
    +Math.sin(2*anomalyRad)*(.019993-.000101*century)
    +Math.sin(3*anomalyRad)*.000289;
  const trueLongitude=geomMeanLong+sunEquation;
  const omega=125.04-1934.136*century;
  const apparentLongitude=trueLongitude-.00569-.00478*Math.sin(radians(omega));
  const meanObliquity=23+(26+(21.448-century*(46.815+century*(.00059-century*.001813)))/60)/60;
  const obliquity=meanObliquity+.00256*Math.cos(radians(omega));
  const declination=degrees(Math.asin(Math.sin(radians(obliquity))*Math.sin(radians(apparentLongitude))));
  const y=Math.tan(radians(obliquity/2))**2;
  const meanLongRad=radians(geomMeanLong);
  const equationOfTime=4*degrees(
    y*Math.sin(2*meanLongRad)
    -2*eccentricity*Math.sin(anomalyRad)
    +4*eccentricity*y*Math.sin(anomalyRad)*Math.cos(2*meanLongRad)
    -.5*y*y*Math.sin(4*meanLongRad)
    -1.25*eccentricity*eccentricity*Math.sin(2*anomalyRad)
  );
  const utcMinutes=instant.date.getUTCHours()*60+instant.date.getUTCMinutes()+instant.date.getUTCSeconds()/60+instant.date.getUTCMilliseconds()/60_000;
  const trueSolarTime=((utcMinutes+equationOfTime+4*longitude)%1440+1440)%1440;
  let hourAngle=trueSolarTime/4-180;
  if(hourAngle< -180)hourAngle+=360;
  const cosZenith=
    Math.sin(radians(latitude))*Math.sin(radians(declination))
    +Math.cos(radians(latitude))*Math.cos(radians(declination))*Math.cos(radians(hourAngle));
  const bounded=Math.max(-1,Math.min(1,cosZenith));
  const altitude=90-degrees(Math.acos(bounded));
  return Number.isFinite(altitude)?altitude:null;
}

export function classifyCivilTwilightEvent(input:{timestamp:unknown;lat:unknown;lon:unknown}):CivilTwilightClass{
  const altitude=geometricSolarAltitudeDegrees(input.timestamp,input.lat,input.lon);
  if(altitude===null||Math.abs(altitude-CIVIL_TWILIGHT_ALTITUDE_DEG)<=CIVIL_TWILIGHT_CONFIDENCE_GUARD_DEG)return"UNAVAILABLE";
  return altitude>CIVIL_TWILIGHT_ALTITUDE_DEG?"DAY":"NIGHT";
}

export function aggregateCivilTwilightLandingEvents(events:Array<Pick<KmlPoint,"time"|"lat"|"lon">|undefined>,detectedTotal:number):CivilTwilightLandingSuggestion{
  if(!Number.isSafeInteger(detectedTotal)||detectedTotal<1||events.length!==detectedTotal)return{status:"UNAVAILABLE",total:Math.max(0,Number.isFinite(detectedTotal)?Math.trunc(detectedTotal):0)};
  let day=0,night=0;
  for(const event of events){
    if(!event)return{status:"UNAVAILABLE",total:detectedTotal};
    const classification=classifyCivilTwilightEvent({timestamp:event.time,lat:event.lat,lon:event.lon});
    if(classification==="UNAVAILABLE")return{status:"UNAVAILABLE",total:detectedTotal};
    if(classification==="DAY")day+=1;else night+=1;
  }
  if(day+night!==detectedTotal)return{status:"UNAVAILABLE",total:detectedTotal};
  return{status:"AVAILABLE",day,night,total:detectedTotal};
}

export function gpsLandingDayNightSuggestion(points:KmlPoint[]):CivilTwilightLandingSuggestion{
  if(points.length<2)return{status:"UNAVAILABLE",total:0};
  const touches=touchAndGoEvents(points),envelope=flightEnvelope(points),indices=[...touches.map(event=>event.index),envelope.landingIndex],detectedTotal=1+touches.length;
  if(indices.length!==detectedTotal||new Set(indices).size!==indices.length)return{status:"UNAVAILABLE",total:detectedTotal};
  const events=indices.map(index=>points[index]);
  return aggregateCivilTwilightLandingEvents(events,detectedTotal);
}

export function gpsPfMovementDayNightSuggestion(points:KmlPoint[]):CivilTwilightMovementSuggestion{
  if(points.length<2)return{status:"UNAVAILABLE"};
  const touches=touchAndGoEvents(points),envelope=flightEnvelope(points);
  const takeoffEvents=[points[envelope.takeoffIndex],...touches.map(event=>points[event.index])];
  const approachEvents=[...touches.map(event=>points[event.index]),points[envelope.landingIndex]];
  const takeoffSuggestion=aggregateCivilTwilightLandingEvents(takeoffEvents,takeoffEvents.length);
  const approachSuggestion=aggregateCivilTwilightLandingEvents(approachEvents,approachEvents.length);
  if(takeoffSuggestion.status!=="AVAILABLE"||approachSuggestion.status!=="AVAILABLE")return{status:"UNAVAILABLE"};
  return{
    status:"AVAILABLE",
    takeoffsDay:takeoffSuggestion.day,
    takeoffsNight:takeoffSuggestion.night,
    approachesDay:approachSuggestion.day,
    approachesNight:approachSuggestion.night,
  };
}


function unavailableNightTime(reason:NightTimeUnavailableReason,firstAffectedSegment?:number,largestGapSeconds?:number):CivilTwilightNightTimeSuggestion{
  return{status:"UNAVAILABLE",reasons:[reason],...(firstAffectedSegment===undefined?{}:{firstAffectedSegment}),...(largestGapSeconds===undefined?{}:{largestGapSeconds})};
}

function timedPoint(point:KmlPoint){
  const timestamp=String(point.time??"").trim(),basis=trackTimestampBasis(timestamp);
  if(basis!=="utc"&&basis!=="offset")return{reason:"MISSING_OR_AMBIGUOUS_TIMESTAMP" as const};
  const millis=Date.parse(timestamp);
  if(!Number.isFinite(millis))return{reason:"MISSING_OR_AMBIGUOUS_TIMESTAMP" as const};
  const year=new Date(millis).getUTCFullYear();
  if(year<CIVIL_TWILIGHT_MIN_YEAR||year>CIVIL_TWILIGHT_MAX_YEAR)return{reason:"UNSUPPORTED_SOLAR_ENVELOPE" as const};
  return{millis};
}

function pointSupportReason(point:KmlPoint):NightTimeUnavailableReason|null{
  if(!Number.isFinite(point.lat)||!Number.isFinite(point.lon)||Math.abs(point.lat)>90||Math.abs(point.lon)>180)return"INVALID_OR_UNSUPPORTED_POSITION";
  if(Math.abs(point.lat)>CIVIL_TWILIGHT_MAX_ABS_LATITUDE)return"UNSUPPORTED_SOLAR_ENVELOPE";
  return null;
}

function interpolatedPoint(a:KmlPoint,b:KmlPoint,fraction:number,millis:number):KmlPoint{
  return{
    lat:a.lat+(b.lat-a.lat)*fraction,
    lon:a.lon+(b.lon-a.lon)*fraction,
    alt:null,
    time:new Date(millis).toISOString(),
  };
}

function civilTwilightCrossingFraction(a:KmlPoint,b:KmlPoint,aMillis:number,bMillis:number,aAltitude:number,bAltitude:number){
  let low=0,high=1,lowValue=aAltitude-CIVIL_TWILIGHT_ALTITUDE_DEG,highValue=bAltitude-CIVIL_TWILIGHT_ALTITUDE_DEG;
  if(lowValue===0)return 0;if(highValue===0)return 1;if(lowValue*highValue>0)return null;
  for(let iteration=0;iteration<24;iteration++){
    const mid=(low+high)/2,midMillis=aMillis+(bMillis-aMillis)*mid,point=interpolatedPoint(a,b,mid,midMillis);
    const altitude=geometricSolarAltitudeDegrees(point.time,point.lat,point.lon);
    if(altitude===null)return null;
    const value=altitude-CIVIL_TWILIGHT_ALTITUDE_DEG;
    if(lowValue*value<=0){high=mid;highValue=value}else{low=mid;lowValue=value}
  }
  return(low+high)/2;
}

export const CIVIL_TWILIGHT_LEGACY_MAX_SEGMENT_SECONDS=600;
const EARTH_RADIUS_KM=6371.0088;
const SOLAR_ALTITUDE_TIME_RATE_BOUND_DEG_PER_HOUR=15.1;
const TRACK_POSITION_ANGULAR_RATE_BOUND_DEG_PER_HOUR=TRACK_GENERAL_IMPLAUSIBLE_SPEED_KMH/EARTH_RADIUS_KM*180/Math.PI;

function longSegmentSolarChangeBoundDegrees(durationSeconds:number){
  return durationSeconds/3600*(SOLAR_ALTITUDE_TIME_RATE_BOUND_DEG_PER_HOUR+TRACK_POSITION_ANGULAR_RATE_BOUND_DEG_PER_HOUR);
}

function longSegmentSameStateProven(aDelta:number,bDelta:number,durationSeconds:number){
  if(aDelta===0||bDelta===0||Math.sign(aDelta)!==Math.sign(bDelta))return false;
  const requiredMargin=CIVIL_TWILIGHT_CONFIDENCE_GUARD_DEG+longSegmentSolarChangeBoundDegrees(durationSeconds);
  return Math.min(Math.abs(aDelta),Math.abs(bDelta))>requiredMargin;
}

function samePosition(a:KmlPoint,b:KmlPoint){
  return haversineKm(a,b)<.001;
}

/**
 * Conservative GPS Night-time suggestion.
 *
 * Sparse segments longer than the legacy 10-minute guard are no longer
 * rejected solely for their sampling interval when a conservative bound proves
 * the complete segment stays unambiguously on the same side of civil twilight.
 * The bound combines:
 * - a conservative solar-altitude time-rate bound; and
 * - the existing canonical GPS continuity speed bound from track-processing.
 *
 * A sparse segment that could contain the twilight boundary remains
 * UNAVAILABLE. Linear subdivision never turns an unsafe gap into evidence.
 * Manual input remains authoritative and IFR is intentionally outside this helper.
 */
export function gpsNightMinutesSuggestion(points:KmlPoint[]):CivilTwilightNightTimeSuggestion{
  if(points.length<2)return unavailableNightTime("INSUFFICIENT_POINTS");
  let nightSeconds=0;
  for(let index=1;index<points.length;index++){
    const a=points[index-1],b=points[index],aSupport=pointSupportReason(a),bSupport=pointSupportReason(b);
    if(aSupport)return unavailableNightTime(aSupport,index-1);
    if(bSupport)return unavailableNightTime(bSupport,index-1);

    const aTime=timedPoint(a),bTime=timedPoint(b);
    if("reason"in aTime)return unavailableNightTime(aTime.reason,index-1);
    if("reason"in bTime)return unavailableNightTime(bTime.reason,index-1);
    const aMillis=aTime.millis,bMillis=bTime.millis;
    if(bMillis<aMillis)return unavailableNightTime("NON_MONOTONIC_TIMESTAMP",index-1);
    if(bMillis===aMillis){
      if(!samePosition(a,b))return unavailableNightTime("ZERO_DURATION_CONFLICT",index-1);
      continue;
    }

    const duration=(bMillis-aMillis)/1000;
    if(isImplausiblePositionTransition(a,b,duration))return unavailableNightTime("TRACK_DISCONTINUITY",index-1,duration);

    const aAltitude=geometricSolarAltitudeDegrees(a.time,a.lat,a.lon),bAltitude=geometricSolarAltitudeDegrees(b.time,b.lat,b.lon);
    if(aAltitude===null||bAltitude===null)return unavailableNightTime("UNSUPPORTED_SOLAR_ENVELOPE",index-1,duration);
    const aDelta=aAltitude-CIVIL_TWILIGHT_ALTITUDE_DEG,bDelta=bAltitude-CIVIL_TWILIGHT_ALTITUDE_DEG;
    if(Math.abs(aDelta)<=CIVIL_TWILIGHT_CONFIDENCE_GUARD_DEG||Math.abs(bDelta)<=CIVIL_TWILIGHT_CONFIDENCE_GUARD_DEG)return unavailableNightTime("TWILIGHT_CONFIDENCE_GUARD",index-1,duration);

    if(duration>CIVIL_TWILIGHT_LEGACY_MAX_SEGMENT_SECONDS){
      if(!longSegmentSameStateProven(aDelta,bDelta,duration))return unavailableNightTime("SEGMENT_GAP_TOO_LARGE",index-1,duration);
      if(aDelta<0)nightSeconds+=duration;
      continue;
    }

    if(aDelta<0&&bDelta<0){nightSeconds+=duration;continue}
    if(aDelta>0&&bDelta>0)continue;
    const crossing=civilTwilightCrossingFraction(a,b,aMillis,bMillis,aAltitude,bAltitude);
    if(crossing===null)return unavailableNightTime("CROSSING_UNRESOLVED",index-1,duration);
    nightSeconds+=aDelta<0?duration*crossing:duration*(1-crossing);
  }
  return{status:"AVAILABLE",minutes:Math.max(0,Math.round(nightSeconds/60))};
}
