"use client";

import { useCallback,useEffect,useRef,useState } from "react";

export function useUnsavedFormGuard(){
  const[dirty,setDirty]=useState(false);
  const submitting=useRef(false);

  useEffect(()=>{
    if(!dirty||submitting.current)return;
    const beforeUnload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=""};
    const followLink=(event:MouseEvent)=>{
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const target=event.target instanceof Element?event.target.closest("a[href]"):null;
      if(!(target instanceof HTMLAnchorElement)||target.target==="_blank"||target.hasAttribute("download"))return;
      const destination=new URL(target.href,window.location.href);
      if(destination.origin!==window.location.origin||destination.href===window.location.href||destination.hash&&destination.pathname===window.location.pathname&&destination.search===window.location.search)return;
      if(!window.confirm("You have unsaved flight changes. Leave this page and discard them?")){event.preventDefault();event.stopPropagation()}
    };
    window.addEventListener("beforeunload",beforeUnload);
    document.addEventListener("click",followLink,true);
    return()=>{window.removeEventListener("beforeunload",beforeUnload);document.removeEventListener("click",followLink,true)};
  },[dirty]);

  const markDirty=useCallback(()=>{submitting.current=false;setDirty(true)},[]);
  const beginSubmit=useCallback(()=>{submitting.current=true;setDirty(false)},[]);
  return{dirty,markDirty,beginSubmit};
}
