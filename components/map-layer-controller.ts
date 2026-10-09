import L from "leaflet";

/**
 * Presentation-only Leaflet basemap controller. Phase 1 deliberately supports
 * only the existing standard map. Provider selection is a later, licensed phase.
 */
const STANDARD_DARK_FILTER = "invert(.78) hue-rotate(180deg) saturate(.12) brightness(.92) contrast(1.08)";

type Layers = {
  basePane: HTMLElement;
  aviationPane: HTMLElement;
  base: L.TileLayer | null;
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

  const state: Layers = { basePane, aviationPane, base: null };
  mounted.set(map, state);
  return state;
}

export function attachStandardBasemap(map: L.Map, url: string, attribution: string): L.TileLayer {
  const state = ensureLayers(map);
  if (state.base && map.hasLayer(state.base)) return state.base;

  if (state.base) map.removeLayer(state.base);
  const layer = L.tileLayer(url, {
    maxZoom: 18,
    pane: "flytallyBasemap",
    attribution,
  });
  state.base = layer;
  layer.addTo(map);
  return layer;
}

export function applyStandardMapTheme(map: L.Map, theme: "light" | "dark") {
  const state = mounted.get(map);
  if (!state) return;
  state.basePane.style.filter = theme === "dark" ? STANDARD_DARK_FILTER : "none";
  state.aviationPane.style.filter = "none";
  const tiles = map.getPane("tilePane");
  if (tiles) tiles.style.filter = "none";
}

// Call during map unmount; weak ownership prevents retaining dead Leaflet maps.
export function releaseMapLayers(map: L.Map) {
  mounted.delete(map);
}
