# Streamlit → Vercel parity audit

This document is the durable acceptance checklist for the migration branch. It is based on the original Streamlit source (`app.py`, `logbook_core/*`, `logbook_ui/*`) and its regression tests, not only on screenshots.

## Implemented parity

- Authentication, profile, password change, expiries, recency and administrator user controls.
- Dashboard period presets, ULL/EASA and PIC category cards, monthly metric switching, yearly/aircraft/route/cost/recent detail tabs.
- Flight list quick search, hidden advanced filters, sorting, filtered totals, page sizes including **All**, and chronological detail navigation.
- Manual flight defaults, recent-route shortcuts, time helper, save-and-add-another, full edit and delete.
- Inline aircraft creation, aircraft profiles, historical rates and manual airport overrides.
- KML, GPX and timed CSV parsing; FR24 Point/LineString separation; all `gx:Track` blocks; chronological normalization.
- Multi-flight proposal editor with movable/addable/removable boundaries. Every resulting flight has its own map, date, four editable times, airports, landings and mandatory confirmation.
- Conservative split handling for a ground turnaround while preserving a distant in-flight coverage gap as one flight.
- Airport inference from take-off/landing windows using the complete bundled OurAirports catalogue, with user overrides taking priority.
- GPS track map, route/airport overview map, clickable route and airport filtering, endpoint-to-airport direct extensions and map detail links.
- Flight player with map cursor and overlaid altitude/speed profile.
- Data-quality findings and safe fill-only repairs from aircraft profiles.
- CSV, multi-sheet Excel-compatible export, full JSON account backup and print/PDF layout.
- Original logo on login/sidebar and favicon.

## Acceptance checks after deployment

1. Sign in against the production PostgreSQL database and switch every dashboard period/metric/detail tab.
2. Upload one known single-flight KML and one known multi-flight KML; verify proposal, airports, local times, manual boundary edits and per-flight confirmations.
3. Open GPS and route overview maps, then click one route and one airport and confirm the filtered flight list.
4. Open a flight track player and verify the shared map/profile cursor plus altitude and speed overlays.
5. Download CSV, Excel, JSON backup and print view; compare record counts with the dashboard.
6. Run Data quality and inspect every reported flight before using safe fill-only repair.

The production database is never automatically rewritten by this checklist.
