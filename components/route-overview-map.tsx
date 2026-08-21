"use client";

import { useEffect,useRef } from "react";
import L from "leaflet";
import type { MapAirport,RouteLine } from "@/lib/data/tracks";

export function RouteOverviewMap({routes,airports,height=650}:{routes:RouteLine[];airports:MapAirport[];height?:number}){
  const target=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!target.current)return;
    const map=L.map(target.current,{preferCanvas:true,zoomControl:true});
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{maxZoom:20,attribution:"&copy; OpenStreetMap contributors &copy; CARTO"}).addTo(map);
    const bounds=L.latLngBounds([]),maxFlights=Math.max(1,...routes.map(route=>route.flights));
    routes.forEach(route=>{const points=[L.latLng(route.from.lat,route.from.lon),L.latLng(route.to.lat,route.to.lon)];points.forEach(point=>bounds.extend(point));const url=`/flights?route=${encodeURIComponent(`${route.departure}→${route.arrival}`)}`;const line=L.polyline(points,{color:"#38bdf8",weight:1.5+4*Math.sqrt(route.flights/maxFlights),opacity:.38+.5*Math.sqrt(route.flights/maxFlights),renderer:L.canvas()}).addTo(map);line.bindTooltip(`${route.departure} → ${route.arrival} · ${route.flights} letů`,{sticky:true});line.on("click",()=>window.location.assign(url))});
    airports.forEach(airport=>{const point=L.latLng(airport.lat,airport.lon);bounds.extend(point);const marker=L.circleMarker(point,{radius:Math.min(11,4+Math.sqrt(airport.flights)),color:"#34d399",weight:2,fillColor:"#07111f",fillOpacity:.92}).addTo(map);const url=`/flights?airport=${encodeURIComponent(airport.ident)}`;marker.bindTooltip(`${airport.ident}${airport.name?` · ${airport.name}`:""} · ${airport.flights} pohybů`,{direction:"top"});marker.on("click",()=>window.location.assign(url))});
    if(bounds.isValid())map.fitBounds(bounds,{padding:[30,30],maxZoom:8});else map.setView([49.8,15.5],7);
    return()=>{map.remove()};
  },[routes,airports]);
  return <div ref={target} className="track-map route-overview-map" style={{height}} aria-label="Přehledová mapa letišť a přímých tratí"/>;
}
