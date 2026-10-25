import Link from "next/link";
import { formatDuration,type DashboardOverviewData } from "@/lib/data/dashboard";
import { formatDateOnly } from "@/lib/display-format";
import type { RecencySnapshot } from "@/lib/recency-service";
import type { DashboardPaceView } from "@/lib/dashboard-pace";
import { DashboardPace } from "@/components/dashboard-pace";

const numberLabel=(value:number,singular:string,plural:string)=>`${value} ${value===1?singular:plural}`;

export type DashboardLicenceSummary={id:number;licenceType:string;validityMode:string;validUntil:string;recencyUntil:string};
const isRecordedDay=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(new Date(date+"T00:00:00Z").getTime())&&new Date(date+"T00:00:00Z").toISOString().slice(0,10)===date;
function recordedLicenceValidity(licence:DashboardLicenceSummary,today:string){
  // LAPL licence validity is unlimited in the existing Records editor; this never asserts privileges or recency.
  if(["LAPL(A)","LAPL(H)"].includes(licence.licenceType.toUpperCase())||licence.validityMode==="unlimited")return{label:"Unlimited",tone:"neutral"};
  if(licence.validityMode!=="date"&&licence.validityMode!=="recency")return{label:"Validity not recorded",tone:"muted"};
  const date=licence.validityMode==="recency"?licence.recencyUntil:licence.validUntil;
  if(!isRecordedDay(date))return{label:licence.validityMode==="recency"?"Recency date not recorded":"Expiry not recorded",tone:"muted"};
  const days=(Date.parse(date+"T00:00:00Z")-Date.parse(today+"T00:00:00Z"))/86400000;
  const prefix=licence.validityMode==="recency"?"Recorded recency":"Until";
  return{label:`${prefix} ${formatDateOnly(date)}${days<0?" · date passed":days<=30?" · soon":""}`,tone:days<0?"past":days<=30?"soon":"neutral"};
}

export function DashboardEditorial({data,recencySnapshot,actionCount,attentionCount,pace,licences,asOf}:{data:DashboardOverviewData;recencySnapshot:RecencySnapshot|null;actionCount:number;attentionCount:number;pace:DashboardPaceView;licences:DashboardLicenceSummary[];asOf:string}){
  const flight=data.lastFlight;
  // The persisted snapshot is historical evidence, never a live privilege determination.
  // "attention" covers incomplete evidence too: it must NOT be relabelled "Not current".
  const recencyTone=recencySnapshot?.status==="ok"?"ok":recencySnapshot?.status==="warning"?"warning":recencySnapshot?.status==="attention"?"review":"unknown";
  const recencyHeadline=recencyTone==="ok"?"Last check: OK":recencyTone==="warning"?"Last check: Due soon":recencyTone==="review"?"Last check: Needs review":"Not assessed";
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
      <section className={`d1v11-recency d1v11-recency--${recencyTone}`} aria-labelledby="d1v11-recency-title">
        <Link className="d1v11-recency-primary" href="/credentials">
          <span className="d1v11-kicker">LICENCES & RECENCY</span>
          <h2 id="d1v11-recency-title"><span className="d1v11-recency-marker" aria-hidden="true"/>{recencyHeadline}</h2>
          {recencySnapshot?<span className="d1v11-recency-date">{formatDateOnly(recencySnapshot.generatedAt.slice(0,10))}</span>:null}
          <span className="d1v11-recency-arrow" aria-hidden="true">→</span>
        </Link>
        <div className="d1v11-licences" aria-label="Recorded licences">
          <div className="d1v11-licences-heading"><span className="d1v11-kicker">RECORDED LICENCES</span><small>{licences.length} active</small></div>
          {licences.length?<ul className="d1v11-licences-list">{licences.map(licence=>{
            const validity=recordedLicenceValidity(licence,asOf);
            return <li key={licence.id}><strong>{licence.licenceType||"Licence type not recorded"}</strong><span className={`d1v11-licence-validity d1v11-licence-validity--${validity.tone}`}>{validity.label}</span></li>;
          })}</ul>:<p className="d1v11-licences-empty">No active licences recorded</p>}
          <Link className="d1v11-licences-link" href="/credentials?view=licences">All licences &amp; ratings <span aria-hidden="true">→</span></Link>
        </div>
        {attentionCount>0||actionCount>0?<div className="d1v11-attention" aria-label="Items requiring attention">
          {attentionCount>0?<Link href="/flights/needs-attention">{numberLabel(attentionCount,"flight needs","flights need")} review <span aria-hidden="true">→</span></Link>:null}
          {actionCount>0?<Link href="/actions">{numberLabel(actionCount,"pending action","pending actions")} <span aria-hidden="true">→</span></Link>:null}
        </div>:null}
      </section>
    </div>
    <DashboardPace pace={pace}/>
  </div>;
}
