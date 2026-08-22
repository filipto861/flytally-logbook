"use client";

import { useState } from "react";

export function DeleteFlightButton({action}:{action:()=>Promise<void>}){
  const [confirm,setConfirm]=useState(false);
  if(!confirm)return <button type="button" className="danger-button" onClick={()=>setConfirm(true)}>Move to trash</button>;
  return <div className="delete-flight-confirm"><button type="button" className="secondary-button" onClick={()=>setConfirm(false)}>Cancel</button><form action={action}><button className="danger-button">Confirm deletion</button></form></div>;
}
