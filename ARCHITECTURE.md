# Logbook architecture — v0.53

v0.53 starts the transition from a monolithic Streamlit application to a modular codebase. The objective is **structural cleanup without changing user-visible behaviour or the SQLite flight data model**.

## Current structure

```text
app.py                         Streamlit routing and application orchestration
logbook_core/
  config.py                    Paths, version, options and navigation constants
  schema.py                    SQLite schema definition
  metrics.py                   Time normalization, flight metrics and summaries
  tracks.py                    KML parsing and GPS/track analysis
  exports.py                   Excel/print export builders
  performance.py               Performance/SQLite helpers introduced in v0.52
logbook_ui/
  theme.py                     Global theme, header, metric card, Plotly layout
  filters.py                   Shared Streamlit filter UI
scripts/                       Data import/seed utilities
data/                          Runtime/reference data
```

## Refactor rules

1. `data/logbook.sqlite` is not replaced by release ZIPs.
2. v0.53 keeps `DB_SCHEMA_VERSION = 5`; no flight-data migration is introduced.
3. Extracted functions must retain their v0.52 behaviour before any redesign.
4. GPS Map Engine 2.0 is intentionally deferred to a later release.
5. Track Player behaviour is intentionally untouched in this release.

## Next architecture candidates

After v0.53 is validated in production, the next low-risk extractions are database access/services, flight CRUD, and map presentation. GPS map redesign should happen only after those boundaries are stable.
