export type AircraftTypeCatalogEntry={
  icao:string;
  make:string;
  model:string;
  label:string;
  category:string;
  engine:string;
  classHint:""|"SEP"|"MEP"|"SET";
};

const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

export function rankAircraftTypes(catalog:AircraftTypeCatalogEntry[],query:string,limit=12){
  const raw=String(query??"").trim(),needle=normalize(raw),icaoNeedle=raw.toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(!needle)return [];
  const tokens=needle.split(/\s+/).filter(Boolean),ranked:Array<{score:number;index:number;entry:AircraftTypeCatalogEntry}>=[];
  catalog.forEach((entry,index)=>{
    const icao=entry.icao.toUpperCase(),make=normalize(entry.make),model=normalize(entry.model),label=normalize(entry.label);
    let score=999;
    if(icaoNeedle&&icao===icaoNeedle)score=0;
    else if(icaoNeedle.length>=2&&icao.startsWith(icaoNeedle))score=10;
    else if(model===needle)score=15;
    else if(model.startsWith(needle))score=20;
    else if(make===needle)score=25;
    else if(make.startsWith(needle))score=30;
    else if(label.startsWith(needle))score=35;
    else if(tokens.every(token=>label.includes(token)||icao.toLowerCase().includes(token)))score=45;
    else if(label.includes(needle))score=60;
    if(score<999)ranked.push({score,index,entry});
  });
  return ranked.sort((a,b)=>a.score-b.score||a.entry.label.localeCompare(b.entry.label)||a.index-b.index).slice(0,Math.max(1,Math.min(25,limit))).map(item=>item.entry);
}
