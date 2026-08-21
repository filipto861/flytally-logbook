import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type CatalogAirport={ident:string;name:string;lat:number;lon:number;type:string;municipality:string;country:string;region:string};
let cache:CatalogAirport[]|null=null;
let byIdent:Map<string,CatalogAirport>|null=null;

function cells(line:string){const out:string[]=[];let value="",quoted=false;for(let i=0;i<line.length;i++){const char=line[i];if(char==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++}else quoted=!quoted}else if(char===','&&!quoted){out.push(value);value=""}else value+=char}out.push(value);return out}
function load(){if(cache)return cache;let source="";try{source=readFileSync(join(process.cwd(),"data","airports.csv"),"utf8")}catch{cache=[];byIdent=new Map();return cache}const lines=source.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean);if(lines.length<2){cache=[];byIdent=new Map();return cache}const header=cells(lines[0]),at=(name:string)=>header.indexOf(name),identAt=at("ident"),nameAt=at("name"),latAt=at("latitude_deg"),lonAt=at("longitude_deg"),typeAt=at("type"),municipalityAt=at("municipality"),countryAt=at("iso_country"),regionAt=at("iso_region");const list:CatalogAirport[]=[];const index=new Map<string,CatalogAirport>();for(const line of lines.slice(1)){const row=cells(line);if(row[typeAt]==="closed")continue;const ident=String(row[identAt]||"").trim().toUpperCase(),lat=Number(row[latAt]),lon=Number(row[lonAt]);if(!ident||!Number.isFinite(lat)||!Number.isFinite(lon))continue;const airport={ident,name:String(row[nameAt]||""),lat,lon,type:String(row[typeAt]||""),municipality:String(row[municipalityAt]||""),country:String(row[countryAt]||"").toUpperCase(),region:String(row[regionAt]||"").toUpperCase()};list.push(airport);index.set(ident,airport)}list.sort((a,b)=>a.ident.localeCompare(b.ident));cache=list;byIdent=index;return list}

export function airportCatalogSize(){return load().length}
export function getCatalogAirport(ident:string){load();return byIdent?.get(ident.trim().toUpperCase())??null}
export function searchAirportCatalog(query:string,page=1,size=50){
  const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean).slice(0,8),safeSize=Math.max(10,Math.min(100,Math.floor(size))),all=load();
  const matches=terms.length?all.filter(airport=>{const haystack=`${airport.ident} ${airport.name} ${airport.municipality} ${airport.country} ${airport.region} ${airport.type}`.toLocaleLowerCase();return terms.every(term=>haystack.includes(term))}):all;
  const pages=Math.max(1,Math.ceil(matches.length/safeSize)),safePage=Math.max(1,Math.min(pages,Math.floor(page)||1)),offset=(safePage-1)*safeSize;
  return{rows:matches.slice(offset,offset+safeSize),total:matches.length,page:safePage,pages,size:safeSize};
}
function distanceKm(lat1:number,lon1:number,lat2:number,lon2:number){const p=Math.PI/180,dLat=(lat2-lat1)*p,dLon=(lon2-lon1)*p,q=Math.sin(dLat/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin(dLon/2)**2;return 12742.0176*Math.asin(Math.sqrt(q))}
export function nearestCatalogAirport(candidates:Array<{lat:number;lon:number}>,maxKm=35){let best:{airport:CatalogAirport;distanceKm:number}|null=null;for(const airport of load())for(const point of candidates){const distance=distanceKm(point.lat,point.lon,airport.lat,airport.lon);if(!best||distance<best.distanceKm)best={airport,distanceKm:distance}}return best&&best.distanceKm<=maxKm?{...best.airport,distanceKm:Math.round(best.distanceKm*10)/10}:null}
