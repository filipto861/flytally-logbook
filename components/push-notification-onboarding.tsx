"use client";

import Link from "next/link";
import { useEffect,useState } from "react";
import { enablePush,loadPushConfig,pushDeviceState,type PushConfig,type PushDeviceState } from "@/lib/push-client";

const DISMISS_KEY="flytally.push-onboarding.dismissed-until.v1";
const dismissForDays=(days:number)=>{try{localStorage.setItem(DISMISS_KEY,String(Date.now()+days*86400000))}catch{}};
const dismissed=()=>{try{return Number(localStorage.getItem(DISMISS_KEY)||0)>Date.now()}catch{return false}};

export function PushNotificationOnboarding(){
  const[config,setConfig]=useState<PushConfig|null>(null),[state,setState]=useState<PushDeviceState>("loading"),[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{let active=true,timer=0;void(async()=>{if(dismissed())return;const [cfg,device]=await Promise.all([loadPushConfig(),pushDeviceState()]);if(!active||!cfg?.configured)return;setConfig(cfg);setState(device);if(device==="available"||device==="install-required")timer=window.setTimeout(()=>{if(active)setVisible(true)},1200)})();return()=>{active=false;if(timer)window.clearTimeout(timer)}},[]);
  if(!visible||!config)return null;
  const install=state==="install-required";
  const close=()=>{dismissForDays(14);setVisible(false)};
  const activate=async()=>{setBusy(true);setError("");try{await enablePush(config.publicKey);setState("enabled");setVisible(false);try{localStorage.removeItem(DISMISS_KEY)}catch{}}catch(reason){setError(reason instanceof Error?reason.message:"Notifications could not be enabled.");setState(await pushDeviceState())}finally{setBusy(false)}};
  return <aside className="push-onboarding" role="dialog" aria-label="Enable FlyTally notifications">
    <button className="push-onboarding-close" type="button" onClick={close} aria-label="Not now">×</button>
    <div className="push-onboarding-icon" aria-hidden="true">🔔</div>
    <div className="push-onboarding-copy"><p className="eyebrow">STAY UP TO DATE</p><strong>{install?"Get alerts on your iPhone":"Never miss an important flying deadline"}</strong><p>{install?"Add FlyTally to your Home Screen first. Then FlyTally can alert you about recency, licences and requests even when the app is closed.":"FlyTally can alert you when recency, a licence, rating or medical needs attention — and when another pilot sends you something."}</p>{error?<small className="form-error">{error}</small>:null}</div>
    <div className="push-onboarding-actions">{install?<Link className="primary-button" href="/profile" onClick={close}>Open setup</Link>:<button className="primary-button" type="button" disabled={busy} onClick={()=>void activate()}>{busy?"Enabling…":"Enable notifications"}</button>}<button className="secondary-button" type="button" onClick={close}>Not now</button></div>
  </aside>;
}
