import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {requireUser} from "@/lib/auth/require-user";
import {sql} from "@/lib/db";
import {getFlightTracks} from "@/lib/data/tracks";
import {createFlightShare,hasActiveFlightShare,revokeFlightShares} from "@/lib/flight-sharing";
import {FlightStoryCard} from "@/components/flight-story-card";
import {SharePublicLink} from "@/components/share-public-link";

const mins=(a:unknown,b:unknown)=>{const p=(v:unknown)=>{const m=/^(\d{2}):(\d{2})$/.exec(String(v??""));return m?Number(m[1])*60+Number(m[2]):0},x=p(a),y=p(b);return x&&y?(y-x+1440)%1440:0};

export default async function ShareFlightPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{token?:string}>}){
  const{userId}=await requireUser(),id=Number((await params).id);
  if(!Number.isSafeInteger(id)||id<1)notFound();
  const rows=await sql`SELECT id,date,departure,arrival,registration,aircraft_type,aircraft_make,aircraft_model,off_block,on_block,COALESCE(landings_day,0)+COALESCE(landings_night,0) landings,certified_at,COALESCE(record_revision,1) record_revision FROM flights WHERE id=${id} AND user_id=${userId} LIMIT 1` as Array<Record<string,unknown>>;
  const f=rows[0];if(!f)notFound();
  if(!f.certified_at)return <main className="page-shell">
    <div className="page-heading"><div><p className="eyebrow">SHARE FLIGHT</p><h1>{String(f.departure||"—")} → {String(f.arrival||"—")}</h1><p className="muted">Sharing becomes available after the flight record is certified.</p></div><Link className="secondary-button" href={`/flights/${id}`}>Back to flight</Link></div>
    <section className="panel flight-share-locked"><p className="eyebrow">NOT READY TO SHARE</p><h2>Certify the final record first</h2><p className="muted">Review the Logbook data and certify the flight. FlyTally only creates public links from protected certified revisions, so later draft edits cannot silently change something you already shared.</p><Link className="primary-button" href={`/flights/${id}?tab=logbook`}>Review Logbook data</Link></section>
  </main>;

  const[tracks,active]=await Promise.all([getFlightTracks(userId,id),hasActiveFlightShare(userId,id)]),token=(await searchParams).token?.trim()||"",aircraft=[f.aircraft_make,f.aircraft_model].map(x=>String(x??"").trim()).filter(Boolean).join(" ")||String(f.aircraft_type??"");
  async function create(form:FormData){"use server";const{userId:uid}=await requireUser();const t=await createFlightShare(uid,id,{showRegistration:form.get("registration")==="on",showDate:form.get("date")==="on",showTrack:form.get("track")==="on"});redirect(`/flights/${id}/share?token=${encodeURIComponent(t)}`)}
  async function revoke(){"use server";const{userId:uid}=await requireUser();await revokeFlightShares(uid,id);redirect(`/flights/${id}/share`)}
  const distance=tracks.reduce((sum,track)=>sum+track.distanceKm,0),points=tracks.flatMap(track=>track.points),title=`${String(f.departure||"—")} → ${String(f.arrival||"—")} · FlyTally`;
  return <main className="page-shell">
    <div className="page-heading"><div><p className="eyebrow">SHARE CERTIFIED R{Number(f.record_revision)||1}</p><h1>{String(f.departure||"—")} → {String(f.arrival||"—")}</h1><p className="muted">Share a deliberately limited public view of the protected record. Logbook remarks, costs, signatures, licence data, certification and crew data are never included.</p></div><Link className="secondary-button" href={`/flights/${id}`}>Back to flight</Link></div>
    <section className="panel"><p className="eyebrow">VIEW-ONLY LINK</p><h2>Interactive public flight viewer</h2>
      {token?<><p>Your new link is ready. FlyTally stores only a one-way hash of the secret token.</p><SharePublicLink token={token} title={title}/></>:<p className="muted">{active?"A public link is currently active. Create a new one to rotate the secret, or revoke sharing.":"No public link is active."}</p>}
      <div className="share-safety-note"><strong>Before publishing</strong><p className="muted">Anyone with the secret URL can view the limited flight summary. When GPS sharing is enabled, they can explore the interactive map and replay the aircraft along the recorded route. The options below control whether registration, date and the GPS route/distance are public. Public pages are marked noindex and can be revoked at any time.</p></div>
      <form action={create} className="share-options"><label><input type="checkbox" name="registration"/> Include aircraft registration</label><label><input type="checkbox" name="date" defaultChecked/> Include flight date</label><label><input type="checkbox" name="track" defaultChecked/> Include GPS route and distance</label><button className="primary-button">{active?"Create new link":"Create public link"}</button></form>
      {active?<form action={revoke}><button className="secondary-button">Revoke public link</button></form>:null}
      <p className="muted share-terms">Only share data you are entitled to make public. See <Link href="/legal/terms">sharing terms</Link> and <Link href="/legal/privacy">privacy notice</Link>.</p>
    </section>
    <section className="panel"><p className="eyebrow">SOCIAL</p><h2>Instagram Story</h2><p className="muted">1080×1920 card with the recorded flight path in perspective, public flight statistics and no regulatory/private logbook fields.</p><FlightStoryCard departure={String(f.departure??"")} arrival={String(f.arrival??"")} date={String(f.date??"")} aircraftType={aircraft} blockMinutes={mins(f.off_block,f.on_block)} landings={Number(f.landings??0)} distanceKm={distance} points={points}/></section>
  </main>
}
