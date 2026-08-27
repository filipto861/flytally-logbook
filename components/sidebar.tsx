"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect,useState } from "react";
import { logout } from "@/app/login/actions";
import styles from "./sidebar.module.css";
import { NavIcon } from "./nav-icon";

const mainLinks=[
  {href:"/dashboard",icon:"dashboard",label:"Dashboard"},
  {href:"/flights",icon:"flights",label:"Flights"},
  {href:"/fstd",icon:"simulator",label:"FSTD sessions",sub:true},
  {href:"/flights/new",icon:"add",label:"Add flight"},
  {href:"/map",icon:"map",label:"Map"},
] as const;
const profileLinks=[
  {href:"/connections",icon:"connections",label:"Connections"},
  {href:"/credentials",icon:"credentials",label:"Credentials"},
  {href:"/profile",icon:"settings",label:"Settings"},
  {href:"/database",icon:"database",label:"Aircraft & airports"},
  {href:"/data",icon:"data",label:"Print & data"},
] as const;

export function Sidebar({role="user",unreadNotifications=0}:{role?:"admin"|"user";unreadNotifications?:number}){
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
  const activeFor=(href:string)=>href==="/dashboard"?pathname===href:href==="/flights"?(pathname===href||/^\/flights\/\d/.test(pathname)||pathname==="/fstd"):pathname===href||pathname.startsWith(`${href}/`);
  return <aside className={`sidebar${collapsed?" collapsed":""}${mobile?" mobile-open":""}`}>
    <div className="sidebar-brand"><span className="brand-symbol"><img src="/logbook_icon.png" alt="" /></span><div><p className="eyebrow">LOGBOOK</p><h2>FlyTally</h2></div><button className="sidebar-toggle" type="button" onClick={toggle} aria-label={collapsed?"Expand navigation":"Collapse navigation"}>{collapsed?"›":"‹"}</button><button className="mobile-toggle" type="button" onClick={()=>setMobile(!mobile)} aria-label={mobile?"Close navigation":"Open navigation"} aria-expanded={mobile} aria-controls="primary-navigation">{mobile?"×":"☰"}</button></div>
    <button className="mobile-nav-backdrop" type="button" aria-label="Close navigation" tabIndex={mobile?0:-1} onClick={()=>setMobile(false)}/>
    <nav id="primary-navigation" aria-label="Main navigation">
      {mainLinks.map(link=>{const sub="sub" in link&&link.sub,active=activeFor(link.href);return <Link key={link.href} className={`${active?"active":""}${sub?" sidebar-sub-link":""}`} href={link.href} title={link.label} aria-current={active?"page":undefined} onClick={()=>setMobile(false)}><i><NavIcon name={link.icon}/></i><span>{link.label}</span></Link>})}
      <Link className={activeFor("/notifications")?"active":""} href="/notifications" title="Notifications" aria-current={activeFor("/notifications")?"page":undefined} onClick={()=>setMobile(false)}><i><NavIcon name="notifications"/></i><span>Notifications</span>{unreadNotifications?<b className="notification-badge" aria-label={`${unreadNotifications} unread`}>{Math.min(unreadNotifications,99)}</b>:null}</Link>
      <div className={styles.group}>
        <div className={styles.groupTitle}><i><NavIcon name="manage"/></i><span>Manage</span></div>
        {profileLinks.map(link=>{const active=activeFor(link.href);return <Link key={link.href} className={`${active?"active":""} sidebar-sub-link ${styles.profileLink}`} href={link.href} title={link.label} aria-current={active?"page":undefined} onClick={()=>setMobile(false)}><i><NavIcon name={link.icon}/></i><span>{link.label}</span></Link>})}
      </div>
      {role==="admin"?<Link className={pathname.startsWith("/admin")?"active":""} href="/admin" title="Administration" aria-current={pathname.startsWith("/admin")?"page":undefined}><i><NavIcon name="admin"/></i><span>Administration</span></Link>:null}
      <form action={logout} className="mobile-only-signout"><button className="ghost-button" title="Sign out"><i><NavIcon name="signout"/></i><span>Sign out</span></button></form>
    </nav>
    <form action={logout} className="desktop-signout"><button className="ghost-button" title="Sign out"><i><NavIcon name="signout"/></i><span>Sign out</span></button></form>
  </aside>;
}
