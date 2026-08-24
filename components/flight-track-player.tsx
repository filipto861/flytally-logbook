"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import type { MapTrack, TrackPoint } from "@/lib/data/tracks";
import { installResponsiveMap } from "@/components/leaflet-mobile";

type IndexedPoint = TrackPoint & { track: number };
type Sample = TrackPoint & { distance: number; speed: number; bearing: number; track: number };

const rad = Math.PI / 180;
const MAX_SANITY_SPEED_KMH = 2500;
function leg(a: TrackPoint, b: TrackPoint) {
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 12742.0176 * Math.asin(Math.sqrt(q));
}
function bearing(a: TrackPoint, b: TrackPoint) {
  const y = Math.sin((b.lon-a.lon)*rad)*Math.cos(b.lat*rad);
  const x = Math.cos(a.lat*rad)*Math.sin(b.lat*rad)-Math.sin(a.lat*rad)*Math.cos(b.lat*rad)*Math.cos((b.lon-a.lon)*rad);
  return (Math.atan2(y,x)/rad+360)%360;
}
function elapsed(a?: string, b?: string) {
  if (!a || !b) return 0; const ms = Date.parse(b)-Date.parse(a); return Number.isFinite(ms) && ms > 0 ? ms/3600000 : 0;
}
function path(values:number[], width:number, height:number) {
  const finite=values.filter(Number.isFinite), lo=Math.min(...finite,0), hi=Math.max(...finite,1), range=hi-lo||1;
  return values.map((v,i)=>`${i/Math.max(1,values.length-1)*width},${height-(v-lo)/range*height}`).join(" ");
}
function median(values:number[]) {
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!sorted.length)return 0;
  const middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}
function windowedSpeed(points:IndexedPoint[],index:number,radius=2) {
  const track=points[index]?.track;
  let start=index,end=index;
  for(let step=1;step<=radius;step++)if(points[index-step]?.track===track)start=index-step;else break;
  for(let step=1;step<=radius;step++)if(points[index+step]?.track===track)end=index+step;else break;
  if(end===start)return 0;
  const hours=elapsed(points[start]?.time,points[end]?.time);
  if(!hours)return 0;
  let distance=0;
  for(let i=start+1;i<=end;i++)if(points[i-1]?.track===track&&points[i]?.track===track)distance+=leg(points[i-1],points[i]);
  const speed=distance/hours;
  return Number.isFinite(speed)&&speed>=0?speed:0;
}
function smoothTrackSpeeds(points:IndexedPoint[],raw:number[]) {
  const trackBaselines=new Map<number,number>();
  for(const point of points){
    if(trackBaselines.has(point.track))continue;
    const candidates=raw.filter((value,index)=>points[index]?.track===point.track&&value>=5&&value<=MAX_SANITY_SPEED_KMH);
    trackBaselines.set(point.track,median(candidates));
  }
  const cleaned=raw.map((value,index)=>{
    const track=points[index]?.track;
    const baseline=trackBaselines.get(track)??0;
    if(!Number.isFinite(value)||value<0)return 0;
    if(value>MAX_SANITY_SPEED_KMH)return baseline;
    const neighbors:number[]=[];
    for(let i=Math.max(0,index-3);i<=Math.min(raw.length-1,index+3);i++){
      if(i===index||points[i]?.track!==track)continue;
      const candidate=raw[i];
      if(Number.isFinite(candidate)&&candidate>=0&&candidate<=MAX_SANITY_SPEED_KMH)neighbors.push(candidate);
    }
    const local=median(neighbors),reference=local||baseline;
    if(reference>0&&value>Math.max(reference*1.9,reference+140))return reference;
    return value;
  });
  const medianPass=cleaned.map((value,index)=>{
    const track=points[index]?.track;
    const window:number[]=[];
    for(let i=Math.max(0,index-2);i<=Math.min(cleaned.length-1,index+2);i++)if(points[i]?.track===track)window.push(cleaned[i]);
    return window.length>=3?median(window):value;
  });
  const weighted=medianPass.map((value,index)=>{
    const track=points[index]?.track;
    let sum=0,weight=0;
    for(let offset=-3;offset<=3;offset++){
      const i=index+offset;
      if(points[i]?.track!==track)continue;
      const w=4-Math.abs(offset);
      sum+=medianPass[i]*w;weight+=w;
    }
    return weight?Math.max(0,sum/weight):Math.max(0,value);
  });
  return weighted;
}

