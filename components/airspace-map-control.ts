import L from "leaflet";

/**
 * Private reference-only combined aviation presentation. Intentionally independent
 * of Standard/Satellite basemap ownership and all flight/certification data.
 *
 * Build flag OFF by default. A2B1 server-side auth/provider/key gates remain
 * authoritative; this client flag must never be mistaken for provider approval.
 */
export const AIRSPACES_MAPS_TRIAL_ENABLED =
  process.env.NEXT_PUBLIC_FLYTALLY_AIRSPACES_MAPS === "true";

const AIRSPACE_TILES = "/api/airspace-tile/{z}/{x}/{y}";
const MAX_AIRSPACE_REQUEST_ZOOM = 14; // FlyTally request budget, NOT openAIP source coverage.
const AIRSPACE_ATTRIBUTION =
  'Aviation reference &copy; <a href="https://www.openaip.net/" target="_blank" rel="noopener noreferrer">openAIP</a> · Coverage/status unverified';

export function installAirspaceMapControl(map: L.Map, enabled: boolean, host?: HTMLElement): () => void {
  if (!AIRSPACES_MAPS_TRIAL_ENABLED || !enabled) return () => {};

  let disposed = false;
  let active: L.TileLayer | null = null;
  let selected = false;
  let unavailable = false;

  const root = document.createElement("div");
  root.className = host ? "flytally-map-setting-section flytally-airspace-control" : "flytally-map-style-control flytally-airspace-control leaflet-bar";
  root.setAttribute("aria-label", "Overlays");
  root.setAttribute("role", "group");
  if (host) {
    const heading = document.createElement("h3");
    heading.className = "flytally-map-settings-section-title";
    heading.textContent = "Overlays";
    root.append(heading);
  }
  const buttons = document.createElement("div");
  buttons.className = "flytally-map-style-actions";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.textContent = "Aviation";
  toggle.setAttribute("aria-label", "Aviation overlay");
  toggle.setAttribute("aria-pressed", "false");
  const message = document.createElement("small");
  message.className = "flytally-map-style-status";
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
  message.hidden = true;
  buttons.append(toggle);
  root.append(buttons, message);
  L.DomEvent.disableClickPropagation(root);
  L.DomEvent.disableScrollPropagation(root);

  function status(text: string) {
    message.textContent = text;
    message.hidden = !text;
  }
  function render() {
    toggle.setAttribute("aria-pressed", String(selected));
    toggle.disabled = unavailable;
  }
  function detachLayer() {
    if (!active) return;
    const layer = active;
    active = null;
    layer.off("tileerror", tileError);
    layer.off("load", tileLoad);
    if (map.hasLayer(layer)) map.removeLayer(layer);
  }
  function tileError() {
    if (disposed || !selected || !active) return;
    unavailable = true; // Avoid retry storms until map remount.
    selected = false;
    detachLayer();
    status("Aviation unavailable — reference layer hidden");
    render();
  }
  function tileLoad() {
    if (disposed || !selected || !active) return;
    // A successful raster fetch does NOT attest to full coverage or currency.
    status("Aviation reference only · coverage and current status unverified");
  }
  function removeAirspaces() {
    selected = false;
    detachLayer();
    status("");
    render();
  }
  function addAirspaces() {
    if (disposed || unavailable || selected) return;
    if (map.getZoom() > MAX_AIRSPACE_REQUEST_ZOOM) {
      status("Aviation not shown above zoom 14 (FlyTally limit)");
      return;
    }
    selected = true;
    status("Loading aviation reference…");
    render();
    try {
      const layer = L.tileLayer(AIRSPACE_TILES, {
        pane: "flytallyAviation",
        maxZoom: MAX_AIRSPACE_REQUEST_ZOOM,
        opacity: 0.85,
        attribution: AIRSPACE_ATTRIBUTION,
      });
      active = layer;
      layer.on("tileerror", tileError);
      layer.on("load", tileLoad);
      layer.addTo(map);
    } catch {
      unavailable = true;
      selected = false;
      detachLayer();
      status("Aviation unavailable — reference layer hidden");
      render();
    }
  }
  function onClick() {
    if (selected) removeAirspaces();
    else addAirspaces();
  }
  function onZoomEnd() {
    if (disposed) return;
    if (selected && map.getZoom() > MAX_AIRSPACE_REQUEST_ZOOM) {
      selected = false;
      detachLayer();
      status("Aviation hidden above zoom 14 (FlyTally limit)");
      render();
    } else if (!selected && !unavailable && map.getZoom() <= MAX_AIRSPACE_REQUEST_ZOOM) {
      status("");
    }
  }

  toggle.addEventListener("click", onClick);
  map.on("zoomend", onZoomEnd);
  render();
  let control: L.Control | null = null;
  if (host) host.append(root);
  else {
    control = new L.Control({ position: "topright" });
    control.onAdd = () => root;
    control.addTo(map);
  }

  return () => {
    disposed = true;
    map.off("zoomend", onZoomEnd);
    detachLayer();
    toggle.removeEventListener("click", onClick);
    control?.remove();
    root.remove();
  };
}
