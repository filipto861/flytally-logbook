# Logbook architecture — v0.54

v0.54 pokračuje v modularizaci zahájené ve v0.53 a zavádí samostatnou vrstvu pro přípravu GPS/mapových dat. Hlavní princip je oddělit **fidelitu uložených GPS dat** od **fidelity potřebné pro vykreslení v browseru**.

## Current structure

```text
app.py                         Streamlit routing, DB access and application orchestration
logbook_core/
  config.py                    Paths, version, options and navigation constants
  schema.py                    SQLite schema definition
  metrics.py                   Time normalization, flight metrics and summaries
  tracks.py                    KML parsing and full-fidelity GPS/track analysis
  map_engine.py                Adaptive browser render budgets, geometry simplification, viewport
  exports.py                   Excel/print export builders
  performance.py               SQLite/cache/general performance helpers
logbook_ui/
  theme.py                     Global theme, header, metric card, Plotly layout
  filters.py                   Shared Streamlit filter UI
scripts/                       Data import/seed utilities
data/                          Runtime/reference data
```

## GPS data flow in v0.54

```text
SQLite track_points (full fidelity)
          |
          v
SQL candidate sampling (bounded)
          |
          v
Map Engine 2.0 geometry simplifier
          |
          v
compact JSON payload
          |
          v
Folium / Leaflet canvas renderer
```

The original `flight_tracks.coordinates_json` remains available as a compatibility fallback. The map engine never rewrites stored track data.

## Render budget

The overview map uses two independent controls:

1. **Track limit** — Rychlá/Střední keep the historical 40/120 limits; Vše includes all tracks.
2. **Point budget** — point count per track adapts to the number of visible tracks so browser payload cannot grow linearly at 180 points per track forever.

This is especially important for the long-term logbook: 1 000 tracks in mode Vše target about 24 points/track instead of 180 points/track.

## Refactor rules

1. `data/logbook.sqlite` is never replaced by release ZIPs.
2. `DB_SCHEMA_VERSION` remains 5 in v0.54.
3. Map simplification is presentation-only; calculations continue to use full GPS data.
4. KML parsing and takeoff/landing detection are intentionally not redesigned in v0.54.
5. Smooth Track Player is intentionally kept functionally stable.

## Next architecture candidates

After v0.54 production validation, the next logical step is **Smart KML Import / Flight Segmentation**: detection of ground stops, separate flights, invalid pre-flight/post-flight fragments, touch-and-go and user-adjustable split points.
