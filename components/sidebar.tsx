"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect,useState } from "react";
import { logout } from "@/app/login/actions";
import styles from "./sidebar.module.css";
import { NavIcon } from "./nav-icon";
import { NotificationBell } from "./notification-bell";

const mainLinks=[
  {href:"/dashboard",icon:"dashboard",label:"Dashboard"},
  {href:"/flights",icon:"flights",label:"Flights"},
  {href:"/map",icon:"map",label:"Map"},
  {href:"/statistics",icon:"statistics",label:"Statistics"},
] as const;

const recordLinks=[
  {href:"/credentials",icon:"credentials",label:"Licences & recency"},
  {href:"/database",icon:"database",label:"Aircraft & airports"},
  {href:"/connections",icon:"connections",label:"Connections"},
  {href:"/data",icon:"data",label:"Print & data"},
  {href:"/profile",icon:"settings",label:"Settings"},
] as const;

export function Sidebar({role="user",actionCount=0,attentionCount=0,notificationCount=0}:{role?:"admin"|"user";actionCount?:number;attentionCount?:number;notificationCount?:number}){
  const pathname=usePathname(); const [collapsed,setCollapsed]=useState(false); const [mobile,setMobile]=useState(false);
  useEffect(()=>{setCollapsed(localStorage.getItem("logbook-sidebar")==="collapsed")},[]);
  useEffect(()=>{setMobile(false)},[pathname]);
  useEffect(()=>{
    if(!mobile)return;
    const previous=document.body.style.overflow;
    const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setMobile(false)};
    document.body.style.overflow="hidden";
    window.addEventListener("keydown",close);
    return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",close)};
  },[mobile]);
  const toggle=()=>{const next=!collapsed;setCollapsed(next);localStorage.setItem("logbook-sidebar",next?"collapsed":"open")};
  const activeFor=(href:string)=>href==="/dashboard"
    ? pathname===href
    : href==="/flights"
      ? pathname===href||pathname.startsWith("/flights/")||pathname==="/fstd"
      : pathname===href||pathname.startsWith(`${href}/`);

  return <aside className={`sidebar${collapsed?" collapsed":""}${mobile?" mobile-open":""}`}>
    <div className="sidebar-brand"><span className="brand-symbol"><img src="/logbook_icon.png" alt="" /></span><div><p className="eyebrow">LOGBOOK</p><h2>FlyTally</h2></div><NotificationBell initialCount={notificationCount} onNavigate={()=>setMobile(false)}/><button className="sidebar-toggle" type="button" onClick={toggle} aria-label={collapsed?"Expand navigation":"Collapse navigation"}>{collapsed?"›":"‹"}</button><button className="mobile-toggle" type="button" onClick={()=>setMobile(!mobile)} aria-label={mobile?"Close navigation":"Open navigation"} aria-expanded={mobile} aria-controls="primary-navigation">{mobile?"×":"☰"}</button></div>
    <button className="mobile-nav-backdrop" type="button" aria-label="Close navigation" tabIndex={mobile?0:-1} onClick={()=>setMobile(false)}/>
    <nav id="primary-navigation" aria-label="Main navigation">
      <Link className={styles.primaryAction} href="/flights/new" title="Add flight" onClick={()=>setMobile(false)}><i><NavIcon name="add"/></i><span>Add flight</span></Link>

      {mainLinks.map(link=>{
        const active=activeFor(link.href),flights=link.href==="/flights";
        return <Link key={link.href} className={active?"active":""} href={link.href} title={link.label} aria-current={active?"page":undefined} onClick={()=>setMobile(false)}><i><NavIcon name={link.icon}/></i><span>{link.label}</span>{flights&&attentionCount>0?<b className="notification-badge" aria-label={`${attentionCount} flights need attention`}>{Math.min(attentionCount,99)}</b>:null}</Link>
      })}

      {actionCount>0?<Link className={`${activeFor("/actions")?"active":""} ${styles.actionLink}`} href="/actions" title="Actions" aria-current={activeFor("/actions")?"page":undefined} onClick={()=>setMobile(false)}><i><NavIcon name="actions"/></i><span>Actions</span><b className="notification-badge" aria-label={`${actionCount} pending actions`}>{Math.min(actionCount,99)}</b></Link>:null}

      <div className={styles.group}>
        <div className={styles.groupTitle}><i><NavIcon name="manage"/></i><span>Pilot & records</span></div>
        {recordLinks.map(link=>{const active=activeFor(link.href);return <Link key={link.href} className={`${active?"active":""} ${styles.recordLink}`} href={link.href} title={link.label} aria-current={active?"page":undefined} onClick={()=>setMobile(false)}><i><NavIcon name={link.icon}/></i><span>{link.label}</span></Link>})}
      </div>

      {role==="admin"?<Link className={`${pathname.startsWith("/admin")?"active":""} ${styles.adminLink}`} href="/admin" title="Administration" aria-current={pathname.startsWith("/admin")?"page":undefined}><i><NavIcon name="admin"/></i><span>Administration</span></Link>:null}
      <form action={logout} className="mobile-only-signout"><button className="ghost-button" title="Sign out"><i><NavIcon name="signout"/></i><span>Sign out</span></button></form>
    </nav>
    <form action={logout} className="desktop-signout"><button className="ghost-button" title="Sign out"><i><NavIcon name="signout"/></i><span>Sign out</span></button></form>
  </aside>;
}
