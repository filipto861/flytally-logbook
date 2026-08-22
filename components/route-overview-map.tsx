"use client";

import { useEffect,useRef,type CSSProperties } from "react";
import L from "leaflet";
import type { MapAirport,RouteLine } from "@/lib/data/tracks";
import { installResponsiveMap } from "@/components/leaflet-mobile";

export function RouteOverviewMap({routes,airports,height=650}:{routes:RouteLine[];airports:MapAirport[];height?:number}){
  const target=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!target.current)return;
    const map=L.map(target.current,{preferCanvas:true,zoomControl:true});
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{maxZoom:20,attribution:"&copy; OpenStreetMap contributors &copy; CARTO"}).addTo(map);
    const renderer=L.canvas({padding:.3}),bounds=L.latLngBounds([]),maxFlights=Math.max(1,...routes.map(route=>route.flights));
    routes.forEach(route=>{const points=[L.latLng(route.from.lat,route.from.lon),L.latLng(route.to.lat,route.to.lon)];points.forEach(point=>bounds.extend(point));const pair=`${route.departure}↔${route.arrival}`,url=`/flights?routePair=${encodeURIComponent(pair)}`,open=()=>window.location.assign(url),weight=1.5+4*Math.sqrt(route.flights/maxFlights);const line=L.polyline(points,{color:"#38bdf8",weight,opacity:.38+.5*Math.sqrt(route.flights/maxFlights),renderer,interactive:false}).addTo(map);const hit=L.polyline(points,{color:"#38bdf8",weight:Math.max(18,weight+12),opacity:.001,renderer,bubblingMouseEvents:false}).addTo(map);hit.bindTooltip(`${route.departure} ↔ ${route.arrival} · ${route.flights} letů · klepnutím zobrazit`,{sticky:true});hit.on("mouseover",()=>line.setStyle({color:"#6ee7b7",opacity:1}));hit.on("mouseout",()=>line.setStyle({color:"#38bdf8",opacity:.38+.5*Math.sqrt(route.flights/maxFlights)}));hit.on("click",open)});
    airports.forEach(airport=>{const point=L.latLng(airport.lat,airport.lon);bounds.extend(point);const marker=L.circleMarker(point,{radius:Math.min(11,4+Math.sqrt(airport.flights)),color:"#34d399",weight:2,fillColor:"#07111f",fillOpacity:.92}).addTo(map);const url=`/flights?airport=${encodeURIComponent(airport.ident)}`;marker.bindTooltip(`${airport.ident}${airport.name?` · ${airport.name}`:""} · ${airport.flights} pohybů`,{direction:"top"});marker.on("click",()=>window.location.assign(url))});
    if(bounds.isValid())map.fitBounds(bounds,{padding:[30,30],maxZoom:8});else map.setView([49.8,15.5],7);
    const cleanupResponsive=installResponsiveMap(map,target.current);
    return()=>{cleanupResponsive();map.remove()};
  },[routes,airports]);
  return <div ref={target} className="track-map route-overview-map responsive-map" style={{"--map-height":`${height}px`} as CSSProperties} aria-label="Přehledová mapa letišť a přímých tratí"/>;
}
