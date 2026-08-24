"use client";

import Link from "next/link";
import { usePathname,useSearchParams } from "next/navigation";
import { useEffect,useState } from "react";
import { FLIGHT_DRAFT_STORAGE_KEY,PENDING_FLIGHT_DRAFT_STORAGE_KEY,parseFlightDraft } from "@/lib/offline-flight-draft";

type InstallPromptEvent=Event&{
  prompt:()=>Promise<void>;
  userChoice:Promise<{outcome:"accepted"|"dismissed";platform:string}>;
};
type PendingDraft={id:string;submittedAt:number};

export function PwaClient(){
  const pathname=usePathname(),searchParams=useSearchParams();
  const[online,setOnline]=useState(true),[installPrompt,setInstallPrompt]=useState<InstallPromptEvent|null>(null),[standalone,setStandalone]=useState(false);

  useEffect(()=>{
    setOnline(navigator.onLine);
    setStandalone(window.matchMedia("(display-mode: standalone)").matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone));

    const onOnline=()=>setOnline(true),onOffline=()=>setOnline(false),onInstall=(event:Event)=>{event.preventDefault();setInstallPrompt(event as InstallPromptEvent)},onInstalled=()=>{setInstallPrompt(null);setStandalone(true)};
    const onSubmit=(event:Event)=>{const form=event.target;if(!(form instanceof HTMLFormElement)||!form.elements.namedItem("clientDraftId"))return;setTimeout(()=>{const input=form.elements.namedItem("clientDraftId"),id=input instanceof HTMLInputElement?input.value.trim():"";if(id)sessionStorage.setItem(PENDING_FLIGHT_DRAFT_STORAGE_KEY,JSON.stringify({id,submittedAt:Date.now()} satisfies PendingDraft))},0)};
    window.addEventListener("online",onOnline);window.addEventListener("offline",onOffline);window.addEventListener("beforeinstallprompt",onInstall);window.addEventListener("appinstalled",onInstalled);document.addEventListener("submit",onSubmit);

    if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(()=>undefined);

    return()=>{window.removeEventListener("online",onOnline);window.removeEventListener("offline",onOffline);window.removeEventListener("beforeinstallprompt",onInstall);window.removeEventListener("appinstalled",onInstalled);document.removeEventListener("submit",onSubmit)};
  },[]);

  useEffect(()=>{
    let pending:PendingDraft|null=null;try{pending=JSON.parse(sessionStorage.getItem(PENDING_FLIGHT_DRAFT_STORAGE_KEY)||"null") as PendingDraft|null}catch{sessionStorage.removeItem(PENDING_FLIGHT_DRAFT_STORAGE_KEY)}
    if(!pending?.id||!Number.isFinite(pending.submittedAt))return;
    if(Date.now()-pending.submittedAt>60_000){sessionStorage.removeItem(PENDING_FLIGHT_DRAFT_STORAGE_KEY);return}
    const successfulFlightNavigation=/^\/flights\/\d+$/.test(pathname)||(pathname==="/flights/new"&&searchParams.get("added")==="1");
    if(!successfulFlightNavigation)return;
    const draft=parseFlightDraft(localStorage.getItem(FLIGHT_DRAFT_STORAGE_KEY));if(draft?.id===pending.id)localStorage.removeItem(FLIGHT_DRAFT_STORAGE_KEY);
    sessionStorage.removeItem(PENDING_FLIGHT_DRAFT_STORAGE_KEY);
  },[pathname,searchParams]);

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
