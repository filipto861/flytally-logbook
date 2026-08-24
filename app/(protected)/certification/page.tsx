import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { blockingComplianceIssues,fcl050FlightCompliance,fstdCompliance } from "@/lib/fcl050-compliance";
import { integrityLabel,verifyFlightCertification,verifyFstdCertification } from "@/lib/certification-integrity";

export const metadata={title:"Certification | FlyTally"};
export const dynamic="force-dynamic";
const text=(value:unknown)=>String(value??"").trim();
const snapshot=(value:unknown)=>value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};

type CenterItem={key:string;kind:"Flight"|"FSTD";date:string;title:string;subtitle:string;status:string;detail:string;href:string;priority:number};
type IntegrityItem={key:string;kind:string;title:string;revision:string;status:string;hash:string;href:string};

export default async function CertificationPage(){
  const {userId}=await requireUser();await ensureDatabaseOptimizations();
  const [pilotRows,flightRows,fstdRows,flightArchives,fstdArchives]=await Promise.all([
    sql`SELECT display_name FROM users WHERE id=${userId} LIMIT 1` as unknown as Promise<Array<Record<string,unknown>>>,
    sql`SELECT f.*,CASE WHEN f.off_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND f.on_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN MOD((split_part(f.on_block,':',1)::int*60+split_part(f.on_block,':',2)::int)-(split_part(f.off_block,':',1)::int*60+split_part(f.off_block,':',2)::int)+1440,1440) ELSE 0 END block_minutes FROM flights f WHERE f.user_id=${userId} AND UPPER(TRIM(COALESCE(f.evidence,'')))='EASA' ORDER BY f.date DESC,f.off_block DESC NULLS LAST,f.id DESC` as unknown as Promise<Array<Record<string,unknown>>>,
    sql`SELECT *,session_date::text session_date FROM fstd_sessions WHERE user_id=${userId} ORDER BY session_date DESC,id DESC` as unknown as Promise<Array<Record<string,unknown>>>,
    sql`SELECT flight_id,revision_number,certification_hash,certification_version,snapshot_data FROM flight_certified_revisions WHERE user_id=${userId} ORDER BY flight_id,revision_number DESC` as unknown as Promise<Array<Record<string,unknown>>>,
    sql`SELECT fstd_session_id,revision_number,certification_hash,certification_version,snapshot_data FROM fstd_certified_revisions WHERE user_id=${userId} ORDER BY fstd_session_id,revision_number DESC` as unknown as Promise<Array<Record<string,unknown>>>
  ]);
  const pilotName=text(pilotRows[0]?.display_name),items:CenterItem[]=[],integrityItems:IntegrityItem[]=[];
  let ready=0,needsAttention=0,certifiedCount=0,correctionDrafts=0,integrityChecks=0,integrityProblems=0;

  for(const row of flightRows){
    const id=Number(row.id),revision=Math.max(1,Number(row.record_revision||1)),certified=Boolean(row.certified_at),correction=!certified&&revision>1,issues=blockingComplianceIssues(fcl050FlightCompliance(row,pilotName)),href=`/flights/${id}`;
    if(certified){certifiedCount++;const result=verifyFlightCertification(row,userId);integrityChecks++;if(result.status!=="verified"){integrityProblems++;integrityItems.push({key:`flight-current-${id}`,kind:"Flight",title:`${text(row.registration)} · ${text(row.date)}`,revision:`R${revision} current`,status:integrityLabel(result),hash:text(row.certification_hash),href})}}
    else if(correction){correctionDrafts++;items.push({key:`flight-${id}`,kind:"Flight",date:text(row.date),title:`${text(row.registration)||"Aircraft"} · ${text(row.departure)||"—"} → ${text(row.arrival)||"—"}`,subtitle:text(row.role)||"EASA flight",status:`Correction R${revision}`,detail:text(row.correction_reason)||"Correction draft",href,priority:0})}
    else if(issues.length){needsAttention++;items.push({key:`flight-${id}`,kind:"Flight",date:text(row.date),title:`${text(row.registration)||"Aircraft"} · ${text(row.departure)||"—"} → ${text(row.arrival)||"—"}`,subtitle:text(row.role)||"EASA flight",status:`${issues.length} issue${issues.length===1?"":"s"}`,detail:issues.slice(0,3).map(issue=>issue.message).join(" · "),href,priority:1})}
    else{ready++;items.push({key:`flight-${id}`,kind:"Flight",date:text(row.date),title:`${text(row.registration)||"Aircraft"} · ${text(row.departure)||"—"} → ${text(row.arrival)||"—"}`,subtitle:text(row.role)||"EASA flight",status:"Ready to certify",detail:"Mandatory FCL.050 checks passed.",href,priority:2})}
  }

  for(const row of fstdRows){
    const id=Number(row.id),revision=Math.max(1,Number(row.record_revision||1)),certified=Boolean(row.certified_at),correction=!certified&&revision>1,issues=blockingComplianceIssues(fstdCompliance(row)),href="/fstd";
    if(certified){certifiedCount++;const result=verifyFstdCertification(row,userId);integrityChecks++;if(result.status!=="verified"){integrityProblems++;integrityItems.push({key:`fstd-current-${id}`,kind:"FSTD",title:`${text(row.device_type)} · ${text(row.session_date)}`,revision:`R${revision} current`,status:integrityLabel(result),hash:text(row.certification_hash),href})}}
    else if(correction){correctionDrafts++;items.push({key:`fstd-${id}`,kind:"FSTD",date:text(row.session_date),title:`${text(row.device_type)||"FSTD"} · ${text(row.qualification_number)||"no qualification no."}`,subtitle:text(row.instruction)||"FSTD session",status:`Correction R${revision}`,detail:text(row.correction_reason)||"Correction draft",href,priority:0})}
    else if(issues.length){needsAttention++;items.push({key:`fstd-${id}`,kind:"FSTD",date:text(row.session_date),title:`${text(row.device_type)||"FSTD"} · ${text(row.qualification_number)||"no qualification no."}`,subtitle:text(row.instruction)||"FSTD session",status:`${issues.length} issue${issues.length===1?"":"s"}`,detail:issues.slice(0,3).map(issue=>issue.message).join(" · "),href,priority:1})}
    else{ready++;items.push({key:`fstd-${id}`,kind:"FSTD",date:text(row.session_date),title:`${text(row.device_type)||"FSTD"} · ${text(row.qualification_number)||""}`,subtitle:text(row.instruction)||"FSTD session",status:"Ready to certify",detail:"Mandatory FSTD checks passed.",href,priority:2})}
  }

  for(const row of flightArchives){const snap={...snapshot(row.snapshot_data),certification_hash:row.certification_hash,certification_version:row.certification_version},result=verifyFlightCertification(snap,userId);integrityChecks++;if(result.status!=="verified"){integrityProblems++;integrityItems.push({key:`flight-archive-${row.flight_id}-${row.revision_number}`,kind:"Flight archive",title:`Flight #${row.flight_id}`,revision:`R${row.revision_number} archived`,status:integrityLabel(result),hash:text(row.certification_hash),href:`/flights/${row.flight_id}/audit`})}}
  for(const row of fstdArchives){const snap={...snapshot(row.snapshot_data),certification_hash:row.certification_hash,certification_version:row.certification_version},result=verifyFstdCertification(snap,userId);integrityChecks++;if(result.status!=="verified"){integrityProblems++;integrityItems.push({key:`fstd-archive-${row.fstd_session_id}-${row.revision_number}`,kind:"FSTD archive",title:`FSTD #${row.fstd_session_id}`,revision:`R${row.revision_number} archived`,status:integrityLabel(result),hash:text(row.certification_hash),href:"/fstd"})}}
  items.sort((a,b)=>a.priority-b.priority||b.date.localeCompare(a.date));

  return <>
    <header className="page-header"><div><p className="eyebrow">CERTIFIED RECORDS</p><h1>Certification Center</h1><p className="muted">One place to review readiness, correction drafts and SHA-256 integrity for EASA flights and FSTD records.</p></div></header>
    <section className="flight-summary"><div><span>Ready</span><strong>{ready}</strong></div><div><span>Needs attention</span><strong>{needsAttention}</strong></div><div><span>Correction drafts</span><strong>{correctionDrafts}</strong></div><div><span>Certified</span><strong>{certifiedCount}</strong></div><div><span>Integrity</span><strong>{integrityProblems?`${integrityProblems} issue${integrityProblems===1?"":"s"}`:"Verified"}</strong><small>{integrityChecks} fingerprints checked</small></div></section>

    {integrityProblems?<section className="panel"><p className="eyebrow">INTEGRITY ATTENTION</p><h2>{integrityProblems} certification fingerprint {integrityProblems===1?"requires":"require"} review</h2><div className="table-scroll"><table><thead><tr><th>Record</th><th>Revision</th><th>Status</th><th>Fingerprint</th><th></th></tr></thead><tbody>{integrityItems.map(item=><tr key={item.key}><td><strong>{item.kind}</strong><small>{item.title}</small></td><td>{item.revision}</td><td><strong>{item.status}</strong></td><td><code>{item.hash?`${item.hash.slice(0,16)}…`:"—"}</code></td><td><Link className="detail-button" href={item.href}>Review</Link></td></tr>)}</tbody></table></div></section>:<section className="panel compliance-note"><p className="eyebrow">INTEGRITY</p><h2>All stored certification fingerprints verify</h2><p className="muted">{integrityChecks} current and archived certified records were recalculated against their stored SHA-256 fingerprints.</p></section>}

    <section className="panel"><div className="section-heading"><div><p className="eyebrow">WORK QUEUE</p><h2>Records requiring a decision</h2></div><span>{items.length}</span></div>{items.length?<div className="table-scroll"><table><thead><tr><th>Type</th><th>Date</th><th>Record</th><th>Status</th><th></th></tr></thead><tbody>{items.slice(0,200).map(item=><tr key={item.key}><td><strong>{item.kind}</strong></td><td>{item.date||"—"}</td><td><strong>{item.title}</strong><small>{item.subtitle}</small></td><td><strong>{item.status}</strong><small>{item.detail}</small></td><td><Link className="detail-button" href={item.href}>Open</Link></td></tr>)}</tbody></table></div>:<p className="empty-state">No draft or correction records require action.</p>}</section>
    <section className="panel compliance-note"><p className="eyebrow">WORKFLOW</p><p>Ready records can be certified from their detail page. Correction drafts preserve the previous certified revision and must be re-certified after the correction is checked. Integrity mismatches are never repaired automatically.</p></section>
  </>;
}
