import Link from "next/link";
import { formatDuration,type DashboardOverviewData } from "@/lib/data/dashboard";
import { formatDateOnly } from "@/lib/display-format";
import type { RecencySnapshot } from "@/lib/recency-service";
import type { DashboardPaceView } from "@/lib/dashboard-pace";
import { DashboardPace } from "@/components/dashboard-pace";

const numberLabel=(value:number,singular:string,plural:string)=>`${value} ${value===1?singular:plural}`;

export type DashboardLicenceSummary={id:number;licenceType:string;validityMode:string;validUntil:string;recencyUntil:string};
export type DashboardQualificationSummary={id:number;qualificationType:string;licenceType:string;validityMode:string;validUntil:string;recencyUntil:string};
export type DashboardMedicalSummary={id:number;label:string;expiryDate:string};
const isRecordedDay=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&!date.startsWith("0000")&&Number.isFinite(new Date(date+"T00:00:00Z").getTime())&&new Date(date+"T00:00:00Z").toISOString().slice(0,10)===date;
function recordedDateValidity(licence:Pick<DashboardLicenceSummary,"validityMode"|"validUntil"|"recencyUntil">,today:string){
  // The date helper is intentionally independent of the parent licence type.
  if(licence.validityMode==="unlimited")return{label:"Unlimited",tone:"neutral"};
  if(licence.validityMode!=="date"&&licence.validityMode!=="recency")return{label:"Validity not recorded",tone:"muted"};
  const date=licence.validityMode==="recency"?licence.recencyUntil:licence.validUntil;
  if(!isRecordedDay(date))return{label:licence.validityMode==="recency"?"Recency date not recorded":"Expiry not recorded",tone:"muted"};
  const days=(Date.parse(date+"T00:00:00Z")-Date.parse(today+"T00:00:00Z"))/86400000;
  const prefix=licence.validityMode==="recency"?"Recorded recency":"Until";
  return{label:`${prefix} ${formatDateOnly(date)}${days<0?" · date passed":days<=30?" · soon":""}`,tone:days<0?"past":days<=30?"soon":"neutral"};
}

function recordedLicenceValidity(licence:DashboardLicenceSummary,today:string){
  // Only the LAPL licence itself has the legacy unlimited validity treatment.
  return recordedDateValidity({validityMode:["LAPL(A)","LAPL(H)"].includes(licence.licenceType.toUpperCase())?"unlimited":licence.validityMode,validUntil:licence.validUntil,recencyUntil:licence.recencyUntil},today);
}


