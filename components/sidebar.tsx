"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect,useState } from "react";
import { logout } from "@/app/login/actions";

const links=[
  ["/dashboard","⌂","Souhrn"],["/flights","✈","Lety"],["/flights/new","＋","Přidat let"],["/map","◎","Mapa"],
  ["/database","▤","Databáze"],["/export","⇩","Export"],["/profile","●","Profil"],
] as const;
export function Sidebar({role="user"}:{role?:"admin"|"user"}){
  const pathname=usePathname(); const [collapsed,setCollapsed]=useState(false); const [mobile,setMobile]=useState(false);
  useEffect(()=>{setCollapsed(localStorage.getItem("logbook-sidebar")==="collapsed")},[]);
  const toggle=()=>{const next=!collapsed;setCollapsed(next);localStorage.setItem("logbook-sidebar",next?"collapsed":"open")};
  return <aside className={`sidebar${collapsed?" collapsed":""}${mobile?" mobile-open":""}`}>
    <div className="sidebar-brand"><span className="brand-symbol">✈</span><div><p className="eyebrow">PILOT</p><h2>Logbook</h2></div><button className="sidebar-toggle" type="button" onClick={toggle} aria-label="Sbalit navigaci">{collapsed?"›":"‹"}</button><button className="mobile-toggle" type="button" onClick={()=>setMobile(!mobile)} aria-label="Otevřít navigaci">☰</button></div>
    <nav>{links.map(([href,icon,label])=>{const active=href==="/dashboard"?pathname===href:href==="/flights"?pathname===href||/^\/flights\/\d/.test(pathname):pathname===href||pathname.startsWith(`${href}/`);return <Link key={href} className={active?"active":""} href={href} title={label} onClick={()=>setMobile(false)}><i>{icon}</i><span>{label}</span></Link>})}{role==="admin"?<Link className={pathname.startsWith("/admin")?"active":""} href="/admin" title="Administrace"><i>⚙</i><span>Administrace</span></Link>:null}</nav>
    <form action={logout}><button className="ghost-button" title="Odhlásit se"><i>↪</i><span>Odhlásit se</span></button></form>
  </aside>;
}
