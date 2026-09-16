import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {getPublicFlight} from "@/lib/flight-sharing";
import {FlightStoryCard} from "@/components/flight-story-card";

export const metadata:Metadata={robots:{index:false,follow:false},title:"Shared flight · FlyTally"};
const duration=(m:number)=>m?`${Math.floor(m/60)}:${String(m%60).padStart(2,"0")}`:"—";
export default async function PublicFlightPage({params}:{params:Promise<{token:string}>}){const flight=await getPublicFlight((await params).token);if(!flight)notFound();return <main className="public-flight-page"><section className="public-flight-hero"><p className="eyebrow">FLYTALLY · SHARED FLIGHT</p><h1>{flight.departure||"—"} → {flight.arrival||"—"}</h1><p>{[flight.aircraftType,flight.registration,flight.date].filter(Boolean).join(" · ")}</p></section><section className="public-flight-stats"><div><span>Flight time</span><strong>{duration(flight.blockMinutes)}</strong></div><div><span>Distance</span><strong>{flight.distanceKm?`${Math.round(flight.distanceKm/1.852)} NM`:"—"}</strong></div><div><span>Landings</span><strong>{flight.landings}</strong></div></section>{flight.points.length>1&&<section className="panel public-story"><FlightStoryCard {...flight}/></section>}<p className="public-flight-note">This is a pilot-shared public summary, not a certified logbook record. Private remarks, signatures, licences, costs, certification and crew data are not exposed.</p></main>}
