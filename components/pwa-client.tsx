"use client";

import Link from "next/link";
import { useEffect,useState } from "react";
import { FLIGHT_DRAFT_STORAGE_KEY,parseFlightDraft } from "@/lib/offline-flight-draft";

type InstallPromptEvent=Event&{
  prompt:()=>Promise<void>;
  userChoice:Promise<{outcome:"accepted"|"dismissed";platform:string}>;
};

export function PwaClient(){
  const[online,setOnline]=useState(true),[installPrompt,setInstallPrompt]=useState<InstallPromptEvent|null>(null),[standalone,setStandalone]=useState(false);

  useEffect(()=>{
    setOnline(navigator.onLine);
    setStandalone(window.matchMedia("(display-mode: standalone)").matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone));

    const onOnline=()=>setOnline(true),onOffline=()=>setOnline(false),onInstall=(event:Event)=>{event.preventDefault();setInstallPrompt(event as InstallPromptEvent)},onInstalled=()=>{setInstallPrompt(null);setStandalone(true)};
    window.addEventListener("online",onOnline);window.addEventListener("offline",onOffline);window.addEventListener("beforeinstallprompt",onInstall);window.addEventListener("appinstalled",onInstalled);

    if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(()=>undefined);

    const url=new URL(window.location.href),saved=url.searchParams.get("draftSaved");
    if(saved){
      const draft=parseFlightDraft(localStorage.getItem(FLIGHT_DRAFT_STORAGE_KEY));
      if(draft?.id===saved)localStorage.removeItem(FLIGHT_DRAFT_STORAGE_KEY);
      url.searchParams.delete("draftSaved");
      const query=url.searchParams.toString();
      history.replaceState(null,"",`${url.pathname}${query?`?${query}`:""}${url.hash}`);
    }

    return()=>{window.removeEventListener("online",onOnline);window.removeEventListener("offline",onOffline);window.removeEventListener("beforeinstallprompt",onInstall);window.removeEventListener("appinstalled",onInstalled)};
  },[]);

  const install=async()=>{
    if(!installPrompt)return;
    await installPrompt.prompt();
    const choice=await installPrompt.userChoice;
    if(choice.outcome==="accepted")setInstallPrompt(null);
  };

  if(online&&(standalone||!installPrompt))return null;
  return <aside className={`pwa-status ${online?"installable":"offline"}`} aria-live="polite">
    {!online?<><strong>Offline</strong><span>Local flight drafts stay on this device until you review and save them online.</span><Link href="/offline">Open local draft</Link></>:null}
    {online&&!standalone&&installPrompt?<><strong>FlyTally app</strong><span>Install the standalone app on this device.</span><button type="button" className="secondary-button" onClick={install}>Install</button></>:null}
  </aside>;
}
