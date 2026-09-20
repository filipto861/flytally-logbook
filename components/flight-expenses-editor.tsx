"use client";
import { useId,useMemo,useRef,useState } from "react";
import { FLIGHT_EXPENSE_CATEGORIES,costTotalsLabel,expenseMinorInput,flightExpenseCategoryLabel,parseExpenseAmountMinor,type FlightExpenseRecord } from "@/lib/flight-expenses";

type Row={key:string;category:string;label:string;amount:string;currency:string};
const initialRow=(row:FlightExpenseRecord,index:number):Row=>({key:`saved-${row.id??index}`,category:FLIGHT_EXPENSE_CATEGORIES.includes(String(row.category).toUpperCase() as any)?String(row.category).toUpperCase():"OTHER",label:String(row.label||""),amount:expenseMinorInput(row.amount_minor),currency:String(row.currency||"CZK").toUpperCase()});

export function FlightExpensesEditor({initial=[],aircraftCost=0}:{initial?:FlightExpenseRecord[];aircraftCost?:number}){
  const counter=useRef(0),currencyListId=useId(),[rows,setRows]=useState<Row[]>(()=>initial.map(initialRow));
  const update=(key:string,patch:Partial<Row>)=>setRows(current=>current.map(row=>row.key===key?{...row,...patch}:row)),remove=(key:string)=>setRows(current=>current.filter(row=>row.key!==key));
  const add=()=>setRows(current=>[...current,{key:`new-${counter.current++}`,category:"LANDING",label:"",amount:"",currency:"CZK"}]);
  const total=useMemo(()=>costTotalsLabel(rows.map(row=>({amount_minor:parseExpenseAmountMinor(row.amount)||0,currency:row.currency})),aircraftCost),[rows,aircraftCost]);
  return <section className="expense-editor" aria-label="Additional flight expenses">
    <header><div><strong>Additional expenses</strong><small>Personal costs only. They are not copied to other pilots.</small></div><button type="button" className="secondary-button expense-add" onClick={add}>+ Add expense</button></header>
    <datalist id={currencyListId}><option value="CZK"/><option value="EUR"/><option value="USD"/><option value="GBP"/><option value="CHF"/><option value="PLN"/></datalist>
    {rows.length?<div className="expense-rows">{rows.map((row,index)=><div className="expense-row" key={row.key}>
      <label>Type<select name="expenseCategory" value={row.category} onChange={event=>update(row.key,{category:event.target.value})}>{FLIGHT_EXPENSE_CATEGORIES.map(category=><option key={category} value={category}>{flightExpenseCategoryLabel(category)}</option>)}</select></label>
      <label>Description {row.category==="OTHER"?<span className="field-hint" aria-hidden="true">Required</span>:null}<input name="expenseLabel" maxLength={80} value={row.label} required={row.category==="OTHER"} placeholder={row.category==="OTHER"?"Expense name":"Optional detail"} onChange={event=>update(row.key,{label:event.target.value})}/></label>
      <label><span>Amount <span className="field-hint" aria-hidden="true">Required</span></span><input name="expenseAmount" type="number" inputMode="decimal" min="0.01" max="10000000" step="0.01" required value={row.amount} onChange={event=>update(row.key,{amount:event.target.value})}/></label>
      <label><span>Currency <span className="field-hint" aria-hidden="true">Required</span></span><input name="expenseCurrency" list={currencyListId} maxLength={3} required value={row.currency} onChange={event=>update(row.key,{currency:event.target.value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,3)})}/></label>
      <button type="button" className="expense-remove" aria-label={`Remove expense ${index+1}`} onClick={()=>remove(row.key)}>Remove</button>
    </div>)}</div>:<p className="muted expense-empty">No additional expenses.</p>}
    <div className="expense-total-preview"><span>Known totals</span><strong>{total}</strong><small>Amounts are grouped by currency. FlyTally does not assume an exchange rate.</small></div>
  </section>;
}
