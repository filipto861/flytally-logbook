import Link from "next/link";
import { CredentialsNavigation } from "@/components/credentials-navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getRecencyComplianceWorkspaceForUser } from "@/lib/recency-workspace-service";
import type { ComplianceWorkspaceStatus } from "@/lib/recency-workspace";

const statusClass=(status:ComplianceWorkspaceStatus)=>status==="current"?"status-on":status==="not-current"?"status-off":status==="action-soon"?"status-warning":"record-status";

export async function AdaptivePilotOverview(){
  const{userId}=await requireUser();
  const state=await getRecencyComplianceWorkspaceForUser(userId);
  const attention=state.items.filter(item=>item.status!=="current");
  const currentCount=state.items.length-attention.length;
  const recencyAttention=attention.filter(item=>item.kind==="recency"||item.kind==="setup").length;
  const recordAttention=attention.length-recencyAttention;

  return <>
    <CredentialsNavigation active="overview"/>
    <main className="adaptive-workspace u2-overview">
      {state.items.length?<section className={`u2-status-hero ${attention.length?"needs-attention":"all-current"}`}>
        <div><span className="adaptive-kicker">RECORDED STATUS</span><h2>{attention.length?attention.length===1?"1 item needs attention":`${attention.length} items need attention`:"Everything recorded looks current"}</h2><p>{attention.length?`${recencyAttention?`${recencyAttention} recency`:""}${recencyAttention&&recordAttention?" · ":""}${recordAttention?`${recordAttention} record`:""} require review.`:"No monitored recency or recorded credential currently shows an issue."}</p></div>
        <b className={attention.length?"status-warning":"status-on"}>{attention.length?"NEEDS ATTENTION":"CURRENT"}</b>
      </section>:<section className="u2-status-hero no-data"><div><span className="adaptive-kicker">RECORDED STATUS</span><h2>No pilot records yet</h2><p>Add the records you actually hold. FlyTally will then surface only status that can be supported by saved evidence.</p></div><b className="record-status">SETUP</b></section>}

      {attention.length?<section className="u2-attention-section">
        <div className="adaptive-section-heading"><div><p className="eyebrow">WHAT MATTERS NOW</p><h2>Review these items</h2></div><span className="adaptive-category-count">Most important first</span></div>
        <div className="adaptive-status-list">{attention.map(item=><div className="adaptive-status-row" key={item.id}><div className="adaptive-status-copy"><strong>{item.title}</strong><span>{item.summary}</span></div><div className="adaptive-status-actions"><b className={statusClass(item.status)}>{item.statusLabel}</b><Link className="u2-inline-action" href={item.href}>Review</Link></div></div>)}</div>
      </section>:state.items.length?<section className="u2-current-summary"><span className="status-on">CURRENT</span><div><strong>{currentCount} monitored item{currentCount===1?"":"s"} without an issue</strong><p className="muted">Detailed records stay out of the overview until you choose Recency or Records.</p></div></section>:null}

      <div className="u2-overview-actions"><Link className="secondary-button" href="/credentials?view=recency">Open recency</Link><Link className="secondary-button" href="/credentials?view=records">Manage records</Link></div>
    </main>
  </>;
}
