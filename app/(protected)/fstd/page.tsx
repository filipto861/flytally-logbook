import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { formatEasaDuration } from "@/lib/easa-logbook";
import { certifyFstdSession,createFstdSession,deleteFstdSession } from "./actions";

export const metadata={title:"FSTD | FlyTally"};
export const dynamic="force-dynamic";

type FstdRow={id:number|string;session_date:string;device_type:string;qualification_number:string;instruction:string;total_minutes:number|string;remarks:string;certified_at:string|null;certification_hash:string};

export default async function FstdPage(){
  const {userId}=await requireUser();
  const rows=await sql`SELECT id,session_date::text session_date,device_type,qualification_number,instruction,total_minutes,remarks,certified_at,certification_hash FROM fstd_sessions WHERE user_id=${userId} ORDER BY session_date DESC,id DESC` as FstdRow[];
  let accumulated=0;const chronological=[...rows].reverse().map(row=>{accumulated+=Math.max(0,Number(row.total_minutes)||0);return{...row,accumulated_minutes:accumulated}}).reverse();
  const total=rows.reduce((sum,row)=>sum+Math.max(0,Number(row.total_minutes)||0),0),today=new Date().toISOString().slice(0,10);
  return <>
    <header className="page-header"><div><p className="eyebrow">FCL.050</p><h1>FSTD sessions</h1><p className="muted">Dedicated simulator / training-device records for the EASA pilot logbook.</p></div></header>
    <section className="panel fstd-entry-panel"><div className="section-heading"><div><p className="eyebrow">NEW SESSION</p><h2>Add FSTD record</h2></div></div><form action={createFstdSession} className="form-grid fstd-form"><label>Date<input name="sessionDate" type="date" defaultValue={today} required/></label><label>Device type<input name="deviceType" placeholder="FNPT II / FFS / FTD" required/></label><label>Qualification number<input name="qualificationNumber" placeholder="Q1234"/></label><label>Total session time<input name="totalTime" inputMode="numeric" placeholder="1:30" pattern="[0-9]{1,2}:[0-5][0-9]" required/></label><label className="wide">FSTD instruction / exercise<input name="instruction" placeholder="IR training, proficiency check, revalidation…"/></label><label className="wide">Remarks<textarea name="remarks" rows={2} placeholder="Exercise details / endorsement reference"/></label><div className="form-actions wide"><button className="primary-button">Save FSTD session</button></div></form></section>
    <section className="flight-summary"><div><span>FSTD sessions</span><strong>{rows.length}</strong></div><div><span>Total FSTD time</span><strong>{formatEasaDuration(total)}</strong></div><div><span>Certified</span><strong>{rows.filter(row=>Boolean(row.certified_at)).length}</strong></div></section>
    <section className="panel"><div className="table-scroll"><table><thead><tr><th>Date</th><th>Device</th><th>Instruction</th><th>Session</th><th>Accumulated</th><th>Remarks</th><th>Status</th><th></th></tr></thead><tbody>{chronological.map(row=>{const certified=Boolean(row.certified_at),hash=String(row.certification_hash||"").trim();return <tr key={Number(row.id)}><td>{row.session_date}</td><td><strong>{row.device_type||"—"}</strong><small>{row.qualification_number||"No qualification number"}</small></td><td>{row.instruction||"—"}</td><td>{formatEasaDuration(row.total_minutes)}</td><td>{formatEasaDuration(row.accumulated_minutes)}</td><td>{row.remarks||"—"}</td><td>{certified?<><strong>Certified</strong><small>{hash?`${hash.slice(0,12)}…`:"Integrity hash stored"}</small></>:"Draft"}</td><td>{certified?null:<div className="inline-action"><form action={certifyFstdSession}><input type="hidden" name="id" value={Number(row.id)}/><input type="hidden" name="confirm" value="certify"/><button className="secondary-button">Certify</button></form><form action={deleteFstdSession}><input type="hidden" name="id" value={Number(row.id)}/><button className="icon-danger">Delete</button></form></div>}</td></tr>})}{!rows.length?<tr><td colSpan={8} className="empty-state">No FSTD sessions yet.</td></tr>:null}</tbody></table></div></section>
    <section className="panel compliance-note"><p className="eyebrow">RECORD INTEGRITY</p><p>Certification freezes the FSTD record and stores a SHA-256 integrity fingerprint. Corrections to a certified entry should be handled as a new traceable correction rather than silently editing the certified data.</p></section>
  </>;
}
