import Link from "next/link";
import { formatDuration,type DashboardOverviewData } from "@/lib/data/dashboard";
import { formatDateOnly } from "@/lib/display-format";
import type { RecencySnapshot } from "@/lib/recency-service";
import type { DashboardPaceView } from "@/lib/dashboard-pace";
import { DashboardPace } from "@/components/dashboard-pace";

const numberLabel=(value:number,singular:string,plural:string)=>`${value} ${value===1?singular:plural}`;

export function DashboardEditorial({data,recencySnapshot,actionCount,attentionCount,pace}:{data:DashboardOverviewData;recencySnapshot:RecencySnapshot|null;actionCount:number;attentionCount:number;pace:DashboardPaceView}){
  const flight=data.lastFlight;
  return <div className="d1v11-page">
    <header className="d1v11-mast">
      <div><p className="d1v11-kicker">PILOT WORKSPACE</p><h1>Flight overview.</h1></div>
      <Link href="/flights/new" className="d1v11-mobile-add">＋ Add flight</Link>
    </header>
    <div className="d1v11-columns">
      <section className="d1v11-summary" aria-label="Flying summary">
        <div className="d1v11-summary-header"><span className="d1v11-kicker">TOTAL FLYING TIME</span><span className="d1v11-pill">ALL TIME</span></div>
        <strong className="d1v11-total">{formatDuration(data.total.minutes)}</strong>
        <p className="d1v11-counts">{numberLabel(data.total.flights,"flight","flights")} · {numberLabel(data.total.landings,"landing","landings")}</p>
        {data.safetyMinutes>0?<p className="d1v11-safety-note">Includes {formatDuration(data.safetyMinutes)} safety pilot time (Dashboard only)</p>:null}
        <div className="d1v11-categories">
          <div><span className="d1v11-kicker">ULL</span><strong>{formatDuration(data.ull.minutes)}</strong><small>{numberLabel(data.ull.flights,"flight","flights")} · {numberLabel(data.ull.landings,"landing","landings")}</small></div>
          <div><span className="d1v11-kicker">EASA</span><strong>{formatDuration(data.easa.minutes)}</strong><small>{numberLabel(data.easa.flights,"flight","flights")} · {numberLabel(data.easa.landings,"landing","landings")}</small></div>
        </div>
        <div className="d1v11-latest">
          <div><span className="d1v11-kicker">LATEST FLIGHT</span>
          {flight?<><strong>{flight.departure||"—"} → {flight.arrival||"—"}</strong><small>{formatDateOnly(flight.date)} · {flight.registration||"No registration"}</small></>:<><strong>No flights yet</strong><small>Add your first flight to start your logbook.</small></>}</div>
          <Link href={flight?`/flights/${flight.id}`:"/flights/new"}>{flight?"Open flight →":"Add flight →"}</Link>
        </div>
      </section>
      <section className="d1v11-recency" aria-labelledby="d1v11-recency-title">
        <div className="d1v11-recency-top"><span className="d1v11-kicker">LICENCES & RECENCY</span><span className="d1v11-recency-state">{recencySnapshot?"SAVED SNAPSHOT":"NOT ASSESSED"}</span></div>
        <h2 id="d1v11-recency-title">{recencySnapshot?"Review your recency":"Not assessed"}</h2>
        <p className="d1v11-recency-detail">{recencySnapshot?recencySnapshot.label:"No saved recency assessment is available."}</p>
        {recencySnapshot?<p className="d1v11-recency-freshness">Snapshot {recencySnapshot.generatedAt.slice(0,10)} · Verify underlying evidence</p>:null}
        <Link className="d1v11-recency-link" href="/credentials">Open licences & recency <span aria-hidden="true">→</span></Link>
        {attentionCount>0||actionCount>0?<div className="d1v11-attention" aria-label="Items requiring attention">
          {attentionCount>0?<Link href="/flights/needs-attention">{numberLabel(attentionCount,"flight needs","flights need")} review <span aria-hidden="true">→</span></Link>:null}
          {actionCount>0?<Link href="/actions">{numberLabel(actionCount,"pending action","pending actions")} <span aria-hidden="true">→</span></Link>:null}
        </div>:null}
      </section>
    </div>
    <DashboardPace pace={pace}/>
  </div>;
}
