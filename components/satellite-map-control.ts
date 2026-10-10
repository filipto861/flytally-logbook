import L from "leaflet";
import { attachStandardBasemap, attachSatelliteBasemap } from "@/components/map-layer-controller";

/**
 * Explicit per-map opt-in behind an exact-true build flag.
 * The existing authenticated Satellite API is the sole tile provider.
 * Without the flag no Satellite tile layer or UI is constructed.
 */
export const SATELLITE_MAPS_TRIAL_ENABLED =
  process.env.NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS === "true";

const STANDARD_URL = "/api/map-tile/{z}/{x}/{y}?style=map";
const SATELLITE_URL = "/api/map-tile/{z}/{x}/{y}?style=satellite";
const STANDARD_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Reuse the existing FlyTally Story imagery attribution text.
const SATELLITE_ATTRIBUTION =
  'Imagery &copy; <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a> · TomTom · Garmin · FAO · NOAA · USGS · &copy; OpenStreetMap contributors · GIS User Community';

/**
 * Enable only on an authenticated map surface. Public flight replay never calls
 * this with enabled=true. A disabled flag does not construct any tile layer.
 *
 * No preference persistence, no map recreation/fitBounds and no flight data mutation.
 */
export function installSatelliteMapControl(map: L.Map, enabled: boolean): () => void {
  if (!SATELLITE_MAPS_TRIAL_ENABLED || !enabled) return () => {};

  let disposed = false;
  let activeSatellite: L.TileLayer | null = null;
  let unavailable = false;
  let selected: "map" | "satellite" = "map";

  const root = document.createElement("div");
  root.className = "flytally-map-style-control leaflet-bar";
  root.setAttribute("aria-label", "Map background");
  const buttons = document.createElement("div");
  buttons.className = "flytally-map-style-actions";
  const standard = document.createElement("button");
  standard.type = "button";
  standard.textContent = "Standard";
  standard.setAttribute("aria-label", "Standard map");
  const satellite = document.createElement("button");
  satellite.type = "button";
  satellite.textContent = "Satellite";
  satellite.setAttribute("aria-label", "Satellite map");
  const message = document.createElement("small");
  message.className = "flytally-map-style-status";
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
  message.hidden = true;
  buttons.append(standard, satellite);
  root.append(buttons, message);
  L.DomEvent.disableClickPropagation(root);
  L.DomEvent.disableScrollPropagation(root);

  function status(value: string) {
    message.textContent = value;
    message.hidden = !value;
  }

  function render() {
    standard.setAttribute("aria-pressed", String(selected === "map"));
    satellite.setAttribute("aria-pressed", String(selected === "satellite"));
    satellite.disabled = unavailable;
  }

  function detachSatellite() {
    if (!activeSatellite) return;
    activeSatellite.off("tileerror", onSatelliteError);
    activeSatellite.off("load", onSatelliteLoad);
    activeSatellite = null;
  }

  function standardMap(fallback = false) {
    detachSatellite();
    selected = "map";
    attachStandardBasemap(map, STANDARD_URL, STANDARD_ATTRIBUTION);
    status(fallback ? "Satellite unavailable — showing Standard" : "");
    render();
  }

  function onSatelliteError() {
    if (disposed || !activeSatellite || selected !== "satellite") return;
    // No silent broken/partial imagery presented as successful satellite cover.
    unavailable = true; // Prevent retry storms until the map is remounted.
    standardMap(true);
  }

  function onSatelliteLoad() {
    if (disposed || !activeSatellite || selected !== "satellite") return;
    status(""); // Leaflet 'load' covers the requested tile set at this viewport.
  }

  function selectSatellite() {
    if (disposed || unavailable || selected === "satellite") return;
    selected = "satellite";
    status("Loading satellite…");
    render();
    try {
      activeSatellite = attachSatelliteBasemap(
        map,
        SATELLITE_URL,
        SATELLITE_ATTRIBUTION,
        onSatelliteLoad,
        onSatelliteError,
      );
    } catch {
      unavailable = true;
      standardMap(true);
    }
  }

  function selectStandard() {
    if (!disposed && selected !== "map") standardMap();
  }
  standard.addEventListener("click", selectStandard);
  satellite.addEventListener("click", selectSatellite);
  render();

  const control = new L.Control({ position: "topright" });
  control.onAdd = () => root;
  control.addTo(map);

  return () => {
    disposed = true;
    detachSatellite();
    standard.removeEventListener("click", selectStandard);
    satellite.removeEventListener("click", selectSatellite);
    control.remove();
  };
}
