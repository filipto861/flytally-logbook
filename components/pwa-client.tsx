"use client";

import { useEffect,useState } from "react";

type InstallPromptEvent=Event&{
  prompt:()=>Promise<void>;
  userChoice:Promise<{outcome:"accepted"|"dismissed";platform:string}>;
};

export function PwaClient(){
  const[installPrompt,setInstallPrompt]=useState<InstallPromptEvent|null>(null),[standalone,setStandalone]=useState(false);

  useEffect(()=>{
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
