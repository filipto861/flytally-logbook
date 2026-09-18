"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback,useEffect,useState } from "react";
import { NavIcon } from "@/components/nav-icon";
import styles from "./sidebar.module.css";

const POLL_MS=30_000;

export function NotificationBell({initialCount=0,onNavigate}:{initialCount?:number;onNavigate?:()=>void}){
  const[count,setCount]=useState(Math.max(0,initialCount));
  const pathname=usePathname();

  useEffect(()=>{setCount(Math.max(0,initialCount))},[initialCount]);

  const refresh=useCallback(async()=>{
    try{
      const response=await fetch("/api/notifications/unread",{cache:"no-store",headers:{"accept":"application/json"}});
      if(!response.ok)return;
      const payload=await response.json() as {unread?:unknown};
      const next=Number(payload.unread);
      if(Number.isFinite(next)&&next>=0)setCount(Math.floor(next));
    }catch{
      // Keep the last known count when the network is unavailable.
    }
  },[]);

  useEffect(()=>{void refresh()},[pathname,refresh]);

  useEffect(()=>{
    const timer=window.setInterval(refresh,POLL_MS);
    const onFocus=()=>{void refresh()};
    const onVisibility=()=>{if(document.visibilityState==="visible")void refresh()};
    const onNotificationRefresh=()=>{void refresh()};
    window.addEventListener("focus",onFocus);
    window.addEventListener("flytally:notifications-refresh",onNotificationRefresh);
    document.addEventListener("visibilitychange",onVisibility);
    return()=>{
      window.clearInterval(timer);
      window.removeEventListener("focus",onFocus);
      window.removeEventListener("flytally:notifications-refresh",onNotificationRefresh);
      document.removeEventListener("visibilitychange",onVisibility);
    };
  },[refresh]);

  const label=count>0?"Notifications, "+count+" unread":"Notifications";
  return <Link className={styles.notificationBell} href="/notifications" aria-label={label} title={label} onClick={onNavigate}>
    <NavIcon name="notifications"/>
    {count>0?<b className={styles.notificationCount} aria-hidden="true">{count>99?"99+":count}</b>:null}
  </Link>;
}
