import catalogData from "@/data/aircraft-type-catalog.json";
import { rankAircraftTypes,type AircraftTypeCatalogEntry } from "@/lib/aircraft-type-search";

const catalog=catalogData as AircraftTypeCatalogEntry[];

export function aircraftTypeCatalogSize(){return catalog.length}
export function searchAircraftTypes(query:string,limit=12){return rankAircraftTypes(catalog,query,limit)}
export function aircraftTypeByDesignator(icao:string){const key=String(icao??"").trim().toUpperCase();return catalog.filter(entry=>entry.icao===key)}
