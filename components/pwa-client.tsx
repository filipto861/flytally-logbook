"use client";

import { useEffect,useRef } from "react";

type InstallPromptEvent=Event&{
  prompt:()=>Promise<void>;
  userChoice:Promise<{outcome:"accepted"|"dismissed";platform:string}>;
};
type InstallState={available:boolean;standalone:boolean};

const LEGACY_LOCAL_PREFIX="flytally.flight-draft.";
const LEGACY_LOCAL_KEYS=new Set(["flytally.flight-draft.active-scope.v1"]);
const LEGACY_SESSION_KEYS=new Set(["flytally.pending-flight-draft.v1"]);
const INSTALL_REQUEST_EVENT="flytally:install-request";
const INSTALL_STATE_EVENT="flytally:install-state";
const INSTALL_STATE_REQUEST_EVENT="flytally:install-state-request";

export function PwaClient(){
  const promptRef=useRef<InstallPromptEvent|null>(null),standaloneRef=useRef(false);
  const emitState=(state?:Partial<InstallState>)=>{
    const detail:InstallState={available:Boolean(promptRef.current),standalone:standaloneRef.current,...state};
    window.dispatchEvent(new CustomEvent<InstallState>(INSTALL_STATE_EVENT,{detail}));
  };
  const runInstall=async()=>{
    const prompt=promptRef.current;
    if(!prompt)return;
    await prompt.prompt();
    const choice=await prompt.userChoice;
    promptRef.current=null;
    if(choice.outcome==="accepted")standaloneRef.current=true;
    emitState({available:false,standalone:choice.outcome==="accepted"||standaloneRef.current});
  };

  useEffect(()=>{
    for(let index=localStorage.length-1;index>=0;index--){const key=localStorage.key(index);if(key&&(key.startsWith(LEGACY_LOCAL_PREFIX)||LEGACY_LOCAL_KEYS.has(key)))localStorage.removeItem(key)}
    for(const key of LEGACY_SESSION_KEYS)sessionStorage.removeItem(key);
    const isStandalone=window.matchMedia("(display-mode: standalone)").matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone);
    standaloneRef.current=isStandalone;
    const onInstall=(event:Event)=>{event.preventDefault();const prompt=event as InstallPromptEvent;promptRef.current=prompt;emitState({available:true});};
    const onInstalled=()=>{promptRef.current=null;standaloneRef.current=true;emitState({available:false,standalone:true});};
    const onRequest=()=>{void runInstall();};
    const onStateRequest=()=>emitState();
    window.addEventListener("beforeinstallprompt",onInstall);
    window.addEventListener("appinstalled",onInstalled);
    window.addEventListener(INSTALL_REQUEST_EVENT,onRequest);
    window.addEventListener(INSTALL_STATE_REQUEST_EVENT,onStateRequest);
    if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(()=>undefined);
    queueMicrotask(()=>emitState());
    return()=>{window.removeEventListener("beforeinstallprompt",onInstall);window.removeEventListener("appinstalled",onInstalled);window.removeEventListener(INSTALL_REQUEST_EVENT,onRequest);window.removeEventListener(INSTALL_STATE_REQUEST_EVENT,onStateRequest)};
  },[]);

  return null;
}
