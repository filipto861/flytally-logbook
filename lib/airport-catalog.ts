import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type CatalogAirport={ident:string;name:string;lat:number;lon:number};
let cache:CatalogAirport[]|null=null;
let byIdent:Map<string,CatalogAirport>|null=null;

function cells(line:string){const out:string[]=[];let value="",quoted=false;for(let i=0;i<line.length;i++){const char=line[i];if(char==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++}else quoted=!quoted}else if(char===','&&!quoted){out.push(value);value=""}else value+=char}out.push(value);return out}
function load(){if(cache)return cache;let source="";try{source=readFileSync(join(process.cwd(),"data","airports.csv"),"utf8")}catch{cache=[];byIdent=new Map();return cache}const lines=source.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean);if(lines.length<2){cache=[];byIdent=new Map();return cache}const header=cells(lines[0]),at=(name:string)=>header.indexOf(name),identAt=at("ident"),nameAt=at("name"),latAt=at("latitude_deg"),lonAt=at("longitude_deg"),typeAt=at("type");const list:CatalogAirport[]=[];const index=new Map<string,CatalogAirport>();for(const line of lines.slice(1)){const row=cells(line);if(row[typeAt]==="closed")continue;const ident=String(row[identAt]||"").trim().toUpperCase(),lat=Number(row[latAt]),lon=Number(row[lonAt]);if(!ident||!Number.isFinite(lat)||!Number.isFinite(lon))continue;const airport={ident,name:String(row[nameAt]||""),lat,lon};list.push(airport);index.set(ident,airport)}cache=list;byIdent=index;return list}

export function airportCatalogSize(){return load().length}
export function getCatalogAirport(ident:string){load();return byIdent?.get(ident.trim().toUpperCase())??null}
function distanceKm(lat1:number,lon1:number,lat2:number,lon2:number){const p=Math.PI/180,dLat=(lat2-lat1)*p,dLon=(lon2-lon1)*p,q=Math.sin(dLat/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin(dLon/2)**2;return 12742.0176*Math.asin(Math.sqrt(q))}
export function nearestCatalogAirport(candidates:Array<{lat:number;lon:number}>,maxKm=35){let best:{airport:CatalogAirport;distanceKm:number}|null=null;for(const airport of load())for(const point of candidates){const distance=distanceKm(point.lat,point.lon,airport.lat,airport.lon);if(!best||distance<best.distanceKm)best={airport,distanceKm:distance}}return best&&best.distanceKm<=maxKm?{...best.airport,distanceKm:Math.round(best.distanceKm*10)/10}:null}
