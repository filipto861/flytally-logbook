export type KmlPoint={lat:number;lon:number;alt:number|null;time:string|null};
export type TrackFileFormat="kml"|"gpx"|"csv";
export type TrackSource="adsbexchange"|"flightradar24"|"skydemon"|"generic";
export type TrackQualityStatus="good"|"review"|"poor";
export type TrackQuality={
  status:TrackQualityStatus;timedPoints:number;timestampCoverage:number;altitudeCoverage:number;
  largestGapMinutes:number;implausibleJumps:number;warnings:string[];
};
export type TrackInspection={format:TrackFileFormat;source:TrackSource;points:KmlPoint[];quality:TrackQuality};

const clean=(value:string)=>value.replace(/<!\[CDATA\[|\]\]>/g,"").trim();
const childText=(source:string,name:string)=>clean(source.match(new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>`,"i"))?.[1]||"")||null;

function coordinate(value:string):KmlPoint|null{const numbers=clean(value).replaceAll(","," ").split(/\s+/).map(Number);if(numbers.length<2||!Number.isFinite(numbers[0])||!Number.isFinite(numbers[1])||Math.abs(numbers[0])>180||Math.abs(numbers[1])>90)return null;return{lon:numbers[0],lat:numbers[1],alt:Number.isFinite(numbers[2])?numbers[2]:null,time:null}}
function coordinateList(value:string){const out:KmlPoint[]=[];for(const token of clean(value).split(/\s+/)){const point=coordinate(token);if(point)out.push(point)}return out}
function descriptionTimes(value:string|null){if(!value)return[];return[...value.matchAll(/(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?\s*(?:UTC|Z)/gi)].map(match=>`${match[1]}T${match[2]}Z`)}
function pushUnique(points:KmlPoint[],point:KmlPoint){const previous=points.at(-1);if(previous&&Math.abs(previous.lat-point.lat)<1e-7&&Math.abs(previous.lon-point.lon)<1e-7&&(previous.time||null)===(point.time||null))return;points.push(point)}
function normalize(points:KmlPoint[]){const unique:KmlPoint[]=[];points.forEach(point=>pushUnique(unique,point));const timed=unique.filter(point=>point.time&&Number.isFinite(Date.parse(point.time)));if(timed.length>=2)unique.sort((a,b)=>(a.time&&Number.isFinite(Date.parse(a.time))?Date.parse(a.time):Infinity)-(b.time&&Number.isFinite(Date.parse(b.time))?Date.parse(b.time):Infinity));return unique}

export function parseKml(source:string){
  const gx:KmlPoint[]=[];
  // ADSBexchange can emit many gx:Track blocks. Reading only the first one
  // turns a real route into a single dot, so every block is collected here.
  for(const match of source.matchAll(/<(?:\w+:)?Track\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Track>/gi)){const body=match[1],times=[...body.matchAll(/<(?:\w+:)?when\b[^>]*>([\s\S]*?)<\/(?:\w+:)?when>/gi)].map(item=>clean(item[1])),coords=[...body.matchAll(/<(?:\w+:)?coord\b[^>]*>([\s\S]*?)<\/(?:\w+:)?coord>/gi)];coords.forEach((item,index)=>{const point=coordinate(item[1]);if(point){point.time=times[index]||null;pushUnique(gx,point)}})}
  if(gx.length>=2)return normalize(gx);

  // FR24-style Point fixes and visual LineStrings are parallel datasets. They
  // must not be mixed or an artificial line appears between unrelated streams.
  const pointStream:KmlPoint[]=[],lineStream:KmlPoint[]=[];
  for(const match of source.matchAll(/<(?:\w+:)?Placemark\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Placemark>/gi)){const body=match[1],name=childText(body,"name"),description=childText(body,"description"),explicit=childText(body,"when")||childText(body,"begin")||descriptionTimes(name)[0]||null;
    for(const pointMatch of body.matchAll(/<(?:\w+:)?Point\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Point>/gi)){const coordinates=childText(pointMatch[1],"coordinates");if(!coordinates)continue;const point=coordinateList(coordinates)[0];if(point){point.time=explicit;pushUnique(pointStream,point)}}
    for(const lineMatch of body.matchAll(/<(?:\w+:)?LineString\b[^>]*>([\s\S]*?)<\/(?:\w+:)?LineString>/gi)){const coordinates=childText(lineMatch[1],"coordinates");if(!coordinates)continue;const times=descriptionTimes(description);coordinateList(coordinates).forEach((point,index)=>{point.time=times[index]||null;pushUnique(lineStream,point)})}
  }
  if(pointStream.filter(point=>point.time).length>=2)return normalize(pointStream);if(lineStream.length>=2)return normalize(lineStream);if(pointStream.length>=2)return normalize(pointStream);
  const fallback:KmlPoint[]=[];for(const block of source.matchAll(/<(?:\w+:)?coordinates\b[^>]*>([\s\S]*?)<\/(?:\w+:)?coordinates>/gi))coordinateList(block[1]).forEach(point=>pushUnique(fallback,point));return normalize(fallback.length?fallback:gx);
}

function parseGpx(source:string){const points:KmlPoint[]=[];for(const match of source.matchAll(/<(?:\w+:)?(?:trkpt|rtept)\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?(?:trkpt|rtept)>/gi)){const lat=Number(match[1].match(/\blat=["']([^"']+)/i)?.[1]),lon=Number(match[1].match(/\blon=["']([^"']+)/i)?.[1]);if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)continue;const altitudeText=childText(match[2],"ele"),altitude=altitudeText===null?null:Number(altitudeText),time=childText(match[2],"time");points.push({lat,lon,alt:altitude!==null&&Number.isFinite(altitude)?altitude:null,time})}return normalize(points)}

function delimiterCount(line:string,delimiter:string){let quoted=false,count=0;for(let index=0;index<line.length;index++){const char=line[index];if(char==='"'){if(quoted&&line[index+1]==='"'){index++;continue}quoted=!quoted}else if(char===delimiter&&!quoted)count++}return count}
function csvCells(line:string,delimiter:string){const out:string[]=[],push=()=>{out.push(current.trim());current=""};let current="",quoted=false;for(let index=0;index<line.length;index++){const char=line[index];if(char==='"'){if(quoted&&line[index+1]==='"'){current+='"';index++}else quoted=!quoted}else if(char===delimiter&&!quoted)push();else current+=char}push();return out}
function normalizeHeader(value:string){return value.toLowerCase().replace(/[^a-z0-9]/g,"")}
function combineCsvTimestamp(dateValue:string|undefined,timeValue:string|undefined){const date=(dateValue||"").trim(),time=(timeValue||"").trim();if(!time)return date||null;if(/^\d{4}-\d{2}-\d{2}(?:[T ]|$)/.test(time))return time.replace(" ","T");if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&/^\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(time))return`${date}T${time}`;return time}
function parseCsv(source:string){
  const lines=source.replace(/^\uFEFF/,"").split(/\r?\n/).filter(line=>line.trim());if(lines.length<2)return[];
  const delimiter=[",",";","\t"].map(value=>({value,count:delimiterCount(lines[0],value)})).sort((a,b)=>b.count-a.count)[0]?.value||",";
  const headers=csvCells(lines[0],delimiter).map(normalizeHeader),at=(names:string[])=>headers.findIndex(header=>names.includes(header));
  const latIndex=at(["lat","latitude","latitudedeg","latitudedegrees"]),lonIndex=at(["lon","lng","long","longitude","longitudedeg","longitudedegrees"]),altIndex=at(["alt","altitude","elevation","ele","altm","altitudem","altitudemeters","altitudeft","altitudefeet","elevationft","elevationfeet","gpsaltitude"]),timeIndex=at(["time","timestamp","datetime","utc","utctime","dateandtime","gpstime"]),dateIndex=at(["date","utcdate","flightdate"]);
  if(latIndex<0||lonIndex<0)return[];
  const altitudeFeet=altIndex>=0&&/(ft|feet)$/.test(headers[altIndex]);
  const number=(value:string|undefined)=>Number((value||"").trim().replace(",","."));
  const points=lines.slice(1).map(line=>{const row=csvCells(line,delimiter),lat=number(row[latIndex]),lon=number(row[lonIndex]),rawAlt=altIndex>=0?number(row[altIndex]):null,time=timeIndex>=0?combineCsvTimestamp(dateIndex>=0?row[dateIndex]:undefined,row[timeIndex]):dateIndex>=0?combineCsvTimestamp(row[dateIndex],undefined):null;if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;const alt=rawAlt!==null&&Number.isFinite(rawAlt)?rawAlt*(altitudeFeet?.3048:1):null;return{lat,lon,alt,time}}).filter(Boolean) as KmlPoint[];
  return normalize(points);
}

export function trackFileFormat(source:string,fileName=""):TrackFileFormat{const lower=fileName.toLowerCase();if(lower.endsWith(".gpx")||/<(?:\w+:)?gpx\b/i.test(source))return"gpx";if(lower.endsWith(".csv")||(!source.includes("<")&&/[;,\t]/.test(source.split(/\r?\n/,1)[0])))return"csv";return"kml"}
export function trackSource(source:string,fileName=""):TrackSource{const haystack=`${fileName}\n${source.slice(0,20000)}`.toLowerCase();if(/adsb\s*exchange|adsbexchange/.test(haystack))return"adsbexchange";if(/flightradar\s*24|flightradar24|\bfr24\b/.test(haystack))return"flightradar24";if(/skydemon/.test(haystack))return"skydemon";return"generic"}
export function parseTrackFile(source:string,fileName=""){const format=trackFileFormat(source,fileName);return format==="gpx"?parseGpx(source):format==="csv"?parseCsv(source):parseKml(source)}

export const haversineKm=(a:KmlPoint,b:KmlPoint)=>{const radius=6371.0088,p=Math.PI/180,dLat=(b.lat-a.lat)*p,dLon=(b.lon-a.lon)*p,q=Math.sin(dLat/2)**2+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin(dLon/2)**2;return 2*radius*Math.asin(Math.sqrt(q))};
const seconds=(a:KmlPoint,b:KmlPoint)=>{if(!a.time||!b.time)return 0;const value=(Date.parse(b.time)-Date.parse(a.time))/1000;return Number.isFinite(value)&&value>0?value:0};
function speeds(points:KmlPoint[]){const raw=points.map((point,index)=>{if(!index)return 0;const duration=seconds(points[index-1],point);return duration?Math.min(900,haversineKm(points[index-1],point)/(duration/3600)):0});return raw.map((_,index)=>{const window=raw.slice(Math.max(0,index-2),Math.min(raw.length,index+3)).sort((a,b)=>a-b);return window[Math.floor(window.length/2)]||0})}
function groundEvents(points:KmlPoint[]){const speed=speeds(points),events:Array<{start:number;end:number;duration:number}>=[];let start=-1;for(let i=2;i<speed.length-2;i++){const slow=speed[i]<20;if(slow&&start<0&&speed.slice(Math.max(0,i-10),i).some(value=>value>42))start=i;if(start>=0&&!slow&&speed.slice(i,Math.min(speed.length,i+10)).some(value=>value>42)){const duration=seconds(points[start],points[i]);if(duration>0)events.push({start,end:i,duration});start=-1}}return events}

/**
 * Detect a rolling touch-and-go that never becomes slow enough to create a
 * ground event. GPS altitude is deliberately only a secondary signal: the
 * aircraft must descend at least 30 m, reach a local minimum while still at a
 * plausible runway speed, and climb at least 30 m again. This keeps the first
 * take-off and final landing out of the count.
 */
function altitudeTouchAndGoIndices(points:KmlPoint[]){
  if(points.length<10||points.filter(point=>point.alt!==null&&Number.isFinite(point.alt)).length<8)return[];
  const speed=speeds(points),candidates:Array<{index:number;altitude:number}>=[];
  for(let index=4;index<points.length-4;index++){
    const altitude=points[index].alt,rollingSpeed=speed[index];
    if(altitude===null||!Number.isFinite(altitude)||rollingSpeed<28||rollingSpeed>145)continue;
    const left=points.slice(Math.max(0,index-10),index).map(point=>point.alt).filter((value):value is number=>value!==null&&Number.isFinite(value));
    const right=points.slice(index+1,Math.min(points.length,index+11)).map(point=>point.alt).filter((value):value is number=>value!==null&&Number.isFinite(value));
    if(left.length<3||right.length<3)continue;
    const local=points.slice(index-2,index+3).map(point=>point.alt).filter((value):value is number=>value!==null&&Number.isFinite(value));
    if(!local.length||altitude>Math.min(...local)+2)continue;
    if(Math.max(...left)-altitude<30||Math.max(...right)-altitude<30)continue;
    candidates.push({index,altitude});
  }
  const events:number[]=[];
  for(const candidate of candidates){
    const previous=events.at(-1);
    if(previous!==undefined&&candidate.index-previous<8){if(candidate.altitude<(points[previous].alt??Infinity))events[events.length-1]=candidate.index}
    else events.push(candidate.index);
  }
  return events;
}

export function hasAirborneMovement(points:KmlPoint[]){
  if(points.length<2)return false;
  const distance=points.slice(1).reduce((total,point,index)=>total+haversineKm(points[index],point),0),duration=seconds(points[0],points.at(-1)!);
  const speed=speeds(points),maxSpeed=speed.length?Math.max(...speed):0,alts=points.map(point=>point.alt).filter((value):value is number=>value!==null&&Number.isFinite(value)),altRange=alts.length>1?Math.max(...alts)-Math.min(...alts):0;
  return (maxSpeed>=35||(maxSpeed>=18&&altRange>=35))&&(distance>=.7||duration>=60);
}

export function trackQuality(points:KmlPoint[]):TrackQuality{
  const timedPoints=points.filter(point=>point.time&&Number.isFinite(Date.parse(point.time))).length,altitudePoints=points.filter(point=>point.alt!==null&&Number.isFinite(point.alt)).length;
  let largestGapSeconds=0,implausibleJumps=0;
  for(let index=1;index<points.length;index++){const duration=seconds(points[index-1],points[index]);if(duration>largestGapSeconds)largestGapSeconds=duration;if(duration>0){const distance=haversineKm(points[index-1],points[index]),speed=distance/(duration/3600);if(distance>=2&&speed>1200)implausibleJumps++}}
  const timestampCoverage=points.length?timedPoints/points.length:0,altitudeCoverage=points.length?altitudePoints/points.length:0,warnings:string[]=[];
  if(points.length<4)warnings.push("Very few GPS points; review the route, airports and times carefully.");
  if(points.length>=2&&!hasAirborneMovement(points))warnings.push("No credible airborne movement was detected in this section.");
  if(timestampCoverage<.5)warnings.push("Most GPS points have no usable timestamp; enter and review UTC times manually.");else if(timestampCoverage<.9)warnings.push("Some GPS points have no usable timestamp; review detected times.");
  if(implausibleJumps)warnings.push(`${implausibleJumps} implausible position ${implausibleJumps===1?"jump was":"jumps were"} detected; review the map before saving.`);
  const largestGapMinutes=Math.round(largestGapSeconds/6)/10;if(largestGapMinutes>=30)warnings.push(`The track contains a ${Math.round(largestGapMinutes)} minute coverage gap; verify whether it is one flight or multiple flights.`);
  const status:TrackQualityStatus=points.length<2||!hasAirborneMovement(points)?"poor":warnings.length?"review":"good";
  return{status,timedPoints,timestampCoverage,altitudeCoverage,largestGapMinutes,implausibleJumps,warnings};
}
export function inspectTrackFile(source:string,fileName=""):TrackInspection{const format=trackFileFormat(source,fileName),points=parseTrackFile(source,fileName);return{format,source:trackSource(source,fileName),points,quality:trackQuality(points)}}

/**
 * Several import formats mark one stop both as a time gap and as a low-speed
 * ground event. Treating both markers as separate cuts creates a fake flight
 * of a few stationary points between the real flights. Collapse boundaries
 * whenever the points between them contain no credible airborne movement.
 */
function consolidateGroundCuts(points:KmlPoint[],rawCuts:number[]){
  const cuts=[...new Set(rawCuts)].sort((a,b)=>a-b).filter(value=>value>=1&&value<=points.length-3);if(!cuts.length)return cuts;
  const merged:number[]=[];
  for(const cut of cuts){const previous=merged.at(-1);if(previous!==undefined&&!hasAirborneMovement(points.slice(previous+1,cut+1))){merged[merged.length-1]=Math.round((previous+cut)/2)}else merged.push(cut)}
  while(merged.length&&!hasAirborneMovement(points.slice(0,merged[0]+1)))merged.shift();
  while(merged.length&&!hasAirborneMovement(points.slice(merged.at(-1)!+1)))merged.pop();
  return merged;
}
export function suggestedSplits(points:KmlPoint[]){
  const out:number[]=[];
  for(let i=1;i<points.length;i++){
    const gap=seconds(points[i-1],points[i]),endpoint=haversineKm(points[i-1],points[i]);
    // Be conservative: a long ADS-B/GPS outage while airborne is not a new
    // flight. Automatic time-gap cuts require both a substantial pause and
    // endpoints close enough to be compatible with a ground turnaround.
    if((gap>=5400&&endpoint<=50)||(gap>=3600&&endpoint<=12)||(gap>=1200&&endpoint<=3))out.push(i-1);
  }
  for(const event of groundEvents(points))if(event.duration>=90)out.push(Math.round((event.start+event.end)/2));
  return consolidateGroundCuts(points,out);
}
export type SplitSuggestion={index:number;reason:string;gapMinutes:number|null;endpointKm:number|null};
export type TouchAndGoEvent={index:number;time:string|null;signal:"speed"|"altitude";confidence:"high"|"medium"};
export function suggestedSplitDetails(points:KmlPoint[]):SplitSuggestion[]{
  return suggestedSplits(points).map(index=>{
    const next=points[index+1],current=points[index],gap=next&&current?seconds(current,next):0,endpoint=next&&current?haversineKm(current,next):0;
    if(gap>=1200)return{index,reason:`${Math.round(gap/60)} minute gap with endpoints ${endpoint.toFixed(1)} km apart.`,gapMinutes:Math.round(gap/60),endpointKm:Math.round(endpoint*10)/10};
    return{index,reason:"Extended ground stop between credible flight sections.",gapMinutes:null,endpointKm:null};
  });
}
export function touchAndGoEvents(points:KmlPoint[]):TouchAndGoEvent[]{
  const events=groundEvents(points).filter(event=>event.duration>5&&event.duration<90).map<TouchAndGoEvent>(event=>{const index=Math.round((event.start+event.end)/2);return{index,time:points[index]?.time||null,signal:"speed",confidence:"high"}});
  for(const index of altitudeTouchAndGoIndices(points))if(!events.some(event=>Math.abs(event.index-index)<=10))events.push({index,time:points[index]?.time||null,signal:"altitude",confidence:"medium"});
  return events.sort((a,b)=>a.index-b.index);
}
export function landingCount(points:KmlPoint[]){return Math.max(1,1+touchAndGoEvents(points).length)}
export function splitPoints(points:KmlPoint[],indices:number[]){if(!indices.length)return[points];const parts:KmlPoint[][]=[];let start=0;for(const raw of indices){const index=Math.max(1,Math.min(points.length-2,raw)),part=points.slice(start,index+1);if(part.length>=2)parts.push(part);start=index+1}const tail=points.slice(start);if(tail.length>=2)parts.push(tail);return parts.length?parts:[points]}
export function trackStats(points:KmlPoint[]){const alts=points.map(point=>point.alt).filter((value):value is number=>value!==null&&value!==0),timed=points.filter(point=>point.time);return{pointCount:points.length,distanceKm:points.slice(1).reduce((total,point,index)=>total+haversineKm(points[index],point),0),startUtc:timed[0]?.time??null,endUtc:timed.at(-1)?.time??null,minAlt:alts.length?Math.min(...alts):null,maxAlt:alts.length?Math.max(...alts):null}}
export function overview(points:KmlPoint[],max=180){if(points.length<=max)return points;const step=Math.ceil(points.length/max),out=points.filter((_,index)=>index===0||index===points.length-1||index%step===0);if(out.at(-1)!==points.at(-1))out.push(points.at(-1)!);return out.slice(0,max)}
export function localParts(iso:string|null){if(!iso)return null;const date=new Date(iso);if(Number.isNaN(date.getTime()))return null;const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Prague",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date).map(part=>[part.type,part.value]));return{date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`}}

