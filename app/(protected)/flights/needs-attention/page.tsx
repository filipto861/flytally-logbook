import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { getIntelligentLogbookAttention } from "@/lib/intelligent-logbook-service";
import { FlightWorkspaceNav } from "@/components/flight-workspace-nav";

export const metadata={title:"Needs attention | FlyTally"};

export default async function NeedsAttentionPage(){
  const {userId}=await requireUser(),items=await getIntelligentLogbookAttention(userId),findingCount=items.reduce((sum,item)=>sum+item.insights.length,0);
  return <>
    <header className="page-header"><div><p className="eyebrow">INTELLIGENT LOGBOOK</p><h1>Needs attention</h1><p className="muted">Only stored flights with a concrete contradiction, invalid combination or incomplete data appear here. Unusual-but-valid history patterns do not create review tasks.</p></div><Link className="primary-link" href="/flights/new">＋ Add flight</Link></header>
    <FlightWorkspaceNav active="attention"/>
    <section className="flight-summary"><div><span>Flights to review</span><strong>{items.length}</strong><small>Actionable records only</small></div><div><span>Findings</span><strong>{findingCount}</strong><small>Explicit data conflicts or incomplete fields</small></div><div><span>Reviewed scope</span><strong>500</strong><small>Most recent stored flights</small></div></section>
    {items.length?<section className="panel"><div className="section-heading"><div><p className="eyebrow">EXISTING LOGBOOK</p><h2>Review queue</h2></div><span>{items.length}</span></div><div className="credential-list">{items.map(item=><article className="credential-card" style={{padding:"14px 16px"}} key={item.flightId}><div className="credential-main"><span>{item.date} · {item.registration} · {item.route}</span><strong>{item.insights.length} {item.insights.length===1?"finding":"findings"}</strong>{item.insights.map(insight=><div key={insight.code} style={{marginTop:"10px"}}><small><b>REVIEW · {insight.title}</b></small><small>{insight.message}</small>{insight.evidence?.length?<small><b>Based on:</b> {insight.evidence.map(source=>`${source.label}: ${source.value}`).join(" · ")}</small>:null}</div>)}</div><div className="form-actions"><Link className="secondary-button" href={`/flights/${item.flightId}`}>View flight</Link></div></article>)}</div></section>:<section className="panel"><div className="flight-empty-state"><span aria-hidden="true">✓</span><h2>Nothing needs attention</h2><p>No concrete data conflicts were found in the latest 500 stored flights. Longer flights, higher movement counts and other unusual-but-valid history patterns are not treated as problems.</p><Link className="secondary-button" href="/flights">Back to flights</Link></div></section>}
    <p className="muted">FlyTally never changes certified or regulatory data automatically. This queue is reserved for explicit data conflicts that are worth opening and checking.</p>
  </>;
}
