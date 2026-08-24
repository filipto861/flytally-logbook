import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { formatEasaDuration } from "@/lib/easa-logbook";

export const metadata={title:"FSTD | FlyTally"};
export const dynamic="force-dynamic";

type FstdRow={id:number|string;session_date:string;device_type:string;qualification_number:string;instruction:string;total_minutes:number|string;remarks:string;certified_at:string|null;certification_hash:string};

export default async function FstdPage(){
  const {userId}=await requireUser();
  const rows=await sql`SELECT id,session_date::text session_date,device_type,qualification_number,instruction,total_minutes,remarks,certified_at,certification_hash FROM fstd_sessions WHERE user_id=${userId} ORDER BY session_date DESC,id DESC` as FstdRow[];
  let accumulated=0;const chronological=[...rows].reverse().map(row=>{accumulated+=Math.max(0,Number(row.total_minutes)||0);return{...row,accumulated_minutes:accumulated}}).reverse();
  const total=rows.reduce((sum,row)=>sum+Math.max(0,Number(row.total_minutes)||0),0);
  return <>
    <header className="page-header"><div><p className="eyebrow">FCL.050</p><h1>FSTD sessions</h1><p className="muted">Dedicated simulator / training-device records for the EASA pilot logbook.</p></div></header>
    <section className="flight-summary"><div><span>FSTD sessions</span><strong>{rows.length}</strong></div><div><span>Total FSTD time</span><strong>{formatEasaDuration(total)}</strong></div><div><span>Certified</span><strong>{rows.filter(row=>Boolean(row.certified_at)).length}</strong></div></section>
    <section className="panel"><div className="table-scroll"><table><thead><tr><th>Date</th><th>Device</th><th>Instruction</th><th>Session</th><th>Accumulated</th><th>Remarks</th><th>Status</th></tr></thead><tbody>{chronological.map(row=><tr key={Number(row.id)}><td>{row.session_date}</td><td><strong>{row.device_type||"—"}</strong><small>{row.qualification_number||"No qualification number"}</small></td><td>{row.instruction||"—"}</td><td>{formatEasaDuration(row.total_minutes)}</td><td>{formatEasaDuration(row.accumulated_minutes)}</td><td>{row.remarks||"—"}</td><td>{row.certified_at?"Certified":"Draft"}</td></tr>)}{!rows.length?<tr><td colSpan={7} className="empty-state">No FSTD sessions yet.</td></tr>:null}</tbody></table></div></section>
  </>;
}
