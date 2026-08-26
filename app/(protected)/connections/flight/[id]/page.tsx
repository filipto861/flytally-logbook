import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { ReadonlyLogbookEntry } from "@/components/readonly-logbook-entry";
import { approveInstructorFlight,declineInstructorFlight } from "@/app/(protected)/flights/instructor-actions";
import { addApprovedFlightToLogbook } from "@/app/(protected)/flights/shared-actions";

const text=(value:unknown)=>String(value??"").trim();

export default async function InstructorFlightReview({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}){
  const {userId}=await requireUser(),approvalId=Number((await params).id),query=await searchParams;if(!Number.isSafeInteger(approvalId)||approvalId<=0)notFound();
  await ensureDatabaseOptimizations();
  const rows=await sql`SELECT a.id approval_id,a.status,a.record_revision approval_revision,a.flight_hash,a.requested_at,a.decided_at,a.decision_note,p.participant_flight_id,f.*,u.display_name pilot_name,
    (SELECT NULLIF(TRIM(ac.icao_type),'') FROM aircraft ac WHERE ac.user_id=f.user_id AND UPPER(TRIM(ac.registration))=UPPER(TRIM(f.registration)) ORDER BY ac.id DESC LIMIT 1) icao_type,
    CASE WHEN f.off_block~'^([01][0-9]|2[0-3]):[0-5][0-9]$' AND f.on_block~'^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN MOD((split_part(f.on_block,':',1)::int*60+split_part(f.on_block,':',2)::int)-(split_part(f.off_block,':',1)::int*60+split_part(f.off_block,':',2)::int)+1440,1440) ELSE 0 END::int block_minutes
    FROM instructor_flight_approvals a JOIN flights f ON f.id=a.flight_id AND f.user_id=a.student_user_id JOIN users u ON u.id=a.student_user_id
    LEFT JOIN flight_participations p ON p.source_flight_id=a.flight_id AND p.source_revision=a.record_revision AND p.participant_role='INSTRUCTOR' AND p.participant_user_id=a.instructor_user_id
    WHERE a.id=${approvalId} AND a.instructor_user_id=${userId} LIMIT 1` as Array<Record<string,unknown>>;
  const row=rows[0];if(!row)notFound();
  const current=Boolean(row.certified_at)&&Number(row.record_revision)===Number(row.approval_revision)&&text(row.certification_hash)===text(row.flight_hash);
  const approve=approveInstructorFlight.bind(null,approvalId),decline=declineInstructorFlight.bind(null,approvalId),add=addApprovedFlightToLogbook.bind(null,approvalId),pending=row.status==="pending";
  return <>
    <header className="page-header"><div><p className="eyebrow">INSTRUCTOR REVIEW</p><h1>{text(row.registration)} · {text(row.date)}</h1><p className="muted">{text(row.pilot_name)} · {text(row.departure)} → {text(row.arrival)} · {text(row.role)}</p></div><Link className="secondary-link" href="/connections">← Connections</Link></header>
    {query.error?<p className="form-error">{query.error==="duplicate"?"A flight with the same date, time and route already exists with a different role.":"This approval no longer matches the current certified flight."}</p>:null}
    <ReadonlyLogbookEntry row={row} pilotName={text(row.pilot_name)} certified={Boolean(row.certified_at)} easa={text(row.evidence).toUpperCase()==="EASA"}/>
    <section className={`panel instructor-decision-panel ${text(row.status)}`}><div><p className="eyebrow">YOUR DECISION</p><h2>{row.status==="approved"?"Flight approved":row.status==="declined"?"Approval declined":current?"Approve this entry?":"Request is no longer current"}</h2><p className="muted">{row.status==="approved"?"Your account and decision time are attached to this exact certified revision.":row.status==="declined"?text(row.decision_note)||"The student can send a new request.":current?"Approve only if the displayed logbook entry matches the training flight. This records your account, time and the protected flight fingerprint.":"The student changed or reopened this flight. Ask them to certify the current revision and send a new request."}</p></div>
      {pending&&current?<div className="instructor-decision-actions"><form action={approve}><input type="hidden" name="confirm" value="approve"/><button className="primary-button">Approve flight</button></form><details><summary className="secondary-button">Decline</summary><form action={decline} className="stack-form"><label>Reason (optional)<textarea name="note" maxLength={500} rows={2}/></label><button className="icon-danger">Decline request</button></form></details></div>:null}
    </section>
    {row.status==="approved"?<section className="panel instructor-approval-panel approved"><div><p className="eyebrow">YOUR LOGBOOK</p><h2>{row.participant_flight_id?"Flight added":"Add your instructor entry"}</h2><p className="muted">{row.participant_flight_id?"Your separate instructor record is ready in your logbook.":"Create your own draft as INSTRUCTOR. Price, private notes and landings are not copied."}</p></div>{row.participant_flight_id?<Link className="primary-button" href={`/flights/${text(row.participant_flight_id)}`}>Open my flight</Link>:<form action={add}><button className="primary-button">Add to my logbook</button></form>}</section>:null}
  </>;
}
