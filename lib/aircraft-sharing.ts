import { parseOptionalBilling } from "./billing.ts";
import { parseAircraftDefaultEngineType,parseAircraftDefaultOperationType } from "./aircraft-profile-validation.ts";
import { supportedIsoCurrency } from "./iso4217-currency-registry.ts";
import { validateCurrencyRateSnapshot } from "./currency-rate-snapshot.ts";

type RateBase={aircraftType:string;validFrom:string;pricePerHour:number;dryPricePerHour:number|null;source:string};
export type AircraftShareRate=RateBase&(
  | {rateKind:"legacy-unknown";currencyCode?:never;minorUnits?:never;priceDecimal?:never;dryPriceDecimal?:never}
  | {rateKind:"exact";currencyCode:string;minorUnits:number;priceDecimal:string;dryPriceDecimal:string|null}
);

export type AircraftShareProfile={
  registration:string;
  aircraftType:string;
  aircraftMake:string;
  aircraftModel:string;
  aircraftVariant:string;
  icaoType:string;
  aircraftClass:string;
  regulatoryCategory:string;
  balloonClass:string;
  balloonGroup:string;
  evidence:string;
  partFclCreditClass:string;
  partFclCreditBasis:string;
  partFclCreditFrom:string;
};

export type AircraftShareSnapshot={
  version?:2;
  profile:AircraftShareProfile;
  defaults?:{defaultRole:string;defaultOperationType?:string;defaultEngineType?:string;billingBasis:string;billingError?:string;operationError?:string;engineError?:string};
  currentRate?:AircraftShareRate;
  rateHistory?:AircraftShareRate[];
  rateError?:string;
  note?:string;
};
const text=(value:unknown)=>String(value??"").trim();
const numberOrZero=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)?n:0};
const nullableNumber=(value:unknown)=>{if(value===null||value===undefined||value==="")return null;const n=Number(value);return Number.isFinite(n)?n:null};
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
const populated=(v:unknown)=>v!==null&&v!==undefined;
const validDate=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date);

/** V1 pending shares have no version and carry unknown-denomination numeric values.
 * V2 explicitly distinguishes an exact ISO tuple from a legacy-unknown tuple.
 * An invalid V2 tuple is NOT demoted to legacy. */
function parseShareRate(value:unknown,version:1|2):AircraftShareRate|null{
  const r=object(value),price=version===1?numberOrZero(r.pricePerHour):r.pricePerHour;
  const dry=version===1?nullableNumber(r.dryPricePerHour):r.dryPricePerHour??null;
  if(typeof price!=="number"||!Number.isFinite(price)||price<=0
    ||(dry!==null&&(typeof dry!=="number"||!Number.isFinite(dry)||dry<0)))return null;
  const base:RateBase={aircraftType:text(r.aircraftType),validFrom:text(r.validFrom).slice(0,10),
    pricePerHour:price,dryPricePerHour:dry,source:text(r.source).slice(0,300)};
  if(!validDate(base.validFrom))return null;
  if(version===1)return{...base,rateKind:"legacy-unknown"};
  if(r.rateKind==="legacy-unknown"){
    if(["currencyCode","minorUnits","priceDecimal","dryPriceDecimal"].some(key=>populated(r[key])))return null;
    return{...base,rateKind:"legacy-unknown"};
  }
  if(r.rateKind!=="exact"||typeof r.currencyCode!=="string"||typeof r.priceDecimal!=="string")return null;
  const currency=supportedIsoCurrency(r.currencyCode);
  if(!currency||currency.code!==r.currencyCode||currency.minorUnits!==r.minorUnits
    ||!validateCurrencyRateSnapshot({price_per_hour:price,currency_code:currency.code,
      currency_minor_units:currency.minorUnits,rate_decimal:r.priceDecimal}))return null;
  const dryDecimal=r.dryPriceDecimal??null;
  if(dry===null?dryDecimal!==null:
    typeof dryDecimal!=="string"||!/^(?:0|[1-9]\d{0,14})(?:\.\d{1,12})?$/.test(dryDecimal)
    ||Number(dryDecimal)!==dry)return null;
  return{...base,rateKind:"exact",currencyCode:currency.code,minorUnits:currency.minorUnits,
    priceDecimal:r.priceDecimal,dryPriceDecimal};
}

/** Reusable, fail-closed transport mapping of the DB's legacy+exact columns.
 * The old double is retained only as a compatibility/presentation cache. */
