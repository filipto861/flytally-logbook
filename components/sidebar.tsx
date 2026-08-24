"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect,useState } from "react";
import { logout } from "@/app/login/actions";

const links=[
  {href:"/dashboard",icon:"⌂",label:"Dashboard"},
  {href:"/flights",icon:"✈",label:"Flights"},
  {href:"/fstd",icon:"↳",label:"FSTD sessions",sub:true},
  {href:"/flights/new",icon:"＋",label:"Add flight"},
  {href:"/map",icon:"◎",label:"Map"},
  {href:"/database",icon:"▤",label:"Database"},
  {href:"/data",icon:"◆",label:"Data"},
  {href:"/profile",icon:"●",label:"Profile"},
] as const;
export function Sidebar({role="user"}:{role?:"admin"|"user"}){
  const pathname=usePathname(); const [collapsed,setCollapsed]=useState(false); const [mobile,setMobile]=useState(false);
  useEffect(()=>{setCollapsed(localStorage.getItem("logbook-sidebar")==="collapsed")},[]);
  const toggle=()=>{const next=!collapsed;setCollapsed(next);localStorage.setItem("logbook-sidebar",next?"collapsed":"open")};
  return <aside className={`sidebar${collapsed?" collapsed":""}${mobile?" mobile-open":""}`}>
    <div className="sidebar-brand"><span className="brand-symbol"><img src="/logbook_icon.png" alt="" /></span><div><p className="eyebrow">PILOT</p><h2>FlyTally</h2></div><button className="sidebar-toggle" type="button" onClick={toggle} aria-label="Collapse navigation">{collapsed?"›":"‹"}</button><button className="mobile-toggle" type="button" onClick={()=>setMobile(!mobile)} aria-label="Open navigation">☰</button></div>
    <nav>{links.map(({href,icon,label,sub})=>{const flightsActive=href==="/flights"&&(pathname===href||/^\/flights\/\d/.test(pathname)||pathname==="/fstd");const active=href==="/dashboard"?pathname===href:href==="/flights"?flightsActive:pathname===href||pathname.startsWith(`${href}/`);return <Link key={href} className={`${active?"active":""}${sub?" sidebar-sub-link":""}`} href={href} title={label} onClick={()=>setMobile(false)}><i>{icon}</i><span>{label}</span></Link>})}{role==="admin"?<Link className={pathname.startsWith("/admin")?"active":""} href="/admin" title="Administration"><i>⚙</i><span>Administration</span></Link>:null}</nav>
    <form action={logout}><button className="ghost-button" title="Sign out"><i>↪</i><span>Sign out</span></button></form>
  </aside>;
}
