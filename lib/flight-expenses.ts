import {parseSupportedCurrencyAmount,supportedIsoCurrency} from "./iso4217-currency-registry.ts";
import {formatMoneyAmount} from "./monetary-amount.ts";

export const FLIGHT_EXPENSE_CATEGORIES=["LANDING","HANDLING","PARKING","FUEL","OTHER"] as const;
export type FlightExpenseCategory=(typeof FLIGHT_EXPENSE_CATEGORIES)[number];
export type FlightExpenseInput={category:FlightExpenseCategory;label:string;amountMinor:number;currency:string;amountEncoding:"legacy_two_decimal"|"iso_minor_units";amountMinorUnits:number};
export type FlightExpenseRecord={id?:number|string;category:string;label:string;amount_minor:number|string;currency:string;amount_encoding?:string|null;amount_minor_units?:number|null;created_at?:string};
const LABELS:Record<FlightExpenseCategory,string>={LANDING:"Landing fee",HANDLING:"Handling",PARKING:"Parking",FUEL:"Fuel",OTHER:"Other"};
export const flightExpenseCategoryLabel=(value:string)=>LABELS[value as FlightExpenseCategory]||"Other";
export const flightExpenseLabel=(row:Pick<FlightExpenseRecord,"category"|"label">)=>String(row.label||"").trim()||flightExpenseCategoryLabel(String(row.category||"OTHER"));

// v20 expense input uses a fixed 2-digit legacy encoding, irrespective of ISO minor units.
// Never silently reinterpret old JPY or KWD rows with today's registry exponent.
export function parseExpenseAmountMinor(value:unknown):number|null{
  const raw=String(value??"").trim().replace(",",".");
  if(!/^\d{1,8}(?:\.\d{1,2})?$/.test(raw))return null;
  const [whole,fraction=""]=raw.split("."),minor=Number(whole)*100+Number(fraction.padEnd(2,"0"));
  return Number.isSafeInteger(minor)&&minor>0&&minor<=1_000_000_000?minor:null;
}
export function expenseMinorInput(value:number|string,scale=2){
  if(!Number.isSafeInteger(scale)||scale<0||scale>9)return"";
  const minor=typeof value==="number"?BigInt(Math.trunc(value)): /^\d+$/.test(value)?BigInt(value):null;
  if(minor===null||minor<0n)return"";
  const base=10n**BigInt(scale),whole=minor/base,fraction=minor%base;
  return scale===0?whole.toString():fraction===0n?whole.toString():whole.toString()+"."+fraction.toString().padStart(scale,"0");
}
const positiveLimit=1_000_000_000n;
export function parseFlightExpenses(form:FormData):{data?:FlightExpenseInput[];error?:string}{
  const categories=form.getAll("expenseCategory"),labels=form.getAll("expenseLabel"),amounts=form.getAll("expenseAmount"),currencies=form.getAll("expenseCurrency"),encodings=form.getAll("expenseEncoding"),count=Math.max(categories.length,labels.length,amounts.length,currencies.length,encodings.length);
  if(count>20)return{error:"A flight can contain at most 20 additional expense items."};
  const data:FlightExpenseInput[]=[];
  for(let index=0;index<count;index++){
    const categoryRaw=String(categories[index]??"").trim().toUpperCase(),label=String(labels[index]??"").trim().slice(0,80),amountRaw=String(amounts[index]??"").trim(),currency=String(currencies[index]??"").trim().toUpperCase(),encoding=String(encodings[index]??"legacy_two_decimal").trim();
    if(!categoryRaw&&!label&&!amountRaw&&!currency)continue;
    if(!FLIGHT_EXPENSE_CATEGORIES.includes(categoryRaw as FlightExpenseCategory))return{error:`Expense ${index+1}: select a valid type.`};
    if(categoryRaw==="OTHER"&&!label)return{error:`Expense ${index+1}: enter a description for the custom expense.`};
    const iso=supportedIsoCurrency(currency);
    if(!iso)return{error:`Expense ${index+1}: select a supported ISO currency.`};
    let amountMinor:number|null=null,amountMinorUnits:number;
    if(encoding==="iso_minor_units"){
      const parsed=parseSupportedCurrencyAmount(amountRaw,currency);
      if(!parsed.ok)return{error:`Expense ${index+1}: enter a positive amount with the correct decimal places for ${currency}.`};
      if(parsed.money.minor<=0n||parsed.money.minor>positiveLimit)return{error:`Expense ${index+1}: amount is out of range.`};
      amountMinor=Number(parsed.money.minor);amountMinorUnits=iso.minorUnits;
    }else if(encoding==="legacy_two_decimal"){
      amountMinor=parseExpenseAmountMinor(amountRaw);amountMinorUnits=2;
      if(amountMinor===null)return{error:`Expense ${index+1}: legacy amount requires two or fewer decimal places.`};
    }else return{error:`Expense ${index+1}: unknown amount encoding. Review this entry.`};
    data.push({category:categoryRaw as FlightExpenseCategory,label,amountMinor,currency,amountEncoding:encoding,amountMinorUnits});
  }
  return{data};
}
type ExpenseCostRow=Pick<FlightExpenseRecord,"amount_minor"|"currency">&Pick<Partial<FlightExpenseRecord>,"amount_encoding"|"amount_minor_units">;
export function expenseTotals(expenses:ReadonlyArray<ExpenseCostRow>,_aircraftCost=0){
  const totals=new Map<string,{currency:string;minorUnits:number;amountMinor:bigint;legacy:boolean}>();
  for(const row of expenses){
    const currency=supportedIsoCurrency(row.currency);
    const legacy=row.amount_encoding===null||row.amount_encoding===undefined||row.amount_encoding==="legacy_two_decimal";
    const minorUnits=legacy?2:row.amount_encoding==="iso_minor_units"?row.amount_minor_units:null;
    const amount=String(row.amount_minor);
    if(!currency||minorUnits===null||minorUnits===undefined||!Number.isSafeInteger(minorUnits)||minorUnits<0||minorUnits>9||(!legacy&&minorUnits!==currency.minorUnits)||!/^\d+$/.test(amount))continue;
    const minor=BigInt(amount),key=currency.code+":"+minorUnits+":"+(legacy?"legacy":"iso"),previous=totals.get(key);
    totals.set(key,{currency:currency.code,minorUnits,legacy,amountMinor:(previous?.amountMinor??0n)+minor});
  }
  return [...totals.values()].sort((a,b)=>a.currency.localeCompare(b.currency)||a.minorUnits-b.minorUnits);
}
export function formatExpenseMinor(amountMinor:number,currency:string,scale=2){
  if(!Number.isSafeInteger(amountMinor)||amountMinor<0)return"Unavailable";
  const formatted=formatMoneyAmount({currency,minorUnits:scale,minor:BigInt(amountMinor)});
  return formatted??"Unavailable";
}
export function costTotalsLabel(expenses:ReadonlyArray<ExpenseCostRow>,aircraftCost=0){
  const totals=expenseTotals(expenses),known=totals.map(item=>{
    const formatted=formatMoneyAmount({currency:item.currency,minorUnits:item.minorUnits,minor:item.amountMinor})??"Unavailable";
    const source=supportedIsoCurrency(item.currency),needsLegacyNote=item.legacy&&source?.minorUnits!==item.minorUnits;
    return needsLegacyNote?formatted+" (legacy 2-decimal storage)":formatted;
  });
  if(Number.isFinite(aircraftCost)&&aircraftCost>0)known.push("Aircraft rate currency unknown");
  return known.length?known.join(" · "):"—";
}
