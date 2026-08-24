export type EasaPrintRecord=Record<string,unknown>&{kind:"flight"|"fstd";sortKey:string};

export type EasaPageTotals={
  spSe:number;spMe:number;mp:number;flight:number;landingsDay:number;landingsNight:number;
  night:number;ifr:number;pic:number;copilot:number;dual:number;instructor:number;fstd:number;
};

export const emptyEasaPageTotals=():EasaPageTotals=>({spSe:0,spMe:0,mp:0,flight:0,landingsDay:0,landingsNight:0,night:0,ifr:0,pic:0,copilot:0,dual:0,instructor:0,fstd:0});
const n=(value:unknown)=>Math.max(0,Math.round(Number(value)||0));

export function totalsForEasaRecord(row:EasaPrintRecord):EasaPageTotals{
  const out=emptyEasaPageTotals();
  if(row.kind==="fstd"){out.fstd=n(row.total_minutes);return out;}
  const flight=n(row.block_minutes),operation=String(row.operation_type??"SP").trim().toUpperCase(),engine=String(row.engine_type??"SE").trim().toUpperCase();
  if(operation==="MP")out.mp=flight;else if(engine==="ME")out.spMe=flight;else out.spSe=flight;
  out.flight=flight;out.landingsDay=n(row.landings_day);out.landingsNight=n(row.landings_night);out.night=n(row.night_minutes);out.ifr=n(row.ifr_minutes);out.pic=n(row.pic_minutes);out.copilot=n(row.copilot_minutes);out.dual=n(row.dual_minutes);out.instructor=n(row.instructor_minutes);
  return out;
}

export function addEasaPageTotals(a:EasaPageTotals,b:EasaPageTotals):EasaPageTotals{
  return {spSe:a.spSe+b.spSe,spMe:a.spMe+b.spMe,mp:a.mp+b.mp,flight:a.flight+b.flight,landingsDay:a.landingsDay+b.landingsDay,landingsNight:a.landingsNight+b.landingsNight,night:a.night+b.night,ifr:a.ifr+b.ifr,pic:a.pic+b.pic,copilot:a.copilot+b.copilot,dual:a.dual+b.dual,instructor:a.instructor+b.instructor,fstd:a.fstd+b.fstd};
}

export function sumEasaRecords(rows:EasaPrintRecord[]){return rows.reduce((total,row)=>addEasaPageTotals(total,totalsForEasaRecord(row)),emptyEasaPageTotals())}

export function paginateEasaRecords<T extends EasaPrintRecord>(records:T[],rowsPerPage=10){
  const size=Math.max(1,Math.min(20,Math.floor(rowsPerPage)||10)),pages:Array<{records:T[];pageTotal:EasaPageTotals;previousTotal:EasaPageTotals;runningTotal:EasaPageTotals;blankRows:number}>=[];
  let previous=emptyEasaPageTotals();
  const chunks=Math.max(1,Math.ceil(records.length/size));
  for(let page=0;page<chunks;page++){
    const rows=records.slice(page*size,(page+1)*size),pageTotal=sumEasaRecords(rows),runningTotal=addEasaPageTotals(previous,pageTotal);
    pages.push({records:rows,pageTotal,previousTotal:previous,runningTotal,blankRows:Math.max(0,size-rows.length)});previous=runningTotal;
  }
  return pages;
}
