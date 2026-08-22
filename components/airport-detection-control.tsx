"use client";

import { useActionState,useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { FlightActionState } from "@/app/(protected)/flights/actions";

type Action=(state:FlightActionState,data:FormData)=>Promise<FlightActionState>;

function Submit(){
  const {pending}=useFormStatus();
  return <button className="secondary-button" disabled={pending}>{pending?"Hledám v katalogu…":"Detekovat letiště z GPS"}</button>;
}

export function AirportDetectionControl({action,departure,arrival}:{action:Action;departure:string;arrival:string}){
  const [state,formAction]=useActionState(action,{});
  const router=useRouter();
  useEffect(()=>{if(state.success)router.refresh()},[router,state.success]);
  return <section className="panel airport-detection"><div><p className="eyebrow">LETIŠTĚ PODLE GPS</p><strong>{departure||"?"} → {arrival||"?"}</strong><small>Spustí se pouze ručně. Začátek a konec tracku porovná s vlastními letišti i úplným katalogem. Automaticky uloží jen blízký výsledek do 8 km; nejisté letiště ponechá k ruční kontrole.</small></div><form action={formAction}><Submit/></form>{state.error?<p className="form-error">{state.error}</p>:null}{state.success?<p className="form-success">{state.success}</p>:null}</section>;
}