export function encodeAircraftShareRate(source:Record<string,unknown>):AircraftShareRate|null{
  const base={aircraftType:text(source.aircraft_type),validFrom:text(source.valid_from).slice(0,10),
    pricePerHour:Number(source.price_per_hour),dryPricePerHour:source.dry_price_per_hour==null?null:Number(source.dry_price_per_hour),
    source:text(source.source)};
  const keys=["currency_code","currency_minor_units","price_per_hour_decimal","dry_price_per_hour_decimal"];
  if(!keys.some(key=>populated(source[key])))return parseShareRate({...base,rateKind:"legacy-unknown"},2);
  return parseShareRate({...base,rateKind:"exact",currencyCode:source.currency_code,
    minorUnits:source.currency_minor_units,priceDecimal:source.price_per_hour_decimal,
    dryPriceDecimal:source.dry_price_per_hour_decimal},2);
}
export function formatAircraftShareRate(rate:AircraftShareRate):string{
  return rate.rateKind==="exact"?rate.priceDecimal+" "+rate.currencyCode+"/h"
    :rate.pricePerHour.toLocaleString("en-GB")+" (currency unknown)";
}

export function parseAircraftShareSnapshot(value:unknown):AircraftShareSnapshot{
  const root=object(value),profile=object(root.profile),defaults=object(root.defaults),current=object(root.currentRate),history=Array.isArray(root.rateHistory)?root.rateHistory:[];
  const version=root.version===undefined||root.version===1?1:root.version===2?2:0;
  const parsed:AircraftShareSnapshot={profile:{
    registration:text(profile.registration).toUpperCase(),
    aircraftType:text(profile.aircraftType),aircraftMake:text(profile.aircraftMake),
    aircraftModel:text(profile.aircraftModel),aircraftVariant:text(profile.aircraftVariant),
    icaoType:text(profile.icaoType).toUpperCase(),aircraftClass:text(profile.aircraftClass).toUpperCase(),
    regulatoryCategory:text(profile.regulatoryCategory).toUpperCase(),
    balloonClass:text(profile.balloonClass).toUpperCase(),balloonGroup:text(profile.balloonGroup).toUpperCase(),
    evidence:text(profile.evidence).toUpperCase(),partFclCreditClass:text(profile.partFclCreditClass).toUpperCase(),
    partFclCreditBasis:text(profile.partFclCreditBasis).slice(0,300),
    partFclCreditFrom:text(profile.partFclCreditFrom).slice(0,10)
  }};
  if(version===2)parsed.version=2;
  if(Object.keys(defaults).length){const billing=parseOptionalBilling(defaults.billingBasis),
    rawBilling=text(defaults.billingBasis).toUpperCase().slice(0,32),
    operationPresent=Object.prototype.hasOwnProperty.call(defaults,"defaultOperationType"),
    enginePresent=Object.prototype.hasOwnProperty.call(defaults,"defaultEngineType"),
    operation=operationPresent?parseAircraftDefaultOperationType(defaults.defaultOperationType):{value:"" as const},
    engine=enginePresent?parseAircraftDefaultEngineType(defaults.defaultEngineType):{value:"" as const};
    parsed.defaults={defaultRole:text(defaults.defaultRole)||"PIC",
      ...(operationPresent?{defaultOperationType:operation.error?text(defaults.defaultOperationType).toUpperCase().slice(0,16):operation.value||""}:{}),
      ...(enginePresent?{defaultEngineType:engine.error?text(defaults.defaultEngineType).toUpperCase().slice(0,16):engine.value||""}:{}),
      billingBasis:billing.error?rawBilling:billing.value,
      ...(billing.error?{billingError:billing.error}:{}),
      ...(operationPresent&&operation.error?{operationError:operation.error}:{}),
      ...(enginePresent&&engine.error?{engineError:engine.error}:{})}};
  }
  if(!version||history.length>250)parsed.rateError="The shared rate format needs review.";
  else{
    if(Object.keys(current).length){
      const rate=parseShareRate(current,version);
      if(rate)parsed.currentRate=rate;
      else parsed.rateError="The shared current rate is incomplete or invalid.";
    }
    const parsedHistory:AircraftShareRate[]=[];
    for(const item of history){
      const rate=parseShareRate(item,version);
      if(rate)parsedHistory.push(rate);
      else if(version===2)parsed.rateError="The shared rate history is incomplete or invalid.";
    }
    if(parsedHistory.length)parsed.rateHistory=parsedHistory;
  }
  if(typeof root.note==="string")parsed.note=root.note.slice(0,5000);
  return parsed;
}
