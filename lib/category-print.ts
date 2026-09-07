import { resolveRegulatoryAircraftCategory,type RegulatoryAircraftCategory } from "./aircraft-category.ts";
import { isAuxiliaryLogbookRole,type LogbookOutputCategory } from "./logbook-print.ts";

export type CategoryPrintRecord=Record<string,unknown>&{regulatory_category:RegulatoryAircraftCategory};
export type CategoryPrintTotals={flights:number;minutes:number;picMinutes:number;dualMinutes:number;instructorMinutes:number;movements:number;landings:number};

const n=(value:unknown)=>Math.max(0,Math.round(Number(value)||0));

export function resolveCategoryPrintRecord<T extends Record<string,unknown>>(row:T):T&{regulatory_category:RegulatoryAircraftCategory}{
  return {...row,regulatory_category:resolveRegulatoryAircraftCategory({regulatoryCategory:row.regulatory_category,aircraftClass:row.aircraft_class,evidence:row.evidence})};
}

export function categoryPrintLoggedMinutes(row:Record<string,unknown>){
  if(isAuxiliaryLogbookRole(row.role))return 0;
  const category=resolveRegulatoryAircraftCategory({regulatoryCategory:row.regulatory_category,aircraftClass:row.aircraft_class,evidence:row.evidence});
  const block=n(row.block_minutes),air=n(row.air_minutes);
  return (category==="SAILPLANE"||category==="BALLOON")&&air>0?air:block;
}

export function selectCategoryPrintRecords<T extends Record<string,unknown>>(rows:T[],category:LogbookOutputCategory){
  const resolved=rows.map(resolveCategoryPrintRecord);
  return category==="all"?resolved:resolved.filter(row=>row.regulatory_category===category);
}

export function partitionCategoryPrintRecords<T extends CategoryPrintRecord>(rows:T[]){
  return{
    fcl:rows.filter(row=>row.regulatory_category!=="SAILPLANE"&&row.regulatory_category!=="BALLOON"&&row.regulatory_category!=="OTHER"),
    sailplane:rows.filter(row=>row.regulatory_category==="SAILPLANE"),
    balloon:rows.filter(row=>row.regulatory_category==="BALLOON"),
    other:rows.filter(row=>row.regulatory_category==="OTHER"),
  };
}

export function categoryPrintMovementCount(row:Record<string,unknown>){
  const category=resolveRegulatoryAircraftCategory({regulatoryCategory:row.regulatory_category,aircraftClass:row.aircraft_class,evidence:row.evidence});
  if(category==="SAILPLANE"&&String(row.aircraft_class??"").trim().toUpperCase()!=="TMG")return n(row.launches);
  return n(row.takeoffs_day)+n(row.takeoffs_night);
}

export function categoryPrintTotals(rows:Array<Record<string,unknown>>):CategoryPrintTotals{
  return rows.reduce<CategoryPrintTotals>((total,row)=>({
    flights:total.flights+1,
    minutes:total.minutes+categoryPrintLoggedMinutes(row),
    picMinutes:total.picMinutes+(isAuxiliaryLogbookRole(row.role)?0:n(row.pic_minutes)),
    dualMinutes:total.dualMinutes+(isAuxiliaryLogbookRole(row.role)?0:n(row.dual_minutes)),
    instructorMinutes:total.instructorMinutes+(isAuxiliaryLogbookRole(row.role)?0:n(row.instructor_minutes)),
    movements:total.movements+(isAuxiliaryLogbookRole(row.role)?0:categoryPrintMovementCount(row)),
    landings:total.landings+(isAuxiliaryLogbookRole(row.role)?0:n(row.landings_day)+n(row.landings_night)),
  }),{flights:0,minutes:0,picMinutes:0,dualMinutes:0,instructorMinutes:0,movements:0,landings:0});
}

export function paginateCategoryPrintRecords<T>(rows:T[],rowsPerPage=14){
  const size=Math.max(1,Math.min(20,Math.floor(rowsPerPage)||14)),pages:T[][]=[];
  for(let offset=0;offset<rows.length;offset+=size)pages.push(rows.slice(offset,offset+size));
  return pages;
}
