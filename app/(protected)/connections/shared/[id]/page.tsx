import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { ReadonlyLogbookEntry } from "@/components/readonly-logbook-entry";
import { acceptSharedFlight,declineSharedFlight } from "@/app/(protected)/flights/shared-actions";
import { crewRoleCredits } from "@/lib/crew";

const text=(value:unknown)=>String(value??"").trim();

export default async function SharedFlightReview({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}){
  const {userId}=await requireUser(),participationId=Number((await params).id),query=await searchParams;if(!Number.isSafeInteger(participationId)||participationId<=0)notFound();
  await ensureDatabaseOptimizations();
  const rows=await sql`SELECT p.id participation_id,p.status,p.participant_role,p.source_revision,p.source_hash,p.participant_flight_id,f.*,u.display_name pilot_name,
    (SELECT NULLIF(TRIM(ac.icao_type),'') FROM aircraft ac WHERE ac.user_id=f.user_id AND UPPER(TRIM(ac.registration))=UPPER(TRIM(f.registration)) ORDER BY ac.id DESC LIMIT 1) icao_type,
    CASE WHEN f.off_block~'^([01][0-9]|2[0-3]):[0-5][0-9]$' AND f.on_block~'^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN MOD((split_part(f.on_block,':',1)::int*60+split_part(f.on_block,':',2)::int)-(split_part(f.off_block,':',1)::int*60+split_part(f.off_block,':',2)::int)+1440,1440) ELSE 0 END::int block_minutes
    FROM flight_participations p JOIN flights f ON f.id=p.source_flight_id AND f.user_id=p.source_user_id JOIN users u ON u.id=p.source_user_id
    WHERE p.id=${participationId} AND p.participant_user_id=${userId} LIMIT 1` as Array<Record<string,unknown>>;
  const row=rows[0];if(!row)notFound();
  const current=Boolean(row.certified_at)&&Number(row.record_revision)===Number(row.source_revision)&&text(row.certification_hash)===text(row.source_hash),accept=acceptSharedFlight.bind(null,participationId),decline=declineSharedFlight.bind(null,participationId),accepted=Boolean(row.participant_flight_id);
  const credit=crewRoleCredits(row.participant_role,Number(row.block_minutes));
  const safeRow={...row,role:row.participant_role,commander:row.pilot_name,instructor:row.participant_role==="INSTRUCTOR"?row.pilot_name:"",pic_minutes:credit.pic,copilot_minutes:credit.copilot,dual_minutes:0,instructor_minutes:credit.instructor,note:""};
  return <>
    <header className="page-header"><div><p className="eyebrow">SHARED FLIGHT</p><h1>{text(row.registration)} · {text(row.date)}</h1><p className="muted">{text(row.pilot_name)} invites you as {text(row.participant_role)}.</p></div><Link className="secondary-link" href="/connections">← Connections</Link></header>
    {query.error?<p className="form-error">{query.error==="duplicate"?"A flight with the same date, time and route already exists with a different role.":"This invitation no longer matches the current certified flight."}</p>:null}
    <ReadonlyLogbookEntry row={safeRow} pilotName="" certified={false} easa={text(row.evidence).toUpperCase()==="EASA"} preview/>
    <section className={`panel instructor-decision-panel ${text(row.status)}`}><div><p className="eyebrow">YOUR LOGBOOK</p><h2>{accepted?"Flight added":row.status==="declined"?"Invitation declined":current?"Add this flight?":"Invitation is no longer current"}</h2><p className="muted">{accepted?"A separate draft was created in your logbook. You can review and certify it independently.":row.status==="declined"?"No entry was added to your logbook.":current?`FlyTally will create your own draft as ${text(row.participant_role)}, including GPS, landings and cost. Your role and credited time are recorded separately.`:"The source pilot changed this flight. Ask for a new invitation."}</p></div>
      {accepted?<Link className="primary-button" href={`/flights/${text(row.participant_flight_id)}`}>Open my flight</Link>:row.status==="pending"&&current?<div className="instructor-decision-actions"><form action={accept}><button className="primary-button">Add to my logbook</button></form><form action={decline}><button className="secondary-button">Decline</button></form></div>:null}
    </section>
  </>;
}
