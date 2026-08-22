"use client";

import { useActionState,useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { FlightActionState } from "@/app/(protected)/flights/actions";

type Action=(state:FlightActionState,data:FormData)=>Promise<FlightActionState>;

function Submit(){
  const {pending}=useFormStatus();
  return <button className="secondary-button" disabled={pending}>{pending?"Searching…":"Detect airports from GPS"}</button>;
}

export function AirportDetectionControl({action,departure,arrival}:{action:Action;departure:string;arrival:string}){
  const [state,formAction]=useActionState(action,{});
  const router=useRouter();
  useEffect(()=>{if(state.success)router.refresh()},[router,state.success]);
  return <section className="panel airport-detection"><div><p className="eyebrow">GPS AIRPORT DETECTION</p><strong>{departure||"?"} → {arrival||"?"}</strong></div><form action={formAction}><Submit/></form>{state.error?<p className="form-error">{state.error}</p>:null}{state.success?<p className="form-success">{state.success}</p>:null}</section>;
}
