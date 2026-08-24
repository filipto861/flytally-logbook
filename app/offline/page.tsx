import type { Metadata } from "next";
import Link from "next/link";
import { OfflineFlightDraft } from "@/components/offline-flight-draft";

export const metadata:Metadata={title:"Offline | FlyTally"};

export default function OfflinePage(){
  return <main className="offline-page">
    <header className="offline-page-header"><img src="/logbook_icon.png" alt=""/><div><p className="eyebrow">FLYTALLY PWA</p><h1>Offline mode</h1><p className="muted">The server is currently unavailable from this device. Certified records are never modified offline.</p></div></header>
    <OfflineFlightDraft/>
    <div className="offline-page-footer"><Link href="/dashboard" className="secondary-link">Retry FlyTally</Link></div>
  </main>;
}
