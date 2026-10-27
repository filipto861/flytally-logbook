"use client";
import { useActionState,useEffect,useRef } from "react";
import { FlightExpensesEditor } from "@/components/flight-expenses-editor";
import { PendingActionButton } from "@/components/pending-action-button";
import type { FlightExpenseRecord } from "@/lib/flight-expenses";
import type { FlightActionState } from "@/app/(protected)/flights/actions";

type Action=(state:FlightActionState,data:FormData)=>Promise<FlightActionState>;

export function FlightExpensesStandalone({action,initial,defaultCurrency=""}:{action:Action;initial:FlightExpenseRecord[];defaultCurrency?:string}){
  const[state,formAction]=useActionState(action,{});
  const detailsRef=useRef<HTMLDetailsElement>(null);
  // An async validation error or save result must never be hidden in a closed panel.
  useEffect(()=>{
    if(state.error||state.success)detailsRef.current?.setAttribute("open","");
  },[state]);

  const count=initial.length;
  return <details ref={detailsRef} className="panel flight-expense-panel flight-f3-expenses">
    <summary className="flight-f3-expenses-summary">
      <span><strong>Flight expenses</strong><small>Personal costs · separate from the certified record</small></span>
      <span className="flight-f3-expenses-count">{count===0?"No additional expenses":count===1?"1 recorded expense":`${count} recorded expenses`}</span>
    </summary>
    <div className="flight-f3-expenses-body">
      <p className="muted">Updating personal expenses does not create a new certified flight revision.</p>
      <form action={formAction} className="expense-standalone-form">
        {/* Aircraft-rate totals belong to the source-backed Costs overview, not the personal expense sum. */}
        <FlightExpensesEditor initial={initial} defaultCurrency={defaultCurrency}/>
        {state.error?<p className="form-error" role="alert">{state.error}</p>:null}
        {state.success?<p className="form-success" role="status">{state.success}</p>:null}
        <PendingActionButton className="primary-button" pendingLabel="Saving expenses…">Save expenses</PendingActionButton>
      </form>
    </div>
  </details>;
}
