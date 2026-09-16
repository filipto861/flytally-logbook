"use client";

import { useRef, useState } from "react";
import type { TrackPoint } from "@/lib/data/tracks";

type Props = { departure: string; arrival: string; date: string; aircraftType: string; registration?: string; blockMinutes: number; landings: number; distanceKm: number; points: TrackPoint[] };
type StoryPoint = { x: number; y: number; groundY: number; altitude: number };

function storyGeometry(points: TrackPoint[]): StoryPoint[] {
  if (!points.length) return [];
  const step = Math.max(1, Math.ceil(points.length / 260));
  const sample = points.filter((_, i) => i === 0 || i === points.length - 1 || i % step === 0);
  const meanLat = sample.reduce((sum, p) => sum + p.lat, 0) / sample.length;
  const cosLat = Math.max(0.15, Math.cos(meanLat * Math.PI / 180));
  const east = sample.map(p => p.lon * cosLat);
  const north = sample.map(p => p.lat);
  const minE = Math.min(...east), maxE = Math.max(...east), minN = Math.min(...north), maxN = Math.max(...north);
  const spanE = Math.max(maxE - minE, 1e-7), spanN = Math.max(maxN - minN, 1e-7);
  const mapW = 820, mapH = 520;
  const scale = Math.min(mapW / spanE, mapH / spanN);
  const usedW = spanE * scale, usedH = spanN * scale;
  const left = 540 - usedW / 2, top = 520 + (mapH - usedH) / 2;
  const altitudes = sample.map(p => Number(p.alt ?? 0)).filter(Number.isFinite);
  const minA = altitudes.length ? Math.min(...altitudes) : 0;
  const maxA = altitudes.length ? Math.max(...altitudes) : minA;
  const altRange = Math.max(maxA - minA, 1);

  return sample.map((p, i) => {
    const mapX = left + (east[i] - minE) * scale;
    const mapY = top + usedH - (north[i] - minN) * scale;
    // A mild oblique transform preserves the geographic shape; altitude is deliberately secondary.
    const x = 540 + (mapX - 540) * 0.96 + (mapY - 780) * 0.18;
    const groundY = 785 + (mapY - 780) * 0.55;
    const altitude = Number(p.alt ?? minA);
    const lift = ((altitude - minA) / altRange) * 115;
    return { x, y: groundY - lift, groundY, altitude };
  });
}

const duration = (m: number) => m ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}` : "—";

export function FlightStoryCard(props: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [busy, setBusy] = useState(false);
  const p = storyGeometry(props.points);
  const route = p.map(x => `${x.x},${x.y}`).join(" ");
  const groundRoute = p.map(x => `${x.x},${x.groundY}`).join(" ");

  async function save() {
    if (!svgRef.current) return;
    setBusy(true);
    try {
      const xml = new XMLSerializer().serializeToString(svgRef.current);
      const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = bad; img.src = url; });
      const c = document.createElement("canvas"); c.width = 1080; c.height = 1920;
      const ctx = c.getContext("2d"); if (!ctx) return;
      ctx.drawImage(img, 0, 0, 1080, 1920); URL.revokeObjectURL(url);
      const png = await new Promise<Blob | null>(r => c.toBlob(r, "image/png", .96)); if (!png) return;
      const file = new File([png], `FlyTally-${props.departure}-${props.arrival}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `${props.departure} → ${props.arrival}` });
      else { const a = document.createElement("a"); a.href = URL.createObjectURL(png); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
    } finally { setBusy(false); }
  }

  return <div className="story-card-tool"><div className="story-preview"><svg ref={svgRef} viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#061724"/><stop offset="1" stopColor="#0d3852"/></linearGradient><linearGradient id="line" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#6ee7ff"/><stop offset="1" stopColor="#fff"/></linearGradient></defs>
    <rect width="1080" height="1920" fill="url(#bg)"/>
    <text x="72" y="105" fill="#8eb6ca" fontSize="30" fontFamily="Arial" fontWeight="700" letterSpacing="5">FLYTALLY · FLIGHT</text>
    <text x="72" y="245" fill="white" fontSize="88" fontFamily="Arial" fontWeight="800">{props.departure || "—"} → {props.arrival || "—"}</text>
    <text x="72" y="310" fill="#b7d1de" fontSize="34" fontFamily="Arial">{[props.aircraftType, props.registration, props.date].filter(Boolean).join("  ·  ")}</text>
    <path d="M55 430 L1025 430 L1025 1120 L55 1120 Z" fill="#0a2638" stroke="#25536a" strokeWidth="3"/>
    <g opacity=".22" stroke="#4d8299" strokeWidth="2">{[0,1,2,3,4].map(i => <line key={`h${i}`} x1="80" y1={535+i*120} x2="1000" y2={535+i*120}/>)}{[0,1,2,3,4,5].map(i => <line key={`v${i}`} x1={100+i*176} y1="485" x2={100+i*176} y2="1070"/>)}</g>
    {p.length > 1 && <><polyline points={groundRoute} fill="none" stroke="#07131c" strokeWidth="16" opacity=".7"/><polyline points={route} fill="none" stroke="url(#line)" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round"/>{p.filter((_, i) => i % Math.max(1, Math.ceil(p.length / 12)) === 0).map((x, i) => <line key={i} x1={x.x} y1={x.y} x2={x.x} y2={x.groundY} stroke="#54c7e8" opacity=".16" strokeWidth="2"/>)}<circle cx={p[0].x} cy={p[0].y} r="17" fill="#6ee7ff"/><circle cx={p.at(-1)!.x} cy={p.at(-1)!.y} r="17" fill="#fff"/></>}
    <text x="72" y="1165" fill="#739caf" fontSize="23" fontFamily="Arial">GPS route geometry · altitude shown with subtle vertical lift</text>
    <text x="72" y="1255" fill="#8eb6ca" fontSize="28" fontFamily="Arial" fontWeight="700">FLIGHT TIME</text><text x="72" y="1340" fill="white" fontSize="70" fontFamily="Arial" fontWeight="800">{duration(props.blockMinutes)}</text>
    <text x="405" y="1255" fill="#8eb6ca" fontSize="28" fontFamily="Arial" fontWeight="700">DISTANCE</text><text x="405" y="1340" fill="white" fontSize="70" fontFamily="Arial" fontWeight="800">{props.distanceKm ? `${Math.round(props.distanceKm / 1.852)} NM` : "—"}</text>
    <text x="785" y="1255" fill="#8eb6ca" fontSize="28" fontFamily="Arial" fontWeight="700">LANDINGS</text><text x="785" y="1340" fill="white" fontSize="70" fontFamily="Arial" fontWeight="800">{props.landings}</text>
    <line x1="72" y1="1510" x2="1008" y2="1510" stroke="#31586c"/><text x="72" y="1600" fill="white" fontSize="38" fontFamily="Arial" fontWeight="700">Logged with FlyTally</text><text x="72" y="1660" fill="#8eb6ca" fontSize="27" fontFamily="Arial">A private pilot logbook · shared by the pilot</text>
  </svg></div><button type="button" className="primary-button" onClick={save} disabled={busy}>{busy ? "Preparing…" : "Share Story · 1080×1920"}</button></div>;
}
