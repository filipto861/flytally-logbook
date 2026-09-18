import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {getPublicFlight} from "@/lib/flight-sharing";
import {FlightTrackPlayer} from "@/components/flight-track-player";
import {LegalFooter} from "@/components/legal-footer";

export const metadata:Metadata={robots:{index:false,follow:false,nocache:true},title:"Shared flight · FlyTally"};
const duration=(minutes:number)=>minutes?`${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,"0")}`:"—";

export default async function PublicFlightPage({params}:{params:Promise<{token:string}>}){
  const flight=await getPublicFlight((await params).token);
  if(!flight)notFound();
  const distance=flight.distanceKm?`${Math.round(flight.distanceKm/1.852)} NM`:"—";
  const identity=[flight.aircraftType,flight.registration,flight.date].filter(Boolean).join(" · ");
  const hasReplay=flight.tracks.length>0;

  return <main className="public-flight-viewer-page">
    <header className="public-flight-viewer-header">
      <a className="public-flight-brand" href="/" aria-label="FlyTally home"><img src="/logbook_icon.png" alt=""/><span><b>FlyTally</b><small>Shared flight</small></span></a>
      <span className="public-flight-viewonly">View only</span>
    </header>

    <section className="public-flight-viewer-hero">
      <p className="eyebrow">PILOT-SHARED FLIGHT</p>
      <div className="public-flight-route">
        <span><small>FROM</small><strong>{flight.departure||"—"}</strong></span>
        <i aria-hidden="true">→</i>
        <span><small>TO</small><strong>{flight.arrival||"—"}</strong></span>
      </div>
      {identity?<p>{identity}</p>:null}
    </section>

    <section className="public-flight-viewer-stats" aria-label="Shared flight summary">
      <article><span>Flight time</span><strong>{duration(flight.blockMinutes)}</strong></article>
      <article><span>Distance</span><strong>{distance}</strong></article>
      <article><span>Landings</span><strong>{flight.landings}</strong></article>
    </section>

    {hasReplay?<section className="public-flight-replay">
      <div className="public-flight-section-heading"><div><p className="eyebrow">INTERACTIVE ROUTE</p><h2>Replay the flight</h2><p>Explore the shared GPS route, move through the flight manually or press play to follow the aircraft along the track.</p></div></div>
      <FlightTrackPlayer tracks={flight.tracks} publicView/>
    </section>:<section className="public-flight-no-track">
      <p className="eyebrow">ROUTE</p><h2>GPS track not shared</h2><p>The pilot shared the flight summary without the recorded GPS route.</p>
    </section>}

    <section className="public-flight-privacy-note">
      <strong>Limited public view</strong>
      <p>This page shows only information the pilot chose to share. Logbook remarks, crew, costs, signatures, licences, certification data and other private record fields are not exposed.</p>
      <a href="/legal/report">Report a privacy, copyright or content concern</a>
    </section>
    <LegalFooter compact/>
  </main>;
}
