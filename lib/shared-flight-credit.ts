import { resolveRegulatoryAircraftCategory } from "./aircraft-category.ts";
import { flightMinutes } from "./dashboard-math.ts";

export function sharedFlightCreditMinutes(row:Record<string,unknown>){
  const block=flightMinutes(String(row.off_block??"").trim(),String(row.on_block??"").trim());
  const air=flightMinutes(String(row.takeoff??"").trim(),String(row.landing??"").trim());
  const category=resolveRegulatoryAircraftCategory({regulatoryCategory:row.regulatory_category,aircraftClass:row.aircraft_class,evidence:row.evidence});
  return category==="SAILPLANE"||category==="BALLOON"?(air||block):block;
}