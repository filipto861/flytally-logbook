"use client";
import { useActionState } from "react";
import { FlightExpensesEditor } from "@/components/flight-expenses-editor";
import type { FlightExpenseRecord } from "@/lib/flight-expenses";
import type { FlightActionState } from "@/app/(protected)/flights/actions";
type Action=(state:FlightActionState,data:FormData)=>Promise<FlightActionState>;

export function FlightExpensesStandalone({action,initial,aircraftCost}:{action:Action;initial:FlightExpenseRecord[];aircraftCost:number}){
  const[state,formAction]=useActionState(action,{});
  return <section className="panel flight-expense-panel"><div><p className="eyebrow">PERSONAL COSTS</p><h2>Flight expenses</h2><p className="muted">Financial metadata is separate from the certified logbook record. Updating it does not create a new flight revision.</p></div><form action={formAction} className="expense-standalone-form"><FlightExpensesEditor initial={initial} aircraftCost={aircraftCost}/>{state.error?<p className="form-error" role="alert">{state.error}</p>:null}{state.success?<p className="form-success" role="status">{state.success}</p>:null}<button className="primary-button">Save expenses</button></form></section>;
}