// The Dashboard is a preview, not a licence register or regulatory clearance decision.
// Show recorded dates needing attention first; retain all entries in Records.
const previewLimits={licences:2,qualifications:2,medical:1} as const;
type RecordedValidity={label:string;tone:string};
function qualificationValidity(item:DashboardQualificationSummary,asOf:string){
  // A stored LAPL(A) SEP/TMG date is not a substitute for recency evidence.
  const needsRecency=item.licenceType.toUpperCase()==="LAPL(A)"&&/^(SEP|TMG)/i.test(item.qualificationType);
  return needsRecency?{label:"Check recency",tone:"muted"}:recordedDateValidity(item,asOf);
}
function medicalValidity(item:DashboardMedicalSummary,asOf:string){
  // Medical expiry is a saved document date, not a fitness or privilege determination.
  const expiry=item.expiryDate;
  return recordedDateValidity({validityMode:expiry>="9999-01-01"?"unlimited":"date",validUntil:expiry,recencyUntil:""},asOf);
}
function previewRows<T>(rows:readonly T[],limit:number,display:(row:T)=>RecordedValidity){
  const rank=(tone:string)=>tone==="past"?0:tone==="soon"?1:tone==="muted"?2:3;
  const ranked=rows.map((item,index)=>({item,index,validity:display(item)}));
  ranked.sort((a,b)=>rank(a.validity.tone)-rank(b.validity.tone)||a.index-b.index);
  const remaining=ranked.slice(limit);
  return {visible:ranked.slice(0,limit),more:remaining.length,hiddenNeedsReview:remaining.filter(row=>row.validity.tone!=="neutral").length};
}
export function DashboardEditorial({data,recencySnapshot,actionCount,attentionCount,pace,licences,qualifications,medical,asOf}:{data:DashboardOverviewData;recencySnapshot:RecencySnapshot|null;actionCount:number;attentionCount:number;pace:DashboardPaceView;licences:DashboardLicenceSummary[];qualifications:DashboardQualificationSummary[];medical:DashboardMedicalSummary[];asOf:string}){
  const flight=data.lastFlight;
  // The persisted snapshot is historical evidence, never a live privilege determination.
  // "attention" covers incomplete evidence too: it must NOT be relabelled "Not current".
  const recencyTone=recencySnapshot?.status==="ok"?"ok":recencySnapshot?.status==="warning"?"warning":recencySnapshot?.status==="attention"?"review":"unknown";
  const recencyHeadline=recencyTone==="ok"?"Last check: OK":recencyTone==="warning"?"Last check: Due soon":recencyTone==="review"?"Last check: Needs review":"Not assessed";
  const licencePreview=previewRows(licences,previewLimits.licences,licence=>recordedLicenceValidity(licence,asOf));
  const qualificationPreview=previewRows(qualifications,previewLimits.qualifications,item=>qualificationValidity(item,asOf));
  const medicalPreview=previewRows(medical,previewLimits.medical,item=>medicalValidity(item,asOf));
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
        <div className="d1v11-licences" role="group" aria-label="Recorded licences">
          <div className="d1v11-licences-heading"><span className="d1v11-kicker">RECORDED LICENCES</span><small>{licences.length} active</small></div>
          {licences.length?<ul className="d1v11-licences-list">{licencePreview.visible.map(({item:licence,validity})=>
            <li key={licence.id}><strong>{licence.licenceType||"Licence type not recorded"}</strong><span className={`d1v11-licence-validity d1v11-licence-validity--${validity.tone}`}>{validity.label}</span></li>
          )}</ul>:<p className="d1v11-licences-empty">No active licences recorded</p>}
          {licencePreview.more>0?<Link className="d1v11-overflow-link" href="/credentials?view=licences">+{licencePreview.more} more {licencePreview.more===1?"licence":"licences"}{licencePreview.hiddenNeedsReview>0? ` · ${licencePreview.hiddenNeedsReview} to review`:""} <span aria-hidden="true">→</span></Link>:null}
          <div className="d1v11-record-subgroup" role="group" aria-label="Recorded ratings and qualifications">
            <div className="d1v11-licences-heading"><span className="d1v11-kicker">RATINGS &amp; QUALIFICATIONS</span><small>{qualifications.length} recorded</small></div>
            {qualifications.length?<ul className="d1v11-licences-list">{qualificationPreview.visible.map(({item,validity})=>
              <li key={item.id}><strong>{item.qualificationType||"Qualification not named"}</strong><span className={`d1v11-licence-validity d1v11-licence-validity--${validity.tone}`}>{validity.label}</span></li>
            )}</ul>:<p className="d1v11-licences-empty">No ratings recorded</p>}
            {qualificationPreview.more>0?<Link className="d1v11-overflow-link" href="/credentials?view=licences">+{qualificationPreview.more} more {qualificationPreview.more===1?"rating":"ratings"}{qualificationPreview.hiddenNeedsReview>0?` · ${qualificationPreview.hiddenNeedsReview} to review`:""} <span aria-hidden="true">→</span></Link>:null}
          </div>
          <div className="d1v11-record-subgroup" role="group" aria-label="Recorded medical certificates">
            <div className="d1v11-licences-heading"><span className="d1v11-kicker">MEDICAL</span><small>{medical.length} recorded</small></div>
            {medical.length?<ul className="d1v11-licences-list">{medicalPreview.visible.map(({item,validity})=>
              <li key={item.id}><strong>{item.label||"Medical document"}</strong><span className={`d1v11-licence-validity d1v11-licence-validity--${validity.tone}`}>{validity.label}</span></li>
            )}</ul>:<p className="d1v11-licences-empty">No medical recorded</p>}
            {medicalPreview.more>0?<Link className="d1v11-overflow-link" href="/credentials?view=documents">+{medicalPreview.more} more {medicalPreview.more===1?"medical record":"medical records"}{medicalPreview.hiddenNeedsReview>0?` · ${medicalPreview.hiddenNeedsReview} to review`:""} <span aria-hidden="true">→</span></Link>:null}
          </div>
          <div className="d1v11-record-links">
            <Link className="d1v11-licences-link" href="/credentials?view=licences">All licences &amp; ratings <span aria-hidden="true">→</span></Link>
            <Link className="d1v11-licences-link" href="/credentials?view=documents">Medical &amp; documents <span aria-hidden="true">→</span></Link>
          </div>
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
