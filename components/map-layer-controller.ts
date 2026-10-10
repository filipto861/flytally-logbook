import L from "leaflet";

/**
 * Presentation-only Leaflet basemap controller.
 * Only the explicitly selected map background may change; track, playback and
 * certified flight evidence are outside this controller.
 */
const STANDARD_DARK_FILTER = "invert(.78) hue-rotate(180deg) saturate(.12) brightness(.92) contrast(1.08)";

type MapStyle = "map" | "satellite";
type Layers = {
  basePane: HTMLElement;
  aviationPane: HTMLElement;
  base: L.TileLayer | null;
  style: MapStyle;
  theme: "light" | "dark";
};

const mounted = new WeakMap<L.Map, Layers>();

function ensurePane(map: L.Map, name: string, zIndex: string) {
  const pane = map.getPane(name) ?? map.createPane(name);
  pane.style.zIndex = zIndex;
  return pane;
}

function ensureLayers(map: L.Map): Layers {
  const existing = mounted.get(map);
  if (existing) return existing;

  // The global tile pane must never filter imagery, aviation tiles or controls.
  const defaultTiles = map.getPane("tilePane");
  if (defaultTiles) defaultTiles.style.filter = "none";

  const basePane = ensurePane(map, "flytallyBasemap", "210");
  const aviationPane = ensurePane(map, "flytallyAviation", "300");
  aviationPane.style.pointerEvents = "none";
  aviationPane.style.filter = "none";

  const state: Layers = { basePane, aviationPane, base: null, style: "map", theme: "light" };
  mounted.set(map, state);
  return state;
}

function setBasemapFilter(state: Layers) {
  state.basePane.style.filter =
    state.style === "map" && state.theme === "dark" ? STANDARD_DARK_FILTER : "none";
}

function attachBasemap(
  map: L.Map,
  style: MapStyle,
  url: string,
  attribution: string,
  onLoad?: () => void,
  onError?: () => void,
): L.TileLayer {
  const state = ensureLayers(map);
  if (state.base && map.hasLayer(state.base) && state.style === style) return state.base;

  if (state.base) map.removeLayer(state.base);
  const layer = L.tileLayer(url, {
    maxZoom: 18,
    pane: "flytallyBasemap",
    attribution,
  });
  if (onLoad) layer.on("load", onLoad);
  if (onError) layer.on("tileerror", onError);
  state.base = layer;
  state.style = style;
  setBasemapFilter(state);
  layer.addTo(map);
  return layer;
}

export function attachStandardBasemap(map: L.Map, url: string, attribution: string): L.TileLayer {
  return attachBasemap(map, "map", url, attribution);
}

export function attachSatelliteBasemap(
  map: L.Map,
  url: string,
  attribution: string,
  onLoad: () => void,
  onError: () => void,
): L.TileLayer {
  return attachBasemap(map, "satellite", url, attribution, onLoad, onError);
}

export function applyStandardMapTheme(map: L.Map, theme: "light" | "dark") {
  const state = mounted.get(map);
  if (!state) return;
  state.theme = theme;
  setBasemapFilter(state);
  state.aviationPane.style.filter = "none";
  const tiles = map.getPane("tilePane");
  if (tiles) tiles.style.filter = "none";
}

// Call during map unmount; weak ownership prevents retaining dead Leaflet maps.
export function releaseMapLayers(map: L.Map) {
  mounted.delete(map);
}
