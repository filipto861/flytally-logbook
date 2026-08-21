export type KmlPoint={lat:number;lon:number;alt:number|null;time:string|null};

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
function parseCsv(source:string){const lines=source.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean);if(lines.length<2)return[];const delimiter=(lines[0].match(/;/g)?.length||0)>(lines[0].match(/,/g)?.length||0)?";":lines[0].includes("\t")?"\t":",",cells=(line:string)=>line.split(delimiter).map(value=>value.trim().replace(/^"|"$/g,"").replaceAll('""','"')),headers=cells(lines[0]).map(value=>value.toLowerCase().replace(/[^a-z0-9]/g,"")),at=(names:string[])=>headers.findIndex(header=>names.includes(header)),latIndex=at(["lat","latitude","latitudedeg"]),lonIndex=at(["lon","lng","longitude","longitudedeg"]),altIndex=at(["alt","altitude","elevation","ele","altm"]),timeIndex=at(["time","timestamp","datetime","utc","dateandtime"]);if(latIndex<0||lonIndex<0)return[];return normalize(lines.slice(1).map(line=>{const row=cells(line),number=(value:string|undefined)=>Number((value||"").replace(",",".")),lat=number(row[latIndex]),lon=number(row[lonIndex]),alt=altIndex>=0?number(row[altIndex]):null,time=timeIndex>=0?row[timeIndex]?.trim()||null:null;if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;return{lat,lon,alt:alt!==null&&Number.isFinite(alt)?alt:null,time}}).filter(Boolean) as KmlPoint[])}
export function parseTrackFile(source:string,fileName=""){const lower=fileName.toLowerCase();return lower.endsWith(".gpx")||/<(?:\w+:)?gpx\b/i.test(source)?parseGpx(source):lower.endsWith(".csv")||(!source.includes("<")&&/[;,\t]/.test(source.split(/\r?\n/,1)[0]))?parseCsv(source):parseKml(source)}

export const haversineKm=(a:KmlPoint,b:KmlPoint)=>{const radius=6371.0088,p=Math.PI/180,dLat=(b.lat-a.lat)*p,dLon=(b.lon-a.lon)*p,q=Math.sin(dLat/2)**2+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin(dLon/2)**2;return 2*radius*Math.asin(Math.sqrt(q))};
const seconds=(a:KmlPoint,b:KmlPoint)=>{if(!a.time||!b.time)return 0;const value=(Date.parse(b.time)-Date.parse(a.time))/1000;return Number.isFinite(value)&&value>0?value:0};
function speeds(points:KmlPoint[]){const raw=points.map((point,index)=>{if(!index)return 0;const duration=seconds(points[index-1],point);return duration?Math.min(900,haversineKm(points[index-1],point)/(duration/3600)):0});return raw.map((_,index)=>{const window=raw.slice(Math.max(0,index-2),Math.min(raw.length,index+3)).sort((a,b)=>a-b);return window[Math.floor(window.length/2)]||0})}
function groundEvents(points:KmlPoint[]){const speed=speeds(points),events:Array<{start:number;end:number;duration:number}>=[];let start=-1;for(let i=2;i<speed.length-2;i++){const slow=speed[i]<20;if(slow&&start<0&&speed.slice(Math.max(0,i-10),i).some(value=>value>42))start=i;if(start>=0&&!slow&&speed.slice(i,Math.min(speed.length,i+10)).some(value=>value>42)){const duration=seconds(points[start],points[i]);if(duration>0)events.push({start,end:i,duration});start=-1}}return events}
export function suggestedSplits(points:KmlPoint[]){const out:number[]=[];for(let i=1;i<points.length;i++){const gap=seconds(points[i-1],points[i]),endpoint=haversineKm(points[i-1],points[i]);if((gap>=3600&&endpoint<=50)||(gap>=1200&&endpoint<=12)||gap>=5400)out.push(i-1)}for(const event of groundEvents(points))if(event.duration>=90)out.push(Math.round((event.start+event.end)/2));return[...new Set(out)].sort((a,b)=>a-b).filter((value,index,all)=>value>2&&value<points.length-3&&(!index||value-all[index-1]>=5))}
export function landingCount(points:KmlPoint[]){return Math.max(1,1+groundEvents(points).filter(event=>event.duration>5&&event.duration<90).length)}
export function splitPoints(points:KmlPoint[],indices:number[]){if(!indices.length)return[points];const parts:KmlPoint[][]=[];let start=0;for(const raw of indices){const index=Math.max(1,Math.min(points.length-2,raw)),part=points.slice(start,index+1);if(part.length>=2)parts.push(part);start=index+1}const tail=points.slice(start);if(tail.length>=2)parts.push(tail);return parts.length?parts:[points]}
export function trackStats(points:KmlPoint[]){const alts=points.map(point=>point.alt).filter((value):value is number=>value!==null&&value!==0),timed=points.filter(point=>point.time);return{pointCount:points.length,distanceKm:points.slice(1).reduce((total,point,index)=>total+haversineKm(points[index],point),0),startUtc:timed[0]?.time??null,endUtc:timed.at(-1)?.time??null,minAlt:alts.length?Math.min(...alts):null,maxAlt:alts.length?Math.max(...alts):null}}
export function overview(points:KmlPoint[],max=180){if(points.length<=max)return points;const step=Math.ceil(points.length/max),out=points.filter((_,index)=>index===0||index===points.length-1||index%step===0);if(out.at(-1)!==points.at(-1))out.push(points.at(-1)!);return out.slice(0,max)}
export function localParts(iso:string|null){if(!iso)return null;const date=new Date(iso);if(Number.isNaN(date.getTime()))return null;const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Prague",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date).map(part=>[part.type,part.value]));return{date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`}}

function shiftedIso(iso:string|null,minutes:number){if(!iso)return null;const date=new Date(iso);if(Number.isNaN(date.getTime()))return null;return new Date(date.getTime()+minutes*60_000).toISOString()}

export type FlightEnvelope={
  takeoffIndex:number;landingIndex:number;offBlockUtc:string|null;takeoffUtc:string|null;
  landingUtc:string|null;onBlockUtc:string|null;departureCandidates:KmlPoint[];arrivalCandidates:KmlPoint[];
};

function sampledWindow(points:KmlPoint[],from:number,to:number,max=16){const slice=points.slice(Math.max(0,from),Math.min(points.length,to+1));if(slice.length<=max)return slice;const step=Math.max(1,Math.floor(slice.length/(max-1)));const result=slice.filter((_,index)=>index===0||index===slice.length-1||index%step===0);return result.slice(0,max-1).concat(slice.at(-1)!)}

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
  return{takeoffIndex,landingIndex,offBlockUtc,takeoffUtc,landingUtc,onBlockUtc,departureCandidates:sampledWindow(points,0,Math.min(points.length-1,takeoffIndex+5)),arrivalCandidates:sampledWindow(points,Math.max(0,landingIndex-5),points.length-1)};
}
