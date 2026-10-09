"use client";

import dynamic from "next/dynamic";

// Leaflet touches window during module evaluation. Map components must be
// imported only in the browser, not from the server-rendered /map route.
export const RouteOverviewMap = dynamic(
  () => import("@/components/route-overview-map").then(module => module.RouteOverviewMap),
  { ssr: false, loading: () => <div className="track-map-loading" role="status">Loading map…</div> },
);

export const TracksMap = dynamic(
  () => import("@/components/tracks-map").then(module => module.TracksMap),
  { ssr: false, loading: () => <div className="track-map-loading" role="status">Loading map…</div> },
);
