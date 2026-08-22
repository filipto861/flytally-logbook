import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { airportCandidateScore } from "@/lib/track-processing";
import { isLegacyCzechAirportIdent,preferredAirportCode } from "@/lib/airport-code";

export type CatalogAirport={ident:string;name:string;lat:number;lon:number;type:string;municipality:string;country:string;region:string};
export type AirportCodeMigration={from:string;to:string;name:string};
let cache:CatalogAirport[]|null=null;
let byIdent:Map<string,CatalogAirport>|null=null;

function cells(line:string){const out:string[]=[];let value="",quoted=false;for(let i=0;i<line.length;i++){const char=line[i];if(char==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++}else quoted=!quoted}else if(char===','&&!quoted){out.push(value);value=""}else value+=char}out.push(value);return out}
function load(){if(cache)return cache;let source="";try{source=readFileSync(join(process.cwd(),"data","airports.csv"),"utf8")}catch{cache=[];byIdent=new Map();return cache}const lines=source.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean);if(lines.length<2){cache=[];byIdent=new Map();return cache}const header=cells(lines[0]),at=(name:string)=>header.indexOf(name),identAt=at("ident"),icaoAt=at("icao_code"),gpsAt=at("gps_code"),localAt=at("local_code"),nameAt=at("name"),latAt=at("latitude_deg"),lonAt=at("longitude_deg"),typeAt=at("type"),municipalityAt=at("municipality"),countryAt=at("iso_country"),regionAt=at("iso_region");const list:CatalogAirport[]=[];const index=new Map<string,CatalogAirport>();for(const line of lines.slice(1)){const row=cells(line);if(row[typeAt]==="closed")continue;const aliasValues={icao:icaoAt>=0?row[icaoAt]:"",gps:gpsAt>=0?row[gpsAt]:"",local:localAt>=0?row[localAt]:"",ident:identAt>=0?row[identAt]:""},aliases=[aliasValues.icao,aliasValues.gps,aliasValues.local,aliasValues.ident].map(value=>String(value||"").trim().toUpperCase()).filter(Boolean),ident=preferredAirportCode(aliasValues),lat=Number(row[latAt]),lon=Number(row[lonAt]);if(!ident||!Number.isFinite(lat)||!Number.isFinite(lon))continue;const airport={ident,name:String(row[nameAt]||""),lat,lon,type:String(row[typeAt]||""),municipality:String(row[municipalityAt]||""),country:String(row[countryAt]||"").toUpperCase(),region:String(row[regionAt]||"").toUpperCase()};list.push(airport);for(const alias of aliases)index.set(alias,airport)}list.sort((a,b)=>a.ident.localeCompare(b.ident));cache=list;byIdent=index;return list}

export function airportCatalogSize(){return load().length}
export function getCatalogAirport(ident:string){load();return byIdent?.get(ident.trim().toUpperCase())??null}
export function canonicalAirportIdent(ident:string){const value=ident.trim().toUpperCase();return value?(getCatalogAirport(value)?.ident??value):""}
export function airportCodeMigrations(idents:string[]){
  const migrations=new Map<string,AirportCodeMigration>();
  for(const raw of idents){
    const from=raw.trim().toUpperCase();if(!isLegacyCzechAirportIdent(from))continue;
    const airport=getCatalogAirport(from),to=airport?.ident??"";
    if(to&&to!==from)migrations.set(from,{from,to,name:airport?.name??""});
  }
  return [...migrations.values()].sort((a,b)=>a.from.localeCompare(b.from));
}
export function searchAirportCatalog(query:string,page=1,size=50){
  const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean).slice(0,8),safeSize=Math.max(10,Math.min(100,Math.floor(size))),all=load();
  const matches=terms.length?all.filter(airport=>{const haystack=`${airport.ident} ${airport.name} ${airport.municipality} ${airport.country} ${airport.region} ${airport.type}`.toLocaleLowerCase();return terms.every(term=>haystack.includes(term))}):all;
  const pages=Math.max(1,Math.ceil(matches.length/safeSize)),safePage=Math.max(1,Math.min(pages,Math.floor(page)||1)),offset=(safePage-1)*safeSize;
  return{rows:matches.slice(offset,offset+safeSize),total:matches.length,page:safePage,pages,size:safeSize};
}
export function nearestCatalogAirport(candidates:Array<{lat:number;lon:number}>,maxKm=35){let best:{airport:CatalogAirport;distanceKm:number;score:number}|null=null;for(const airport of load()){const ranked=airportCandidateScore(candidates,airport);if(ranked.distanceKm<=maxKm&&(!best||ranked.score<best.score))best={airport,distanceKm:ranked.distanceKm,score:ranked.score}}return best?{...best.airport,distanceKm:Math.round(best.distanceKm*10)/10}:null}
