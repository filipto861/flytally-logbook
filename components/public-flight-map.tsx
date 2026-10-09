"use client";

import dynamic from "next/dynamic";

// Public shared-flight replay must never evaluate Leaflet in a server route.
// This boundary changes module loading only; shared data and publicView stay unchanged.
export const PublicFlightMap = dynamic(
  () => import("@/components/flight-track-player").then(module => module.FlightTrackPlayer),
  { ssr: false, loading: () => <div className="track-map-loading" role="status">Loading GPS replay…</div> },
);
