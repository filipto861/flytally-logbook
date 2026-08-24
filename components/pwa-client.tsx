"use client";

import { useEffect,useState } from "react";

type InstallPromptEvent=Event&{
  prompt:()=>Promise<void>;
  userChoice:Promise<{outcome:"accepted"|"dismissed";platform:string}>;
};

const LEGACY_LOCAL_PREFIX="flytally.flight-draft.";
const LEGACY_LOCAL_KEYS=new Set(["flytally.flight-draft.active-scope.v1"]);
const LEGACY_SESSION_KEYS=new Set(["flytally.pending-flight-draft.v1"]);

export function PwaClient(){
  const[installPrompt,setInstallPrompt]=useState<InstallPromptEvent|null>(null),[standalone,setStandalone]=useState(false);

  useEffect(()=>{
    for(let index=localStorage.length-1;index>=0;index--){const key=localStorage.key(index);if(key&&(key.startsWith(LEGACY_LOCAL_PREFIX)||LEGACY_LOCAL_KEYS.has(key)))localStorage.removeItem(key)}
    for(const key of LEGACY_SESSION_KEYS)sessionStorage.removeItem(key);
    setStandalone(window.matchMedia("(display-mode: standalone)").matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone));
    const onInstall=(event:Event)=>{event.preventDefault();setInstallPrompt(event as InstallPromptEvent)};
    const onInstalled=()=>{setInstallPrompt(null);setStandalone(true)};
    window.addEventListener("beforeinstallprompt",onInstall);
    window.addEventListener("appinstalled",onInstalled);
    if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(()=>undefined);
    return()=>{window.removeEventListener("beforeinstallprompt",onInstall);window.removeEventListener("appinstalled",onInstalled)};
  },[]);

  const install=async()=>{
    if(!installPrompt)return;
    await installPrompt.prompt();
    const choice=await installPrompt.userChoice;
    if(choice.outcome==="accepted")setInstallPrompt(null);
  };

  if(standalone||!installPrompt)return null;
  return <aside className="pwa-status installable" aria-live="polite">
    <strong>Install FlyTally</strong>
    <span>Open FlyTally as a standalone app on this device.</span>
    <button type="button" className="secondary-button" onClick={install}>Install</button>
  </aside>;
}