function shiftedIso(iso:string|null,minutes:number){if(!iso)return null;const date=new Date(iso);if(Number.isNaN(date.getTime()))return null;return new Date(date.getTime()+minutes*60_000).toISOString()}

export type FlightEnvelope={
  takeoffIndex:number;landingIndex:number;offBlockUtc:string|null;takeoffUtc:string|null;
  landingUtc:string|null;onBlockUtc:string|null;departureCandidates:KmlPoint[];arrivalCandidates:KmlPoint[];
};

export function trackEndpointCandidates<T extends {lat:number;lon:number}>(points:T[],arrival:boolean,max=12,maxPathKm=22){
  const ordered=arrival?[...points].reverse():points,result:T[]=[];let pathKm=0;
  for(const point of ordered){if(result.length){pathKm+=haversineKm({...result.at(-1)!,alt:null,time:null},{...point,alt:null,time:null});if(pathKm>maxPathKm&&result.length>=3)break}result.push(point);if(result.length>=max)break}
  return result;
}

/** Rank an airport primarily against the actual edge of the track. */
export function airportCandidateScore(candidates:Array<{lat:number;lon:number}>,airport:{lat:number;lon:number}){
  if(!candidates.length)return{distanceKm:Infinity,score:Infinity};
  const distances=candidates.map(point=>haversineKm({lat:point.lat,lon:point.lon,alt:null,time:null},{lat:airport.lat,lon:airport.lon,alt:null,time:null})),distanceKm=distances[0],support=Math.min(...distances),near=distances.slice(0,Math.min(4,distances.length)).sort((a,b)=>a-b),median=near[Math.floor(near.length/2)]??support;
  return{distanceKm,score:distanceKm*.82+support*.10+median*.08};
}

