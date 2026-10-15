import {supportedIsoCurrency} from "./iso4217-currency-registry.ts";

/** Captured rate and denomination are one immutable logical tuple. */
export type CurrencyRateSnapshot={
  price_per_hour:number|null;
  currency_code:string|null;
  currency_minor_units:number|null;
  rate_decimal:string|null;
};

/**
 * No recorded denomination is a valid historical state. An incomplete or
 * inconsistent NEW tuple is not: fail closed, never replace it with zero or
 * silently clear already persisted rate evidence while editing a flight.
 */
export function validateCurrencyRateSnapshot(row:CurrencyRateSnapshot|undefined):CurrencyRateSnapshot|null{
  if(!row)return{price_per_hour:null,currency_code:null,currency_minor_units:null,rate_decimal:null};
  const hasMetadata=[row.currency_code,row.currency_minor_units,row.rate_decimal]
    .some(value=>value!==null&&value!==undefined);
  if(!hasMetadata)return{price_per_hour:row.price_per_hour??null,currency_code:null,currency_minor_units:null,rate_decimal:null};
  const iso=supportedIsoCurrency(row.currency_code);
  if(!iso||row.currency_code!==iso.code
    ||row.currency_minor_units!==iso.minorUnits
    ||typeof row.rate_decimal!=="string"
    ||!/^(?:0|[1-9]\d{0,14})(?:\.\d{1,12})?$/.test(row.rate_decimal)
    ||!/[1-9]/.test(row.rate_decimal)
    ||Number(row.rate_decimal)!==row.price_per_hour
    ||typeof row.price_per_hour!=="number"
    ||!Number.isFinite(row.price_per_hour)
    ||row.price_per_hour<=0)return null;
  return{
    price_per_hour:row.price_per_hour,
    currency_code:iso.code,
    currency_minor_units:iso.minorUnits,
    rate_decimal:row.rate_decimal,
  };
}
