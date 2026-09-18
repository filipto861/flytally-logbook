"use client";

import type { ReactNode } from "react";
import { useState } from "react";

export type NotificationMutationAction=(form:FormData)=>Promise<void>;

export function NotificationMutationForm({action,children,className}:{action:NotificationMutationAction;children:ReactNode;className?:string}){
  const[pending,setPending]=useState(false);
  const run=async(form:FormData)=>{
    setPending(true);
    try{
      await action(form);
      window.dispatchEvent(new Event("flytally:notifications-refresh"));
    }finally{
      setPending(false);
    }
  };
  return <form action={run} className={className} aria-busy={pending}>{children}</form>;
}
