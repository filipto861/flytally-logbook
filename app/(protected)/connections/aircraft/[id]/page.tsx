import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureV300AircraftSharingSchema } from "@/lib/v300-aircraft-sharing-schema";
import { parseAircraftShareSnapshot } from "@/lib/aircraft-sharing";
import { acceptAircraftProfileShare,declineAircraftProfileShare } from "../../aircraft-share-actions";
import { formatDateOnly } from "@/lib/display-format";

export const metadata={title:"Aircraft profile share | FlyTally"};
const text=(value:unknown)=>String(value??"");
const id=(value:unknown)=>{const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:0};

export default async function AircraftShareReviewPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}){
  const{userId}=await requireUser();await ensureV300AircraftSharingSchema();const shareId=id((await params).id),query=await searchParams;
  const rows=await sql`SELECT s.*,u.display_name source_name FROM aircraft_profile_shares s JOIN users u ON u.id=s.source_user_id WHERE s.id=${shareId} AND s.recipient_user_id=${userId} LIMIT 1` as Array<Record<string,unknown>>;
  const row=rows[0];if(!row)return <section className="panel"><h1>Aircraft profile unavailable</h1><p className="muted">This request does not exist or is not addressed to your account.</p><Link className="secondary-button" href="/connections">Back to Connections</Link></section>;
  const snapshot=parseAircraftShareSnapshot(row.snapshot_data),p=snapshot.profile;
  const existing=await sql`SELECT id,registration,aircraft_type,aircraft_make,aircraft_model,aircraft_variant,icao_type,aircraft_class,regulatory_category,evidence,default_role,billing_basis,note FROM aircraft WHERE user_id=${userId} AND UPPER(TRIM(registration))=${p.registration} LIMIT 1` as Array<Record<string,unknown>>;
  const own=existing[0]??null,status=text(row.status),pending=status==="pending",included=[
    Boolean(row.include_photo)&&Boolean(row.photo_base64)?"Photo":"",
    Boolean(row.include_defaults)&&snapshot.defaults?"Flight defaults":"",
    Boolean(row.include_current_rate)&&snapshot.currentRate?"Current rate":"",
    Boolean(row.include_rate_history)&&snapshot.rateHistory?.length?"Rate history":"",
    Boolean(row.include_notes)&&snapshot.note!==undefined?"Notes":"",
  ].filter(Boolean);

  return <>
    <header className="page-header"><div><p className="eyebrow">AIRCRAFT SHARE</p><h1>{p.registration||"Aircraft profile"}</h1><p className="muted page-lead">{text(row.source_name)||"A connected pilot"} sent you a pre-filled aircraft profile. Importing creates or updates only your own personal aircraft record.</p></div><Link className="secondary-link" href="/connections">Back to Connections</Link></header>
    {query.error?<p className="form-error" role="alert">This share can no longer be imported. Check that the pilot is still one of your Connections.</p>:null}
    {!pending?<section className="panel aircraft-share-status"><h2>{status==="accepted"?"Already imported":status==="declined"?"Share declined":"Share cancelled"}</h2><p className="muted">This aircraft share is no longer pending.</p>{status==="accepted"?<Link className="primary-button" href="/database">Open Aircraft</Link>:<Link className="secondary-button" href="/connections">Back to Connections</Link>}</section>:<>
      <section className="panel aircraft-share-review">
        <div className="section-heading"><div><p className="eyebrow">PROFILE</p><h2>{[p.aircraftMake,p.aircraftModel,p.aircraftVariant].filter(Boolean).join(" ")||p.aircraftType||p.registration}</h2><p className="muted">Core aircraft identity is always part of the share.</p></div><span className="status-on">{p.evidence||"PROFILE"}</span></div>
        {Boolean(row.include_photo)&&row.photo_base64?<div className="aircraft-share-cover" style={{backgroundImage:`linear-gradient(180deg,transparent 35%,rgba(2,9,20,.72)),url("/api/aircraft-share-photo/${shareId}")`}}><strong>{p.registration}</strong><span>{p.aircraftModel||p.aircraftType}</span></div>:null}
        <div className="share-profile-grid">
          <div><span>Registration</span><b>{p.registration||"—"}</b></div><div><span>ICAO</span><b>{p.icaoType||"—"}</b></div><div><span>Class</span><b>{p.aircraftClass||"—"}</b></div><div><span>Regulatory category</span><b>{p.regulatoryCategory||"—"}</b></div>
        </div>
        {included.length?<div className="share-included"><span>Also included</span>{included.map(item=><b key={item}>{item}</b>)}</div>:null}
      </section>

      {own?<section className="panel aircraft-share-conflict"><p className="eyebrow">EXISTING AIRCRAFT</p><h2>{p.registration} is already in your aircraft</h2><p className="muted">FlyTally will not create a duplicate. Choose which groups you want to copy over your current profile. Anything left unchecked stays unchanged.</p><div className="share-profile-grid"><div><span>Your type</span><b>{[text(own.aircraft_make),text(own.aircraft_model)||text(own.aircraft_type)].filter(Boolean).join(" ")||"—"}</b></div><div><span>Your ICAO</span><b>{text(own.icao_type)||"—"}</b></div><div><span>Your class</span><b>{text(own.aircraft_class)||"—"}</b></div><div><span>Your logbook</span><b>{text(own.evidence)||"—"}</b></div></div></section>:null}

      <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">IMPORT</p><h2>{own?"Choose what to update":"Add to my aircraft"}</h2><p className="muted">After import this aircraft is fully independent. Later changes by either pilot are not synchronized.</p></div></div>
        <form action={acceptAircraftProfileShare.bind(null,shareId)} className="aircraft-import-form">
          {own?<label className="share-check"><input type="checkbox" name="import_profile" value="yes" defaultChecked/><span><strong>Aircraft profile</strong><small>Type, ICAO, class/category and ULL/EASA classification.</small></span></label>:<div className="share-fixed-row"><span>✓</span><div><strong>Aircraft profile</strong><small>Required to create {p.registration} in your aircraft.</small></div></div>}
          {Boolean(row.include_photo)&&row.photo_base64?<label className="share-check"><input type="checkbox" name="import_photo" value="yes" defaultChecked/><span><strong>Cover photo</strong><small>Copy the photo shown above. You can replace it later.</small></span></label>:null}
          {Boolean(row.include_defaults)&&snapshot.defaults?<label className="share-check"><input type="checkbox" name="import_defaults" value="yes" defaultChecked/><span><strong>Flight defaults</strong><small>Role {snapshot.defaults.defaultRole} · billing {snapshot.defaults.billingBasis}.</small></span></label>:null}
          {Boolean(row.include_current_rate)&&snapshot.currentRate?<label className="share-check"><input type="checkbox" name="import_current_rate" value="yes" defaultChecked/><span><strong>Current hourly rate</strong><small>{snapshot.currentRate.pricePerHour.toLocaleString("en-GB")} CZK/h · valid from {formatDateOnly(snapshot.currentRate.validFrom)}.</small></span></label>:null}
          {Boolean(row.include_rate_history)&&snapshot.rateHistory?.length?<label className="share-check"><input type="checkbox" name="import_rate_history" value="yes" defaultChecked/><span><strong>Full rate history</strong><small>{snapshot.rateHistory.length} historical rate record{snapshot.rateHistory.length===1?"":"s"}.</small></span></label>:null}
          {Boolean(row.include_notes)&&snapshot.note!==undefined?<label className="share-check"><input type="checkbox" name="import_notes" value="yes" defaultChecked/><span><strong>Notes</strong><small>{snapshot.note?`“${snapshot.note.slice(0,120)}${snapshot.note.length>120?"…":""}”`:"Empty note"}</small></span></label>:null}
          <div className="aircraft-import-actions"><button className="primary-button">{own?"Import selected changes":"Add to my aircraft"}</button><button className="secondary-button" formAction={declineAircraftProfileShare.bind(null,shareId)}>Decline</button></div>
        </form>
      </section>
    </>}
  </>;
}
