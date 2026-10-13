/**
 * Read-only candidate ISO 4217 monetary registry, pinned to a dated SIX XML mirror.
 * NOT wired to production writers. Direct SIX-source verification remains a release gate.
 * No FX, no fallback to current account preference for legacy values.
 */
import {ISO4217_ACTIVE_MONETARY_ROWS,ISO4217_CURRENCY_SOURCE} from "./iso4217-currency-data.ts";
import {calculateBilledMoney,parseMoneyAmount,type MoneyCalculationResult,type MoneyResult} from "./monetary-amount.ts";

export {ISO4217_CURRENCY_SOURCE};
export type MonetaryCurrency=Readonly<{
  code:string;
  name:string;
  numericCode:string;
  minorUnits:number;
}>;
export type RegistryMoneyResult=MoneyResult|{ok:false;reason:"unsupported-currency"};
export type RegistryCalculationResult=MoneyCalculationResult|{ok:false;reason:"unsupported-currency"};

const current:readonly MonetaryCurrency[]=Object.freeze(ISO4217_ACTIVE_MONETARY_ROWS.map(([code,name,numericCode,minorUnits])=>
  Object.freeze({code,name,numericCode,minorUnits})
));
const index=new Map(current.map(item=>[item.code,item]));
if(index.size!==current.length)throw new Error("Duplicated currency code in pinned registry");
const popular=["CZK","EUR","USD","GBP","CHF","PLN","JPY","KWD"];
const rank=(code:string)=>{const index=popular.indexOf(code);return index<0?popular.length:index};
const sorted=Object.freeze([...current].sort((a,b)=>rank(a.code)-rank(b.code)||(a.code<b.code?-1:a.code>b.code?1:0)));

export function supportedIsoCurrency(code:unknown):MonetaryCurrency|null{
  if(typeof code!=="string")return null;
  const normalized=code.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized)?index.get(normalized)??null:null;
}

/** The full current monetary list; fund/metal/test/no-currency entries are excluded. */
export function listSupportedIsoCurrencies():readonly MonetaryCurrency[]{
  return sorted;
}

const normalizedSearch=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
/** Small searchable preview. For the complete picker use listSupportedIsoCurrencies(). */
export function searchSupportedIsoCurrencies(term:unknown,limit=30):readonly MonetaryCurrency[]{
  if(typeof term!=="string"||!Number.isSafeInteger(limit)||limit<1||limit>500)return[];
  const needle=normalizedSearch(term.trim());
  const matches=needle?sorted.filter(item=>normalizedSearch(item.code+" "+item.name+" "+item.numericCode).includes(needle)):sorted;
  return matches.slice(0,limit);
}

export function parseSupportedCurrencyAmount(amount:unknown,code:unknown):RegistryMoneyResult{
  const currency=supportedIsoCurrency(code);
  return currency?parseMoneyAmount(amount,currency):{ok:false,reason:"unsupported-currency"};
}

export function calculateSupportedCurrencyFlightCost(rate:unknown,minutes:unknown,share:unknown,code:unknown):RegistryCalculationResult{
  const currency=supportedIsoCurrency(code);
  return currency?calculateBilledMoney(rate,minutes,share,currency):{ok:false,reason:"unsupported-currency"};
}