/** Detect the airborne portion without assuming that the file starts/ends at an airport. */
export function flightEnvelope(points:KmlPoint[]):FlightEnvelope{
  if(points.length<2)return{takeoffIndex:0,landingIndex:0,offBlockUtc:null,takeoffUtc:null,landingUtc:null,onBlockUtc:null,departureCandidates:points,arrivalCandidates:points};
  const speed=speeds(points),alts=points.map(point=>point.alt).filter((value):value is number=>value!==null&&Number.isFinite(value)),floor=alts.length?Math.min(...alts):null;
  const active=speed.map((value,index)=>value>=50||(value>=18&&floor!==null&&points[index].alt!==null&&points[index].alt!-floor>=45));
  let first=active.findIndex(Boolean),last=-1;for(let index=active.length-1;index>=0;index--)if(active[index]){last=index;break}
  if(first<0||last<first){first=0;last=points.length-1}
  const takeoffIndex=Math.max(0,first),landingIndex=Math.min(points.length-1,last),takeoffUtc=points[takeoffIndex].time||points.find(point=>point.time)?.time||null,landingUtc=points[landingIndex].time||[...points].reverse().find(point=>point.time)?.time||null;
  // The logbook convention is five minutes before take-off / after landing.
  // All four values remain editable in the confirmation step.
  const offBlockUtc=shiftedIso(takeoffUtc,-5),onBlockUtc=shiftedIso(landingUtc,5);
  return{takeoffIndex,landingIndex,offBlockUtc,takeoffUtc,landingUtc,onBlockUtc,departureCandidates:trackEndpointCandidates(points,false),arrivalCandidates:trackEndpointCandidates(points,true)};
}
