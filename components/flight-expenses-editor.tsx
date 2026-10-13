"use client";
import {useMemo,useRef,useState} from "react";
import {FLIGHT_EXPENSE_CATEGORIES,costTotalsLabel,expenseMinorInput,flightExpenseCategoryLabel,parseFlightExpenses,type FlightExpenseRecord} from "@/lib/flight-expenses";
import {listSupportedIsoCurrencies,supportedIsoCurrency} from "@/lib/iso4217-currency-registry";

type Row={key:string;category:string;label:string;amount:string;currency:string;encoding:string;minorUnits:number|null};
const initialRow=(row:FlightExpenseRecord,index:number):Row=>{
  const encoding=row.amount_encoding==null?"legacy_two_decimal":String(row.amount_encoding);
  const minorUnits=encoding==="legacy_two_decimal"?2:row.amount_minor_units??null;
  return{key:`saved-${row.id??index}`,category:FLIGHT_EXPENSE_CATEGORIES.includes(String(row.category).toUpperCase() as (typeof FLIGHT_EXPENSE_CATEGORIES)[number])?String(row.category).toUpperCase():"OTHER",label:String(row.label||""),amount:expenseMinorInput(row.amount_minor,minorUnits??-1),currency:String(row.currency||"").toUpperCase(),encoding,minorUnits};
};
export function FlightExpensesEditor({initial=[],aircraftCost=0,defaultCurrency=""}:{initial?:FlightExpenseRecord[];aircraftCost?:number;defaultCurrency?:string}){
  const counter=useRef(0),[rows,setRows]=useState<Row[]>(()=>initial.map(initialRow)),currencies=listSupportedIsoCurrencies();
  const defaultCode=supportedIsoCurrency(defaultCurrency)?.code??"";
  const update=(key:string,patch:Partial<Row>)=>setRows(current=>current.map(row=>row.key===key?{...row,...patch}:row));
  const remove=(key:string)=>setRows(current=>current.filter(row=>row.key!==key));
  const add=()=>setRows(current=>[...current,{key:`new-${counter.current++}`,category:"LANDING",label:"",amount:"",currency:defaultCode,encoding:"iso_minor_units",minorUnits:defaultCode?supportedIsoCurrency(defaultCode)?.minorUnits??null:null}]);
  const total=useMemo(()=>{
    const data=new FormData();
    for(const row of rows){data.append("expenseCategory",row.category);data.append("expenseLabel",row.label);data.append("expenseAmount",row.amount);data.append("expenseCurrency",row.currency);data.append("expenseEncoding",row.encoding)}
    const parsed=parseFlightExpenses(data);
    return parsed.data?costTotalsLabel(parsed.data.map(item=>({amount_minor:item.amountMinor,currency:item.currency,amount_encoding:item.amountEncoding,amount_minor_units:item.amountMinorUnits})),aircraftCost):"Review expense amount / currency";
  },[rows,aircraftCost]);
  return <section className="expense-editor" aria-label="Additional flight expenses">
    <header><div><strong>Additional expenses</strong><small>Personal costs only. They are not copied to other pilots.</small></div><button type="button" className="secondary-button expense-add" onClick={add}>+ Add expense</button></header>
    {rows.length?<div className="expense-rows">{rows.map((row,index)=>{const currency=supportedIsoCurrency(row.currency),exponent=row.encoding==="legacy_two_decimal"?2:currency?.minorUnits??null;
      return <div className="expense-row" key={row.key}>
        <input type="hidden" name="expenseEncoding" value={row.encoding}/>
        <label>Type<select name="expenseCategory" value={row.category} onChange={event=>update(row.key,{category:event.target.value})}>{FLIGHT_EXPENSE_CATEGORIES.map(category=><option key={category} value={category}>{flightExpenseCategoryLabel(category)}</option>)}</select></label>
        <label><span>Description {row.category==="OTHER"?<span className="field-hint" aria-hidden="true">Required</span>:null}</span><input name="expenseLabel" maxLength={80} value={row.label} required={row.category==="OTHER"} placeholder={row.category==="OTHER"?"Expense name":"Optional detail"} onChange={event=>update(row.key,{label:event.target.value})}/></label>
        <label><span>Amount <span className="field-hint" aria-hidden="true">Required</span></span><input name="expenseAmount" type="number" inputMode="decimal" min={exponent===0?"1":exponent===3?"0.001":"0.01"} max={exponent===0?"1000000000":exponent===3?"1000000":"10000000"} step={exponent===0?"1":exponent===3?"0.001":"0.01"} required value={row.amount} onChange={event=>update(row.key,{amount:event.target.value})}/></label>
        <label><span>Currency <span className="field-hint" aria-hidden="true">Required</span></span><select name="expenseCurrency" required value={row.currency} onChange={event=>{const code=event.target.value;update(row.key,{currency:code,encoding:"iso_minor_units",minorUnits:supportedIsoCurrency(code)?.minorUnits??null})}}><option value="" disabled>Select currency…</option>{!currency&&row.currency?<option value={row.currency} disabled>Unsupported: {row.currency}</option>:null}{currencies.map(item=><option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}</select></label>
        <button type="button" className="expense-remove" aria-label={`Remove expense ${index+1}`} onClick={()=>remove(row.key)}>Remove</button>
      </div>})}</div>:<p className="muted expense-empty">No additional expenses.</p>}
    <div className="expense-total-preview"><span>Known totals</span><strong>{total}</strong><small>Amounts are grouped by actual currency. Legacy values preserve their original 2-decimal storage; no FX.</small></div>
  </section>;
}
