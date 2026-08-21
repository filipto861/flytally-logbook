"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import type { MapTrack } from "@/lib/data/tracks";

export function TracksMap({ tracks, height = 650, detail = false }: { tracks: MapTrack[]; height?: number; detail?: boolean }) {
  const target = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!target.current || tracks.length === 0) return;
    const map = L.map(target.current, { preferCanvas: true, zoomControl: true, attributionControl: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 20, attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    }).addTo(map);
    const bounds = L.latLngBounds([]);
    tracks.forEach((track, index) => {
      const latlngs = track.points.map((point) => L.latLng(point.lat, point.lon));
      latlngs.forEach((point) => bounds.extend(point));
      const color = track.evidence === "EASA" ? "#38bdf8" : "#34d399";
      const line = L.polyline(latlngs, { color, weight: detail ? 3 : 2, opacity: detail ? .95 : .68, renderer: L.canvas() }).addTo(map);
      if (!detail) {
        const node = document.createElement("div");
        const title = document.createElement("strong"); title.textContent = `${track.registration || "Let"} · ${track.date}`;
        const route = document.createElement("div"); route.textContent = `${track.departure || "—"} → ${track.arrival || "—"}`;
        const link = document.createElement("a"); link.href = `/flights/${track.flightId}`; link.textContent = "Otevřít detail letu";
        node.append(title, route, link); line.bindPopup(node);
      }
      if (detail || index === 0) {
        L.circleMarker(latlngs[0], { radius: 4, color: "#34d399", fillOpacity: 1 }).addTo(map);
        L.circleMarker(latlngs.at(-1)!, { radius: 4, color: "#fb7185", fillOpacity: 1 }).addTo(map);
      }
    });
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: detail ? 13 : 10 });
    else map.setView([49.8, 15.5], 7);
    return () => { map.remove(); };
  }, [tracks, detail]);
  return <div ref={target} className="track-map" style={{ height }} aria-label="Mapa GPS tracků" />;
}
