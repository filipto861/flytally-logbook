"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect,useRef,useState } from "react";
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

export function Sidebar({role="user",attentionCount=0,notificationCount=0}:{role?:"admin"|"user";attentionCount?:number;notificationCount?:number}){
  const pathname=usePathname();
  const [collapsed,setCollapsed]=useState(false);
  const [mobile,setMobile]=useState(false);
  const [moreOpen,setMoreOpen]=useState(false);
  const [morePosition,setMorePosition]=useState({top:180,left:84});
  const menuRef=useRef<HTMLElement|null>(null);
  const toggleRef=useRef<HTMLButtonElement|null>(null);
  const moreRef=useRef<HTMLButtonElement|null>(null);
  const morePanelRef=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{setCollapsed(localStorage.getItem("logbook-sidebar")==="collapsed")},[]);
  useEffect(()=>{setMobile(false);setMoreOpen(false)},[pathname]);
  useEffect(()=>{
    if(!moreOpen)return;
    const panel=morePanelRef.current;
    requestAnimationFrame(()=>panel?.querySelector<HTMLAnchorElement>("a[href]")?.focus());
    const outside=(event:PointerEvent)=>{
      const target=event.target;
      if(!(target instanceof Node))return;
      if(!panel?.contains(target)&&!moreRef.current?.contains(target))setMoreOpen(false);
    };
    const keydown=(event:KeyboardEvent)=>{
      if(event.key!=="Escape")return;
      event.preventDefault();
      setMoreOpen(false);
      requestAnimationFrame(()=>moreRef.current?.focus());
    };
    const dismiss=()=>setMoreOpen(false);
    document.addEventListener("pointerdown",outside);
    window.addEventListener("keydown",keydown);
    window.addEventListener("resize",dismiss);
    return()=>{
      document.removeEventListener("pointerdown",outside);
      window.removeEventListener("keydown",keydown);
      window.removeEventListener("resize",dismiss);
    };
  },[moreOpen]);
  useEffect(()=>{
    if(!mobile)return;
    const previous=document.body.style.overflow;
    const menu=menuRef.current;
    const focusables=()=>Array.from(menu?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')??[]);
    requestAnimationFrame(()=>focusables()[0]?.focus());
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();setMobile(false);requestAnimationFrame(()=>toggleRef.current?.focus());return}
      if(event.key!=="Tab")return;
      const items=focusables();if(!items.length)return;
      const first=items[0],last=items[items.length-1],active=document.activeElement;
      if(event.shiftKey&&active===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&active===last){event.preventDefault();first.focus()}
    };
    document.body.style.overflow="hidden";
    window.addEventListener("keydown",keydown);
    return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",keydown)};
  },[mobile]);
  const toggle=()=>{
    const next=!collapsed;
    setCollapsed(next);
    setMoreOpen(false);
    localStorage.setItem("logbook-sidebar",next?"collapsed":"open");
  };
  const toggleMore=()=>{
    if(moreOpen){setMoreOpen(false);return}
    const rect=moreRef.current?.getBoundingClientRect();
    if(rect){
      setMorePosition({
        top:Math.max(12,Math.min(rect.top,window.innerHeight-460)),
        left:Math.max(12,rect.right+13),
      });
    }
    setMoreOpen(true);
  };
  const activeFor=(href:string)=>href==="/dashboard"
    ? pathname===href
    : href==="/flights"
      ? pathname===href||pathname.startsWith("/flights/")||pathname==="/fstd"
      : pathname===href||pathname.startsWith(`${href}/`);

  const moreActive=recordLinks.some(link=>activeFor(link.href))||(role==="admin"&&pathname.startsWith("/admin"));

  return <aside className={`sidebar${collapsed?" collapsed":""}${mobile?" mobile-open":""}`}>
    <div className="sidebar-brand"><span className="brand-symbol"><img src="/logbook_icon.png" alt="" /></span><div className={styles.brandCopy}><p className="eyebrow">LOGBOOK</p><h2>FlyTally</h2></div><span className="sidebar-layout-controls"><button className="sidebar-toggle" type="button" onClick={toggle} aria-label={collapsed?"Expand navigation":"Collapse navigation"} aria-expanded={!collapsed} title={collapsed?"Expand sidebar":"Collapse sidebar"}><NavIcon name={collapsed?"sidebar-expand":"sidebar-collapse"}/><span>{collapsed?"Expand sidebar":"Collapse sidebar"}</span></button></span><span className={styles.headerActions}><button ref={toggleRef} className="mobile-toggle" type="button" onClick={()=>setMobile(!mobile)} aria-label={mobile?"Close navigation":"Open navigation"} aria-expanded={mobile} aria-controls="primary-navigation">{mobile?"×":"☰"}</button></span></div>
    <button className="mobile-nav-backdrop" type="button" aria-label="Close navigation" tabIndex={mobile?0:-1} onClick={()=>{setMobile(false);requestAnimationFrame(()=>toggleRef.current?.focus())}}/>
    <nav ref={menuRef} id="primary-navigation" aria-label="Main navigation">
      <Link className={styles.primaryAction} href="/flights/new" title="Add flight" onClick={()=>setMobile(false)}><i><NavIcon name="add"/></i><span>Add flight</span></Link>

      <div className={styles.primaryNavLabel}>Workspace</div>

      {mainLinks.map(link=>{
        const active=activeFor(link.href),flights=link.href==="/flights";
        return <Link key={link.href} className={active?"active":""} href={link.href} title={link.label} aria-label={link.label} aria-current={active?"page":undefined} onClick={()=>setMobile(false)}><i><NavIcon name={link.icon}/></i><span>{link.label}</span>{flights&&attentionCount>0?<b className="notification-badge" aria-label={`${attentionCount} flights need attention`}>{Math.min(attentionCount,99)}</b>:null}</Link>
      })}

      <button ref={moreRef} type="button" className={`sidebar-more-trigger${moreActive?" is-current":""}`} onClick={toggleMore} title="More — Pilot & records" aria-label="More navigation — Pilot & records" aria-expanded={moreOpen} aria-controls="sidebar-more-panel"><NavIcon name="more"/></button>

      <div className={styles.group}>
        <div className={styles.groupTitle}><i><NavIcon name="manage"/></i><span>Pilot & records</span></div>
        {recordLinks.map(link=>{const active=activeFor(link.href);return <Link key={link.href} className={`${active?"active":""} ${styles.recordLink}`} href={link.href} title={link.label} aria-label={link.label} aria-current={active?"page":undefined} onClick={()=>setMobile(false)}><i><NavIcon name={link.icon}/></i><span>{link.label}</span></Link>})}
      </div>

      {role==="admin"?<Link className={`${pathname.startsWith("/admin")?"active":""} ${styles.adminLink}`} href="/admin" title="Administration" aria-current={pathname.startsWith("/admin")?"page":undefined} onClick={()=>setMobile(false)}><i><NavIcon name="admin"/></i><span>Administration</span></Link>:null}
      <form action={logout} className="mobile-only-signout"><button className="ghost-button" title="Sign out"><i><NavIcon name="signout"/></i><span>Sign out</span></button></form>
    </nav>
    {moreOpen&&collapsed?<div ref={morePanelRef} id="sidebar-more-panel" className="sidebar-more-panel" style={{top:morePosition.top,left:morePosition.left}} aria-label="Pilot and records navigation">
      <div className="sidebar-more-panel-title">Pilot & records</div>
      {recordLinks.map(link=><Link key={link.href} href={link.href} aria-current={activeFor(link.href)?"page":undefined} onClick={()=>setMoreOpen(false)}><NavIcon name={link.icon}/>{link.label}</Link>)}
      {role==="admin"?<Link href="/admin" aria-current={pathname.startsWith("/admin")?"page":undefined} onClick={()=>setMoreOpen(false)}><NavIcon name="admin"/>Administration</Link>:null}
    </div>:null}
    <div className="sidebar-utility"><NotificationBell initialCount={notificationCount} onNavigate={()=>setMobile(false)}/><form action={logout} className="desktop-signout"><button className="ghost-button" title="Sign out"><i><NavIcon name="signout"/></i><span>Sign out</span></button></form></div>
  </aside>;
}