export function FlightTrackPlayer({tracks}:{tracks:MapTrack[]}) {
  const points=useMemo<IndexedPoint[]>(()=>tracks.flatMap((t,track)=>t.points.map(p=>({...p,track}))),[tracks]);
  const samples=useMemo<Sample[]>(()=>{
    const rawSpeeds=points.map((_,index)=>windowedSpeed(points,index,2));
    const speeds=smoothTrackSpeeds(points,rawSpeeds);
    let distance=0;
    return points.map((p,i)=>{const candidate=points[i-1],prev=candidate?.track===p.track?candidate:undefined,next=points[i+1]?.track===p.track?points[i+1]:undefined;if(prev)distance+=leg(prev,p);return {...p,distance,speed:speeds[i]??0,bearing:prev?bearing(prev,p):next?bearing(p,next):0}})
  },[points]);
  const target=useRef<HTMLDivElement>(null), mapRef=useRef<L.Map|null>(null), markerRef=useRef<L.Marker|null>(null);
  const [cursor,setCursor]=useState(0),[playing,setPlaying]=useState(false),[rate,setRate]=useState(1);
  const max=Math.max(0,samples.length-1), index=Math.min(max,Math.floor(cursor)), fraction=cursor-index, a=samples[index], candidate=samples[Math.min(max,index+1)]??a, b=candidate?.track===a?.track?candidate:a;
  const current=a&&b?{...a,lat:a.lat+(b.lat-a.lat)*fraction,lon:a.lon+(b.lon-a.lon)*fraction,alt:Number(a.alt??0)+(Number(b.alt??a.alt??0)-Number(a.alt??0))*fraction,speed:a.speed+(b.speed-a.speed)*fraction,bearing:b.bearing||a.bearing,distance:a.distance+(b.distance-a.distance)*fraction}:null;

  useEffect(()=>{if(!target.current||!samples.length)return;const map=L.map(target.current,{preferCanvas:true,zoomControl:true});mapRef.current=map;L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{maxZoom:20,attribution:"&copy; OpenStreetMap contributors &copy; CARTO"}).addTo(map);const renderer=L.canvas({padding:.3}),bounds=L.latLngBounds([]);tracks.forEach((track,i)=>{const ll=track.points.map(p=>L.latLng(p.lat,p.lon)),color=i%2?"#38bdf8":"#34d399";ll.forEach(p=>bounds.extend(p));L.polyline(ll,{color,weight:3,opacity:.92,renderer}).addTo(map);const depGap=track.departurePoint?leg(track.departurePoint,track.points[0]):0,arrGap=track.arrivalPoint?leg(track.points.at(-1)!,track.arrivalPoint):0;if(track.departurePoint&&depGap>.35){const c=[L.latLng(track.departurePoint.lat,track.departurePoint.lon),ll[0]];c.forEach(p=>bounds.extend(p));L.polyline(c,{color,weight:2,dashArray:"7 7",opacity:.85,renderer}).addTo(map)}if(track.arrivalPoint&&arrGap>.35){const c=[ll.at(-1)!,L.latLng(track.arrivalPoint.lat,track.arrivalPoint.lon)];c.forEach(p=>bounds.extend(p));L.polyline(c,{color,weight:2,dashArray:"7 7",opacity:.85,renderer}).addTo(map)}});const icon=L.divIcon({className:"aircraft-marker",html:'<span>✈</span>',iconSize:[34,34],iconAnchor:[17,17]});markerRef.current=L.marker([samples[0].lat,samples[0].lon],{icon,zIndexOffset:1000}).addTo(map);map.fitBounds(bounds,{padding:[25,25],maxZoom:13});const cleanupResponsive=installResponsiveMap(map,target.current);return()=>{cleanupResponsive();map.remove();mapRef.current=null;markerRef.current=null}},[samples,tracks]);
  useEffect(()=>{if(!current||!markerRef.current)return;markerRef.current.setLatLng([current.lat,current.lon]);const node=markerRef.current.getElement()?.querySelector("span") as HTMLElement|null;if(node)node.style.transform=`rotate(${current.bearing-90}deg)`},[current]);
  useEffect(()=>{if(!playing||max<1)return;let frame=0,last=performance.now();const tick=(now:number)=>{const dt=Math.min(100,now-last);last=now;setCursor(v=>{const next=v+dt/1000*rate*Math.max(1,max/90);if(next>=max){setPlaying(false);return max}return next});frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)},[playing,max,rate]);
  if(samples.length<2)return null;
  const w=1000,h=150,alts=samples.map(p=>Number(p.alt??0)),speeds=samples.map(p=>p.speed),altLine=path(alts,w,h),speedLine=path(speeds,w,h),x=cursor/max*w;
  return <section className="track-player-suite">
    <div ref={target} className="track-map responsive-map player-responsive-map" style={{"--map-height":"500px"} as React.CSSProperties} aria-label="Synchronized GPS track map"/>
    <div className="panel track-profile"><div className="section-heading"><div><p className="eyebrow">GPS PLAYER</p><h2>Altitude, speed and position</h2></div><div className="track-stats"><span>{samples.at(-1)?.distance.toFixed(1)} km</span><span>{samples.length} points</span><span>max {Math.round(Math.max(...alts)*3.28084)} ft</span><span>max {Math.round(Math.max(...speeds))} km/h</span></div></div>
      <div className="combined-profile-chart"><div className="profile-legend"><span><i className="alt-line"/>Altitude</span><span><i className="speed-line"/>Speed</span></div><svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"><polyline points={altLine} fill="none" stroke="#38bdf8" strokeWidth="3" vectorEffect="non-scaling-stroke"/><polyline points={speedLine} fill="none" stroke="#34d399" strokeWidth="3" vectorEffect="non-scaling-stroke"/><line x1={x} x2={x} y1="0" y2={h} stroke="#f8fafc" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg></div>
      <div className="player-controls"><button type="button" className="play-button" onClick={()=>{if(cursor>=max)setCursor(0);setPlaying(v=>!v)}}>{playing?'❚❚':'▶'}</button><input aria-label="Track position" type="range" min="0" max={max} step="0.01" value={cursor} onChange={e=>{setPlaying(false);setCursor(Number(e.target.value))}}/><select aria-label="Playback speed" value={rate} onChange={e=>setRate(Number(e.target.value))}><option value="1">1×</option><option value="2">2×</option><option value="5">5×</option><option value="10">10×</option></select><div><strong>{current?.distance.toFixed(1)} km</strong><small>{current?.time?new Date(current.time).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit"}):`point ${index+1}`}</small><small>{Math.round(Number(current?.alt||0)*3.28084)} ft · {Math.round(current?.speed||0)} km/h</small></div></div>
    </div>
  </section>;
}
