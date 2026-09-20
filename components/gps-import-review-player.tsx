"use client";

import { useEffect,useMemo,useRef,useState } from "react";
import L from "leaflet";
import type { MapTrack,TrackPoint } from "@/lib/data/tracks";
import { addFlyTallyBasemap,installResponsiveMap } from "@/components/leaflet-mobile";
import { createAircraftMarkerIcon,rotateAircraftMarker } from "@/components/aircraft-marker";
import { NavIcon } from "@/components/nav-icon";
import { mapThemePalette,useResolvedTheme } from "@/components/theme-runtime";
import { metersToFeet } from "@/lib/aviation-units";

export type ImportReviewEvent={position:number;label:string;kind:"takeoff"|"landing"|"touch-and-go"|"split";detail?:string};
type Sample=TrackPoint&{distance:number;speed:number;bearing:number};
const rad=Math.PI/180;

function leg(a:TrackPoint,b:TrackPoint){const dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad,q=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;return 12742.0176*Math.asin(Math.sqrt(q))}
function bearing(a:TrackPoint,b:TrackPoint){const y=Math.sin((b.lon-a.lon)*rad)*Math.cos(b.lat*rad),x=Math.cos(a.lat*rad)*Math.sin(b.lat*rad)-Math.sin(a.lat*rad)*Math.cos(b.lat*rad)*Math.cos((b.lon-a.lon)*rad);return(Math.atan2(y,x)/rad+360)%360}
function elapsed(a?:string,b?:string){if(!a||!b)return 0;const ms=Date.parse(b)-Date.parse(a);return Number.isFinite(ms)&&ms>0?ms/3600000:0}
function median(values:number[]){const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!sorted.length)return 0;const middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2}
function windowedSpeed(points:TrackPoint[],index:number){let start=Math.max(0,index-2),end=Math.min(points.length-1,index+2);if(end===start)return 0;const hours=elapsed(points[start]?.time,points[end]?.time);if(!hours)return 0;let distance=0;for(let i=start+1;i<=end;i++)distance+=leg(points[i-1],points[i]);const value=distance/hours;return Number.isFinite(value)&&value>=0&&value<=2500?value:0}
function smooth(values:number[]){return values.map((value,index)=>{const local=values.slice(Math.max(0,index-2),Math.min(values.length,index+3)).filter(candidate=>candidate>=0&&candidate<=2500);return local.length>=3?median(local):value})}
function chartPath(values:number[],width:number,height:number){const finite=values.filter(Number.isFinite),lo=Math.min(...finite,0),hi=Math.max(...finite,1),range=hi-lo||1;return values.map((value,index)=>`${index/Math.max(1,values.length-1)*width},${height-(value-lo)/range*height}`).join(" ")}
const clamp=(value:number)=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));

