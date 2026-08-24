"use client";

import type { FormEvent,ReactNode } from "react";

type ServerAction=(formData:FormData)=>void|Promise<void>;

export function LicenceSaveForm({action,className,children}:{action:ServerAction;className?:string;children:ReactNode}){
  const collapseAfterSubmit=(event:FormEvent<HTMLFormElement>)=>{
    const details=event.currentTarget.closest("details");
    requestAnimationFrame(()=>details?.removeAttribute("open"));
  };
  return <form action={action} className={className} onSubmit={collapseAfterSubmit}>{children}</form>;
}
