"use client";

import Link from "next/link";
import { useEffect,useState } from "react";
import { disablePushOnDevice,enablePush,loadPushConfig,pushDeviceState,updatePushPreferences,type PushConfig,type PushDeviceState,type PushPreferences } from "@/lib/push-client";

function usePush(){
  const[config,setConfig]=useState<PushConfig|null>(null),[state,setState]=useState<PushDeviceState>("loading"),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const refresh=async()=>{const[cfg,device]=await Promise.all([loadPushConfig(),pushDeviceState()]);setConfig(cfg);setState(cfg?.configured?device:"unavailable")};
  useEffect(()=>{void refresh()},[]);
  const enable=async()=>{if(!config)return;setBusy(true);setError("");try{await enablePush(config.publicKey);await refresh()}catch(reason){setError(reason instanceof Error?reason.message:"Notifications could not be enabled.");setState(await pushDeviceState())}finally{setBusy(false)}};
  const disable=async()=>{setBusy(true);setError("");try{await disablePushOnDevice();await refresh()}finally{setBusy(false)}};
  return{config,state,busy,error,enable,disable,refresh,setConfig,setError};
}

export function PushNotificationInline({context="updates"}:{context?:"recency"|"updates"}){
  const{config,state,busy,error,enable}=usePush();
  if(state==="loading"||state==="enabled"||state==="unavailable"||state==="unsupported"||!config)return null;
  if(state==="install-required")return <aside className="push-inline"><span aria-hidden="true">🔔</span><div><strong>Want FlyTally to remind you?</strong><small>Install FlyTally on your Home Screen to receive {context==="recency"?"recency and expiry":"important"} alerts.</small></div><Link className="secondary-button" href="/profile">Setup</Link></aside>;
  if(state==="denied")return <aside className="push-inline"><span aria-hidden="true">🔕</span><div><strong>Push alerts are blocked</strong><small>You can allow notifications again in your browser/site settings.</small></div></aside>;
  return <aside className="push-inline"><span aria-hidden="true">🔔</span><div><strong>{context==="recency"?"Want a reminder before this needs attention?":"Get important alerts on this device"}</strong><small>{context==="recency"?"Enable push for recency, licence, rating and medical reminders.":"Enable push for requests, shared records and compliance reminders."}</small>{error?<small className="form-error">{error}</small>:null}</div><button className="secondary-button" type="button" disabled={busy} onClick={()=>void enable()}>{busy?"Enabling…":"Enable push alerts"}</button></aside>;
}

export function PushNotificationSettings(){
  const{config,state,busy,error,enable,disable,setConfig,setError}=usePush();
  const[saveBusy,setSaveBusy]=useState(false),[saved,setSaved]=useState("");
  if(state==="loading")return <section className="panel u33-preference-card"><p className="eyebrow">NOTIFICATIONS</p><h2>Push alerts</h2><p className="muted">Checking this device…</p></section>;
  if(!config||state==="unavailable")return <section className="panel u33-preference-card"><p className="eyebrow">NOTIFICATIONS</p><h2>Push alerts</h2><p className="muted">Push notifications are not available on this deployment.</p></section>;
  const preferences=config.preferences;
  const change=async(key:keyof PushPreferences,value:boolean)=>{const next={...preferences,[key]:value};setSaveBusy(true);setSaved("");setError("");try{const updated=await updatePushPreferences(next);setConfig({...config,preferences:updated});setSaved("Saved") }catch(reason){setError(reason instanceof Error?reason.message:"Preferences could not be saved.")}finally{setSaveBusy(false)}};
  return <section className="panel u33-preference-card push-settings">
    <div><p className="eyebrow">NOTIFICATIONS</p><h2>Push alerts</h2><p className="muted">Push permission is per device. Alert categories apply across your FlyTally account.</p></div>
    <div className="push-device-status"><span className={state==="enabled"?"status-on":state==="denied"?"status-off":"record-status"}>{state==="enabled"?"ENABLED ON THIS DEVICE":state==="denied"?"BLOCKED BY BROWSER":state==="install-required"?"INSTALL APP FIRST":state==="unsupported"?"UNSUPPORTED":"NOT ENABLED"}</span>{config.devices>0?<small>{config.devices} active push device{config.devices===1?"":"s"} on this account</small>:null}</div>
    {state==="enabled"?<button className="secondary-button" type="button" disabled={busy} onClick={()=>void disable()}>{busy?"Disabling…":"Disable on this device"}</button>:state==="install-required"?<div className="push-install-note"><strong>iPhone / iPad</strong><small>Use Safari → Share → Add to Home Screen. Open the installed FlyTally app, then return here to enable notifications.</small></div>:state==="denied"?<p className="muted">Open this site's notification permissions in your browser and change Notifications to Allow, then reload FlyTally.</p>:state==="unsupported"?<p className="muted">This browser does not expose the Web Push APIs required by FlyTally.</p>:<button className="primary-button" type="button" disabled={busy} onClick={()=>void enable()}>{busy?"Enabling…":"Enable on this device"}</button>}
    <div className="push-preference-list" aria-busy={saveBusy}>
      <label><input type="checkbox" checked={preferences.compliance} disabled={saveBusy} onChange={event=>void change("compliance",event.target.checked)}/><span><strong>Flying & compliance</strong><small>Recency, licence, rating, medical and document deadlines.</small></span></label>
      <label><input type="checkbox" checked={preferences.activity} disabled={saveBusy} onChange={event=>void change("activity",event.target.checked)}/><span><strong>Activity</strong><small>Shared flights, aircraft profiles, connection and signature/review requests.</small></span></label>
      <label><input type="checkbox" checked={preferences.security} disabled={saveBusy} onChange={event=>void change("security",event.target.checked)}/><span><strong>Account security</strong><small>Security-sensitive account events when FlyTally emits them.</small></span></label>
    </div>
    {saved?<small className="form-success">{saved}</small>:null}{error?<small className="form-error">{error}</small>:null}
  </section>;
}
