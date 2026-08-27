"use client";

import { useState } from "react";

export function DeleteFlightButton({action,label="Move to trash",confirmLabel="Confirm deletion"}:{action:()=>Promise<void>;label?:string;confirmLabel?:string}){
  const [confirm,setConfirm]=useState(false);
  if(!confirm)return <button type="button" className="danger-button" onClick={()=>setConfirm(true)}>{label}</button>;
  return <div className="delete-flight-confirm"><button type="button" className="secondary-button" onClick={()=>setConfirm(false)}>Cancel</button><form action={action}><button className="danger-button">{confirmLabel}</button></form></div>;
}
