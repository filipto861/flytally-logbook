export const FLIGHT_EXPENSE_CATEGORIES=["LANDING","HANDLING","PARKING","FUEL","OTHER"] as const;
export type FlightExpenseCategory=(typeof FLIGHT_EXPENSE_CATEGORIES)[number];
export type FlightExpenseInput={category:FlightExpenseCategory;label:string;amountMinor:number;currency:string};
export type FlightExpenseRecord={id?:number|string;category:string;label:string;amount_minor:number|string;currency:string;created_at?:string};
const LABELS:Record<FlightExpenseCategory,string>={LANDING:"Landing fee",HANDLING:"Handling",PARKING:"Parking",FUEL:"Fuel",OTHER:"Other"};
export const flightExpenseCategoryLabel=(value:string)=>LABELS[value as FlightExpenseCategory]||"Other";
export const flightExpenseLabel=(row:Pick<FlightExpenseRecord,"category"|"label">)=>String(row.label||"").trim()||flightExpenseCategoryLabel(String(row.category||"OTHER"));

export function parseExpenseAmountMinor(value:unknown):number|null{
  const raw=String(value??"").trim().replace(",",".");
  if(!/^\d{1,8}(?:\.\d{1,2})?$/.test(raw))return null;
  const [whole,fraction=""]=raw.split("."),minor=Number(whole)*100+Number(fraction.padEnd(2,"0"));
  return Number.isSafeInteger(minor)&&minor>0&&minor<=1_000_000_000?minor:null;
}
export function expenseMinorInput(value:number|string){const minor=Math.max(0,Number(value)||0),major=minor/100;return Number.isInteger(major)?String(major):major.toFixed(2)}

export function parseFlightExpenses(form:FormData):{data?:FlightExpenseInput[];error?:string}{
  const categories=form.getAll("expenseCategory"),labels=form.getAll("expenseLabel"),amounts=form.getAll("expenseAmount"),currencies=form.getAll("expenseCurrency"),count=Math.max(categories.length,labels.length,amounts.length,currencies.length);
  if(count>20)return{error:"A flight can contain at most 20 additional expense items."};
  const data:FlightExpenseInput[]=[];
  for(let index=0;index<count;index++){
    const categoryRaw=String(categories[index]??"").trim().toUpperCase(),label=String(labels[index]??"").trim().slice(0,80),amountRaw=String(amounts[index]??"").trim(),currency=String(currencies[index]??"").trim().toUpperCase();
    if(!categoryRaw&&!label&&!amountRaw&&!currency)continue;
    if(!FLIGHT_EXPENSE_CATEGORIES.includes(categoryRaw as FlightExpenseCategory))return{error:`Expense ${index+1}: select a valid type.`};
    if(categoryRaw==="OTHER"&&!label)return{error:`Expense ${index+1}: enter a description for the custom expense.`};
    const amountMinor=parseExpenseAmountMinor(amountRaw);if(amountMinor===null)return{error:`Expense ${index+1}: enter a positive amount with at most two decimal places.`};
    if(!/^[A-Z]{3}$/.test(currency))return{error:`Expense ${index+1}: currency must use a three-letter code such as CZK or EUR.`};
    data.push({category:categoryRaw as FlightExpenseCategory,label,amountMinor,currency});
  }
  return{data};
}

export function expenseTotals(expenses:ReadonlyArray<Pick<FlightExpenseRecord,"amount_minor"|"currency">>,aircraftCost=0){
  const totals=new Map<string,number>();
  if(Number.isFinite(aircraftCost)&&aircraftCost>0)totals.set("CZK",Math.round(aircraftCost)*100);
  for(const row of expenses){const currency=String(row.currency||"").trim().toUpperCase(),minor=Math.max(0,Number(row.amount_minor)||0);if(!/^[A-Z]{3}$/.test(currency)||!minor)continue;totals.set(currency,(totals.get(currency)||0)+minor)}
  return [...totals.entries()].sort(([left],[right])=>left==="CZK"?-1:right==="CZK"?1:left.localeCompare(right)).map(([currency,amountMinor])=>({currency,amountMinor}));
}
export function formatExpenseMinor(amountMinor:number,currency:string){const major=amountMinor/100;return `${major.toLocaleString("en-GB",{minimumFractionDigits:Number.isInteger(major)?0:2,maximumFractionDigits:2})} ${currency}`}
export function costTotalsLabel(expenses:ReadonlyArray<Pick<FlightExpenseRecord,"amount_minor"|"currency">>,aircraftCost=0){const totals=expenseTotals(expenses,aircraftCost);return totals.length?totals.map(item=>formatExpenseMinor(item.amountMinor,item.currency)).join(" · "):"—"}
