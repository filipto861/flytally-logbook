"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect,useState } from "react";
import { logout } from "@/app/login/actions";
import styles from "./sidebar.module.css";

// Certification remains contextual on flight/FSTD records; there is no standalone sidebar destination.
const mainLinks=[
  {href:"/dashboard",icon:"⌂",label:"Dashboard"},
  {href:"/flights",icon:"✈",label:"Flights"},
  {href:"/fstd",icon:"↳",label:"FSTD sessions",sub:true},
  {href:"/flights/new",icon:"＋",label:"Add flight"},
  {href:"/map",icon:"◎",label:"Map"},
] as const;
const profileLinks=[
  {href:"/profile",icon:"⚙",label:"Settings"},
  {href:"/database",icon:"▤",label:"Database"},
  {href:"/data",icon:"◆",label:"Export"},
] as const;

export function Sidebar({role="user"}:{role?:"admin"|"user"}){
  const pathname=usePathname(); const [collapsed,setCollapsed]=useState(false); const [mobile,setMobile]=useState(false);
  useEffect(()=>{setCollapsed(localStorage.getItem("logbook-sidebar")==="collapsed")},[]);
  const toggle=()=>{const next=!collapsed;setCollapsed(next);localStorage.setItem("logbook-sidebar",next?"collapsed":"open")};
  const activeFor=(href:string)=>href==="/dashboard"?pathname===href:href==="/flights"?(pathname===href||/^\/flights\/\d/.test(pathname)||pathname==="/fstd"):pathname===href||pathname.startsWith(`${href}/`);
  return <aside className={`sidebar${collapsed?" collapsed":""}${mobile?" mobile-open":""}`}>
    <div className="sidebar-brand"><span className="brand-symbol"><img src="/logbook_icon.png" alt="" /></span><div><p className="eyebrow">LOGBOOK</p><h2>FlyTally</h2></div><button className="sidebar-toggle" type="button" onClick={toggle} aria-label={collapsed?"Expand navigation":"Collapse navigation"}>{collapsed?"›":"‹"}</button><button className="mobile-toggle" type="button" onClick={()=>setMobile(!mobile)} aria-label={mobile?"Close navigation":"Open navigation"} aria-expanded={mobile}>☰</button></div>
    <nav>
      {mainLinks.map(link=>{const sub="sub" in link&&link.sub,active=activeFor(link.href);return <Link key={link.href} className={`${active?"active":""}${sub?" sidebar-sub-link":""}`} href={link.href} title={link.label} aria-current={active?"page":undefined} onClick={()=>setMobile(false)}><i>{link.icon}</i><span>{link.label}</span></Link>})}
      <div className={styles.group}>
        <div className={styles.groupTitle}><i>●</i><span>Profile</span></div>
        {profileLinks.map(link=>{const active=activeFor(link.href);return <Link key={link.href} className={`${active?"active":""} sidebar-sub-link ${styles.profileLink}`} href={link.href} title={`${link.label} · Profile`} aria-current={active?"page":undefined} onClick={()=>setMobile(false)}><i>{link.icon}</i><span>{link.label}</span></Link>})}
      </div>
      {role==="admin"?<Link className={pathname.startsWith("/admin")?"active":""} href="/admin" title="Administration" aria-current={pathname.startsWith("/admin")?"page":undefined}><i>⚙</i><span>Administration</span></Link>:null}
    </nav>
    <form action={logout}><button className="ghost-button" title="Sign out"><i>↪</i><span>Sign out</span></button></form>
  </aside>;
}
