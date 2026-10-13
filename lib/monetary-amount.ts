/**
 * Exact non-negative monetary arithmetic. Deliberately independent of a code registry.
 * Callers MUST pass a source-verified currency code and ISO 4217 minor-unit exponent;
 * a syntactically valid alpha-3 code is NOT evidence that a currency is supported.
 *
 * No legacy rate/expense reads are changed by this module. No FX or implicit default.
 */
export type CurrencyPrecision = Readonly<{code:string;minorUnits:number}>;
export type Money = Readonly<{currency:string;minorUnits:number;minor:bigint}>;
export type MoneyResult = {ok:true;money:Money}|{ok:false;reason:"invalid-currency-metadata"|"invalid-amount"|"too-many-decimals"};
export type MoneyCalculationResult = MoneyResult|{ok:false;reason:"invalid-rate"|"invalid-duration"|"invalid-share"};
export type MoneySumResult = MoneyResult|{ok:false;reason:"different-currency"|"different-precision"|"empty-input"};

const validPrecision=(value:CurrencyPrecision):boolean=>
  value!==null&&typeof value==="object"&&/^[A-Z]{3}$/.test(value.code)&&Number.isSafeInteger(value.minorUnits)&&value.minorUnits>=0&&value.minorUnits<=9;

// No exponent syntax, grouping, signs or silent decimal truncation.
function decimalParts(value:unknown):{units:bigint;scale:number}|null{
  if(typeof value!=="string")return null;
  const raw=value.trim();
  if(!/^(?:0|[1-9]\d{0,14})(?:[.,]\d{1,12})?$/.test(raw))return null;
  const [whole,fraction=""]=raw.replace(",",".").split(".");
  return{units:BigInt(whole+fraction),scale:fraction.length};
}
const tenTo=(exponent:number)=>10n**BigInt(exponent);

export function parseMoneyAmount(input:unknown,precision:CurrencyPrecision):MoneyResult{
  if(!validPrecision(precision))return{ok:false,reason:"invalid-currency-metadata"};
  const parsed=decimalParts(input);
  if(!parsed)return{ok:false,reason:"invalid-amount"};
  if(parsed.scale>precision.minorUnits)return{ok:false,reason:"too-many-decimals"};
  return{ok:true,money:{currency:precision.code,minorUnits:precision.minorUnits,minor:parsed.units*tenTo(precision.minorUnits-parsed.scale)}};
}

/** Exact rate × billable minutes / 60 / split; round once, half-up, at currency minor-unit boundary. */
export function calculateBilledMoney(ratePerHour:unknown,minutes:unknown,share:unknown,precision:CurrencyPrecision):MoneyCalculationResult{
  if(!validPrecision(precision))return{ok:false,reason:"invalid-currency-metadata"};
  const rate=decimalParts(ratePerHour);
  if(!rate)return{ok:false,reason:"invalid-rate"};
  if(!Number.isSafeInteger(minutes)||Number(minutes)<0)return{ok:false,reason:"invalid-duration"};
  if(!Number.isSafeInteger(share)||Number(share)<1||Number(share)>20)return{ok:false,reason:"invalid-share"};
  const numerator=rate.units*BigInt(minutes as number)*tenTo(precision.minorUnits);
  const denominator=tenTo(rate.scale)*60n*BigInt(share as number);
  const minor=(numerator*2n+denominator)/(2n*denominator); // >=0; half-up, including exact ties
  return{ok:true,money:{currency:precision.code,minorUnits:precision.minorUnits,minor}};
}

/** Preserves exact integer units; never constructs a JavaScript floating-point number. */
export function formatMoneyAmount(value:Money):string|null{
  if(!validPrecision({code:value.currency,minorUnits:value.minorUnits})||typeof value.minor!=="bigint"||value.minor<0n)return null;
  const exponent=value.minorUnits,base=tenTo(exponent),whole=value.minor/base,fraction=value.minor%base;
  const grouped=whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g,",");
  return exponent===0?`${grouped} ${value.currency}`:`${grouped}.${fraction.toString().padStart(exponent,"0")} ${value.currency}`;
}

/** No conversion or arbitrary equivalence between minor-unit scales. */
export function sumMoneyAmounts(values:readonly Money[]):MoneySumResult{
  if(values.length===0)return{ok:false,reason:"empty-input"};
  const first=values[0];
  if(!validPrecision({code:first.currency,minorUnits:first.minorUnits})||typeof first.minor!=="bigint"||first.minor<0n)return{ok:false,reason:"invalid-amount"};
  let total=0n;
  for(const value of values){
    if(!validPrecision({code:value.currency,minorUnits:value.minorUnits})||typeof value.minor!=="bigint"||value.minor<0n)return{ok:false,reason:"invalid-amount"};
    if(value.currency!==first.currency)return{ok:false,reason:"different-currency"};
    if(value.minorUnits!==first.minorUnits)return{ok:false,reason:"different-precision"};
    total+=value.minor;
  }
  return{ok:true,money:{currency:first.currency,minorUnits:first.minorUnits,minor:total}};
}