export function GpsImportReviewPlayer({track,events=[]}:{track:MapTrack;events?:ImportReviewEvent[]}){
  const theme=useResolvedTheme(),palette=mapThemePalette(theme);
  const points=track.points;
  const samples=useMemo<Sample[]>(()=>{const speeds=smooth(points.map((_,index)=>windowedSpeed(points,index)));let distance=0;return points.map((point,index)=>{const prev=points[index-1],next=points[index+1];if(prev)distance+=leg(prev,point);return{...point,distance,speed:speeds[index]??0,bearing:prev?bearing(prev,point):next?bearing(point,next):0}})},[points]);
  const cleanEvents=useMemo(()=>events.map(event=>({...event,position:clamp(event.position)})).sort((a,b)=>a.position-b.position),[events]);
  const target=useRef<HTMLDivElement>(null),mapRef=useRef<L.Map|null>(null),markerRef=useRef<L.Marker|null>(null);
  const[cursor,setCursor]=useState(0),[playing,setPlaying]=useState(false),[rate,setRate]=useState(1);
  const max=Math.max(0,samples.length-1),index=Math.min(max,Math.floor(cursor)),fraction=cursor-index,a=samples[index],b=samples[Math.min(max,index+1)]??a;
  const current=a&&b?{...a,lat:a.lat+(b.lat-a.lat)*fraction,lon:a.lon+(b.lon-a.lon)*fraction,alt:Number(a.alt??0)+(Number(b.alt??a.alt??0)-Number(a.alt??0))*fraction,speed:a.speed+(b.speed-a.speed)*fraction,bearing:b.bearing||a.bearing,distance:a.distance+(b.distance-a.distance)*fraction}:null;

  useEffect(()=>{if(!target.current||samples.length<2)return;const map=L.map(target.current,{preferCanvas:true,zoomControl:true});mapRef.current=map;addFlyTallyBasemap(map);const renderer=L.canvas({padding:.3}),ll=points.map(point=>L.latLng(point.lat,point.lon)),bounds=L.latLngBounds(ll);L.polyline(ll,{color:palette.route,weight:3,opacity:.92,renderer}).addTo(map);const icon=createAircraftMarkerIcon();markerRef.current=L.marker([samples[0].lat,samples[0].lon],{icon,zIndexOffset:1000}).addTo(map);map.fitBounds(bounds,{padding:[24,24],maxZoom:13});const cleanup=installResponsiveMap(map,target.current);return()=>{cleanup();map.remove();mapRef.current=null;markerRef.current=null}},[points,samples,theme]);
  useEffect(()=>{if(!current||!markerRef.current)return;markerRef.current.setLatLng([current.lat,current.lon]);rotateAircraftMarker(markerRef.current,current.bearing,{smooth:true})},[current]);
  useEffect(()=>{if(!playing||max<1)return;let frame=0,last=performance.now();const tick=(now:number)=>{const dt=Math.min(100,now-last);last=now;setCursor(value=>{const next=value+dt/1000*rate*Math.max(1,max/90);if(next>=max){setPlaying(false);return max}return next});frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)},[playing,max,rate]);
  if(samples.length<2)return null;

  const seek=(position:number)=>{setPlaying(false);setCursor(clamp(position)*max)};
  const width=1000,height=150,alts=samples.map(point=>Number(point.alt??0)),speeds=samples.map(point=>point.speed),altLine=chartPath(alts,width,height),speedLine=chartPath(speeds,width,height),cursorX=max?cursor/max*width:0,maxAlt=alts.length?Math.max(...alts):0,maxSpeed=speeds.length?Math.max(...speeds):0;
  return <section className="track-player-suite import-review-player">
    <div ref={target} className="track-map responsive-map import-review-map" style={{"--map-height":"390px"} as React.CSSProperties} aria-label="GPS import review map"/>
    <div className="panel track-profile">
      <div className="section-heading"><div><p className="eyebrow">VISUAL GPS REVIEW</p><h2>Altitude, speed and detected events</h2><p className="muted">Play or scrub the track. Select any event marker to move the aircraft to that position.</p></div><div className="track-stats"><span>{samples.at(-1)?.distance.toFixed(1)} km</span><span>{samples.length} points</span><span>max {metersToFeet(maxAlt)} ft</span><span>max {Math.round(maxSpeed)} km/h</span></div></div>
      <div className="combined-profile-chart import-profile-chart"><div className="profile-legend"><span><i className="alt-line"/>Altitude</span><span><i className="speed-line"/>Speed</span><small>Markers are advisory GPS detections.</small></div><div className="profile-chart-stage"><svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"><polyline points={altLine} fill="none" stroke="var(--chart-primary)" strokeWidth="3" vectorEffect="non-scaling-stroke"/><polyline points={speedLine} fill="none" stroke="var(--chart-secondary)" strokeWidth="3" vectorEffect="non-scaling-stroke"/><line x1={cursorX} x2={cursorX} y1="0" y2={height} stroke="var(--chart-cursor)" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg><div className="profile-event-layer" aria-label="Detected GPS events">{cleanEvents.map((event,eventIndex)=><button type="button" key={`${event.kind}-${event.position}-${eventIndex}`} className={`profile-event-marker ${event.kind}`} style={{left:`${event.position*100}%`}} onClick={()=>seek(event.position)} title={event.detail?`${event.label} · ${event.detail}`:event.label}><span>{event.label}</span></button>)}</div></div></div>
      {cleanEvents.length?<div className="import-event-strip">{cleanEvents.map((event,eventIndex)=><button type="button" key={`key-${event.kind}-${event.position}-${eventIndex}`} className={event.kind} onClick={()=>seek(event.position)}><b>{event.label}</b>{event.detail?<small>{event.detail}</small>:null}</button>)}</div>:null}
      <div className="player-controls"><button type="button" className="play-button" aria-label={playing?"Pause track":"Play track"} onClick={()=>{if(cursor>=max)setCursor(0);setPlaying(value=>!value)}}><NavIcon name={playing?"pause":"play"}/></button><input aria-label="Track position" type="range" min="0" max={max} step="0.01" value={cursor} onChange={event=>{setPlaying(false);setCursor(Number(event.target.value))}}/><select aria-label="Playback speed" value={rate} onChange={event=>setRate(Number(event.target.value))}><option value="1">1×</option><option value="2">2×</option><option value="5">5×</option><option value="10">10×</option></select><div><strong>{current?.distance.toFixed(1)} km</strong><small>{current?.time?new Date(current.time).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit",timeZone:"UTC"})+" UTC":`track position ${Math.round((max?cursor/max:0)*100)}%`}</small><small>{metersToFeet(current?.alt||0)} ft · {Math.round(current?.speed||0)} km/h</small></div></div>
    </div>
  </section>;
}
