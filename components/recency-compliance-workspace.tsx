import Link from "next/link";
import { CredentialsNavigation } from "@/components/credentials-navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getRecencyComplianceWorkspaceForUser } from "@/lib/recency-workspace-service";
import type { ComplianceWorkspaceItem,ComplianceWorkspaceStatus } from "@/lib/recency-workspace";
import type { RecencyRequirement } from "@/lib/recency-engine";
import { RecencyPanel } from "@/components/recency-panel";
import { SplRecencyPanel } from "@/components/spl-recency-panel";
import { HelicopterRecencyPanel } from "@/components/helicopter-recency-panel";
import { BalloonRecencyPanel } from "@/components/balloon-recency-panel";
import { PushNotificationInline } from "@/components/push-notification-controls";

const categoryLabels:Record<string,string>={aeroplane:"Aeroplane",helicopter:"Helicopter",sailplane:"Sailplane",balloon:"Balloon",ull:"ULL",other:"Other"};
const categoryLabel=(value:string)=>categoryLabels[value]??value;
const statusClass=(status:ComplianceWorkspaceStatus)=>status==="current"?"status-on":status==="not-current"?"status-off":status==="incomplete-evidence"?"record-status":"status-warning";
const requirementValue=(item:RecencyRequirement)=>item.unit==="hours"?`${Math.floor(item.current)}:${String(Math.round((item.current-Math.floor(item.current))*60)).padStart(2,"0")} / ${Math.floor(item.target)}:${String(Math.round((item.target-Math.floor(item.target))*60)).padStart(2,"0")}`:`${Math.round(item.current)} / ${Math.round(item.target)}`;

function WorkspaceRow({item}:{item:ComplianceWorkspaceItem}){
  return <article className={`compliance-row compliance-${item.status}`}><div className="compliance-row-main"><div className="compliance-row-kicker"><span>{item.family}{item.code?` · ${item.code}`:""}</span><span>{categoryLabel(item.category)}</span></div><div className="compliance-row-title"><strong>{item.title}</strong><b className={statusClass(item.status)}>{item.statusLabel}</b></div><p>{item.summary}</p>{item.requirements.length?<div className="compliance-requirements">{item.requirements.map(requirement=><span className={requirement.met?"met":"missing"} key={requirement.id}><small>{requirement.label}</small><strong>{requirementValue(requirement)}</strong></span>)}</div>:null}<div className="compliance-row-meta">{item.windowLabel?<span>{item.windowLabel}</span>:null}{item.nextDate?<span>Next date · {item.nextDate}</span>:null}{item.evidenceSummary?<span>Evidence · {item.evidenceSummary}</span>:null}</div>{item.evidenceLinks.length?<details className="compliance-evidence"><summary>Recorded evidence</summary><div>{item.evidenceLinks.map(link=><span key={link.id}><span><strong>{link.label}</strong>{link.detail?<small>{link.detail}</small>:null}</span>{link.href?<Link href={link.href}>Open</Link>:null}</span>)}</div></details>:null}</div><Link className="compliance-open" href={item.href}>{item.kind==="recency"?"Details":"Open"}</Link></article>;
}

export async function RecencyComplianceWorkspace({detailed=false}:{detailed?:boolean}){
  if(detailed)return <><CredentialsNavigation active="recency"/><main className="compliance-workspace"><div className="compliance-detail-nav"><div><p className="eyebrow">EVIDENCE & SETTINGS</p><h2>Detailed recency records</h2><p className="muted">Edit monitoring and structured evidence here. The normal Recency view stays focused on current status and required action.</p></div><Link className="secondary-button" href="/credentials?view=recency">Back to recency</Link></div><RecencyPanel/><SplRecencyPanel/><HelicopterRecencyPanel/><BalloonRecencyPanel/></main></>;

  const{userId}=await requireUser();
  const state=await getRecencyComplianceWorkspaceForUser(userId);
  const flyingItems=state.items.filter(item=>item.kind==="recency"||item.kind==="setup");
  const attention=flyingItems.filter(item=>item.status!=="current");
  const currentFlying=flyingItems.filter(item=>item.status==="current");
  const heroLabel=!flyingItems.length?"NOT CONFIGURED":attention.length?"NEEDS ATTENTION":"CURRENT";
  const heroClass=!flyingItems.length?"record-status":attention.some(item=>item.status==="not-current")?"status-off":attention.length?"status-warning":"status-on";

  return <><CredentialsNavigation active="recency"/><main className="compliance-workspace">
    <section className="compliance-hero"><div><p className="eyebrow">FLYING RECENCY</p><h2>{!flyingItems.length?"No active recency monitoring":attention.length?attention.length===1?"1 recency item needs attention":`${attention.length} recency items need attention`:"Your monitored recency is current"}</h2><p className="muted">{!flyingItems.length?"Add the relevant licence, qualification or aircraft profile, then configure only the monitoring you actually need.":attention.length?"Open an item below to see the requirement and supporting evidence.":"Current privileges stay collapsed below; evidence and monitor editing are available only when you open them."}</p></div><div className="compliance-hero-actions"><b className={heroClass}>{heroLabel}</b><Link className="secondary-button" href="/credentials?view=recency&detail=1">Evidence & settings</Link></div></section>
    <PushNotificationInline context="recency"/>

    {attention.length?<section className="compliance-section"><div className="compliance-section-heading"><div><p className="eyebrow">NEEDS ATTENTION</p><h2>{attention.length===1?"Review this item":`Review ${attention.length} items`}</h2></div><span>Most important first</span></div><div className="compliance-list">{attention.map(item=><WorkspaceRow item={item} key={item.id}/>)}</div></section>:null}

    {currentFlying.length?<details className="compliance-current-monitoring"><summary><span><span className="adaptive-kicker">CURRENT FLYING RECENCY</span><strong>Current monitored privileges</strong><small>{state.activeCategories.length?state.activeCategories.map(categoryLabel).join(" · "):"Active flying recency"}</small></span><b className="status-on">{currentFlying.length} CURRENT</b></summary><div className="compliance-list compliance-list-secondary">{currentFlying.map(item=><WorkspaceRow item={item} key={item.id}/>)}</div></details>:null}

    {!flyingItems.length?<section className="panel compliance-empty"><strong>Nothing to evaluate yet</strong><p className="muted">Recency is intentionally not inferred from flight history alone when the supporting licence, privilege or aircraft context is missing.</p><Link className="secondary-button" href="/credentials?view=records">Open records</Link></section>:null}
  </main></>;
}
