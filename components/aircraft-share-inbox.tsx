import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { cancelAircraftProfileShare } from "@/app/(protected)/connections/aircraft-share-actions";

const text=(value:unknown)=>String(value??"");
const profileFrom=(value:unknown)=>{const root=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{},profile=root.profile&&typeof root.profile==="object"&&!Array.isArray(root.profile)?root.profile as Record<string,unknown>:{};return{registration:text(profile.registration),model:text(profile.aircraftModel)||text(profile.aircraftType)}};

export async function AircraftShareInbox(){
  const{userId}=await requireUser();
  const[incoming,outgoing]=await Promise.all([
    sql`SELECT s.id,s.snapshot_data,u.display_name FROM aircraft_profile_shares s JOIN users u ON u.id=s.source_user_id WHERE s.recipient_user_id=${userId} AND s.status='pending' ORDER BY s.created_at DESC` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT s.id,s.snapshot_data,u.display_name FROM aircraft_profile_shares s JOIN users u ON u.id=s.recipient_user_id WHERE s.source_user_id=${userId} AND s.status='pending' ORDER BY s.created_at DESC` as Promise<Array<Record<string,unknown>>>,
  ]);
  if(!incoming.length&&!outgoing.length)return null;
  return <>
    {incoming.length?<section className="panel connection-inbox"><div className="section-heading"><div><p className="eyebrow">ACTION REQUIRED</p><h2>Aircraft profile shares</h2><p className="muted">Review exactly what you want to copy into your own aircraft profile.</p></div><span className="status-on">{incoming.length} pending</span></div><div className="connection-list">{incoming.map(row=>{const p=profileFrom(row.snapshot_data);return <article className="connection-card" key={`aircraft-${text(row.id)}`}><div className="pilot-avatar" aria-hidden="true">✈</div><div className="connection-identity"><strong>{p.registration||"Aircraft profile"}</strong><span>Shared by {text(row.display_name)||"Pilot"}</span><small>{p.model||"Profile"} · one-time copy</small></div><Link className="primary-button" href={`/connections/aircraft/${text(row.id)}`}>Review aircraft</Link></article>})}</div></section>:null}
    {outgoing.length?<section className="panel"><div className="section-heading"><div><p className="eyebrow">SENT</p><h2>Aircraft profiles waiting for import</h2><p className="muted">These are copies you sent to Connections. Your own aircraft remains unchanged.</p></div><span>{outgoing.length}</span></div><div className="connection-list">{outgoing.map(row=>{const p=profileFrom(row.snapshot_data);return <article className="connection-card" key={`aircraft-sent-${text(row.id)}`}><div className="pilot-avatar" aria-hidden="true">✈</div><div className="connection-identity"><strong>{p.registration||"Aircraft profile"}</strong><span>Sent to {text(row.display_name)||"Pilot"}</span><small>{p.model||"Profile"} · waiting for import decision</small></div><form action={cancelAircraftProfileShare}><input type="hidden" name="share_id" value={text(row.id)}/><button className="secondary-button">Cancel share</button></form></article>})}</div></section>:null}
  </>;
}
