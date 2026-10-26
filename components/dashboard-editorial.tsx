import Link from "next/link";
import { formatDuration,type DashboardOverviewData } from "@/lib/data/dashboard";
import { formatDateOnly } from "@/lib/display-format";
import { buildCredentialOverview,type DashboardLicenceSummary,type DashboardQualificationSummary,type DashboardDocumentSummary } from "@/lib/dashboard-credential-overview";
import type { DashboardPassengerIndicator } from "@/lib/dashboard-passenger-overview";
import type { DashboardLaplIndicator } from "@/lib/dashboard-lapl-overview";
import type { RecencySnapshot } from "@/lib/recency-service";
import type { DashboardPaceView } from "@/lib/dashboard-pace";
import { DashboardPace } from "@/components/dashboard-pace";

const numberLabel=(value:number,singular:string,plural:string)=>`${value} ${value===1?singular:plural}`;

export function DashboardEditorial({data,recencySnapshot,actionCount,attentionCount,pace,licences,qualifications,documents,passengerRecency,laplRecency,asOf}:{data:DashboardOverviewData;recencySnapshot:RecencySnapshot|null;actionCount:number;attentionCount:number;pace:DashboardPaceView;licences:DashboardLicenceSummary[];qualifications:DashboardQualificationSummary[];documents:DashboardDocumentSummary[];passengerRecency:DashboardPassengerIndicator[];laplRecency:DashboardLaplIndicator|null;asOf:string}){
  const flight=data.lastFlight;
  // The persisted snapshot is historical evidence, never a live privilege determination.
  // "attention" covers incomplete evidence too: it must NOT be relabelled "Not current".
  const recencyTone=recencySnapshot?.status==="ok"?"ok":recencySnapshot?.status==="warning"?"warning":recencySnapshot?.status==="attention"?"review":"unknown";
  const recencyHeadline=recencyTone==="ok"?"Last check: OK":recencyTone==="warning"?"Last check: Due soon":recencyTone==="review"?"Last check: Needs review":"Not assessed";
  const credentialOverview=buildCredentialOverview({licences,qualifications,documents,asOf,laplRecency});
  const laplRatingStatus=["CURRENT","NOT CURRENT","UNVERIFIED"].includes(credentialOverview.ratings.status);
  const credentialCategories=[
    {key:"licences",label:"LICENCES",subtitle:"Recorded expiry dates",href:"/credentials?view=licences",summary:credentialOverview.licences},
    {key:"ratings",label:"RATINGS",subtitle:laplRatingStatus?"LAPL(A) · FCL.140.A (recorded evidence)":"Recorded validity dates",href:laplRatingStatus?"/credentials?view=recency":"/credentials?view=licences",summary:credentialOverview.ratings},
    {key:"documents",label:"DOCUMENTS",subtitle:"Other saved documents",href:"/credentials?view=documents",summary:credentialOverview.documents},
    {key:"medical",label:"MEDICAL",subtitle:"Recorded medical expiry",href:"/credentials?view=documents",summary:credentialOverview.medical},
  ];
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
        <div className="d1v11-credential-overview" role="group" aria-label="Recorded credentials overview">
          {credentialCategories.map(category=>
            <Link key={category.key} className="d1v11-credential-row" href={category.href}>
              <span className="d1v11-credential-info">
                <strong>{category.label}</strong>
                <small>{category.subtitle}</small>
              </span>
              <span className="d1v11-credential-result">
                <span className={`d1v11-credential-status d1v11-credential-status--${category.summary.tone}`}>
                  <span className="d1v11-credential-dot" aria-hidden="true"/>
                  {category.summary.status}
                </span>
                <small>{category.summary.count} recorded{category.summary.reviewCount>0?` · ${category.summary.reviewCount} to review`:""}{category.key==="ratings"&&laplRatingStatus?" · FCL.140.A":""}</small>
                {category.key==="ratings"&&laplRatingStatus&&laplRecency?.status==="CURRENT"&&laplRecency.forecastDate?<small>Next recency change: {formatDateOnly(laplRecency.forecastDate)} (if no further flights)</small>:null}
                {category.key==="ratings"&&!laplRatingStatus&&laplRecency?<small>LAPL(A) FCL.140.A: {laplRecency.status}</small>:null}
              </span>
              <span className="d1v11-credential-chevron" aria-hidden="true">→</span>
            </Link>
          )}
        </div>
        <div className="d1v11-passenger-overview" role="group" aria-label="Passenger recency, recorded flight evidence">
          <Link className="d1v11-passenger-title" href="/credentials?view=recency">
            <strong>PASSENGER RECENCY</strong><span aria-hidden="true">→</span>
          </Link>
          {passengerRecency.length?passengerRecency.map(item=>
            <Link key={item.key} className="d1v11-passenger-row" href="/credentials?view=recency">
              <span className="d1v11-passenger-class">{item.label}</span>
              <span className="d1v11-passenger-value">
                <span className={`d1v11-credential-status d1v11-credential-status--${item.tone}`}><span className="d1v11-credential-dot" aria-hidden="true"/>{item.status}</span>
                <small>{item.until?`${item.dueSoon?"Due soon · ":""}Recorded through ${formatDateOnly(item.until)}`:item.status==="UNVERIFIED"?"Insufficient recorded evidence":item.status==="NOT CURRENT"?"Not met in recorded flights":"Open recency details"}</small>
              </span>
            </Link>
          ):<p className="d1v11-passenger-empty">No SEP/TMG passenger assessment available</p>}
          <small className="d1v11-passenger-disclaimer">Forecast assumes no new qualifying flights. Recorded evidence, not flight authorization.</small>
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
