import catalogData from "@/data/aircraft-type-catalog.json";

export type AircraftTypeCatalogEntry={
  icao:string;
  make:string;
  model:string;
  label:string;
  category:string;
  engine:string;
  classHint:""|"SEP"|"MEP"|"SET";
};

const catalog=catalogData as AircraftTypeCatalogEntry[];
const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const searchable=catalog.map((entry,index)=>({entry,index,icao:entry.icao.toUpperCase(),make:normalize(entry.make),model:normalize(entry.model),label:normalize(entry.label)}));

export function aircraftTypeCatalogSize(){return catalog.length}

export function searchAircraftTypes(query:string,limit=12){
  const raw=String(query??"").trim(),needle=normalize(raw),icaoNeedle=raw.toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(!needle)return [];
  const tokens=needle.split(/\s+/).filter(Boolean);
  const ranked:Array<{score:number;index:number;entry:AircraftTypeCatalogEntry}>=[];
  for(const item of searchable){
    let score=999;
    if(icaoNeedle&&item.icao===icaoNeedle)score=0;
    else if(icaoNeedle.length>=2&&item.icao.startsWith(icaoNeedle))score=10;
    else if(item.model===needle)score=15;
    else if(item.model.startsWith(needle))score=20;
    else if(item.make===needle)score=25;
    else if(item.make.startsWith(needle))score=30;
    else if(item.label.startsWith(needle))score=35;
    else if(tokens.every(token=>item.label.includes(token)||item.icao.toLowerCase().includes(token)))score=45;
    else if(item.label.includes(needle))score=60;
    if(score<999)ranked.push({score,index:item.index,entry:item.entry});
  }
  return ranked.sort((a,b)=>a.score-b.score||a.entry.label.localeCompare(b.entry.label)||a.index-b.index).slice(0,Math.max(1,Math.min(25,limit))).map(item=>item.entry);
}

export function aircraftTypeByDesignator(icao:string){
  const key=String(icao??"").trim().toUpperCase();
  return catalog.filter(entry=>entry.icao===key);
}
