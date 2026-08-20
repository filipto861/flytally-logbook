# Logbook architecture — v0.67

## Flight Import UX 2.0

v0.62.2 ponechává parser, Smart KML a datovou vrstvu beze změny, ale přidává orchestration vrstvu pro bezpečný import před zápisem do SQLite.

### Import state machine

KML import je logicky rozdělen do čtyř stavů:

1. upload,
2. Smart KML analýza a volba rozdělení,
3. editace údajů letu,
4. finální review.

Finální formulářová data se mezi krokem 3 a 4 drží pouze v `st.session_state`. Databázový `create_flight()` a `save_track()` se volají až po explicitním potvrzení review.

### Single-track review

Klíč `_single_import_review_key(signature)` izoluje review stav konkrétního nahraného souboru. Při návratu k editaci se review payload odstraní, ale KML zůstane v uploader/session workflow.

### Split-track review

Každý díl používá `_split_import_review_key(signature, progress)`. Díl se zapíše do databáze až po vlastní finální kontrole. Po dokončení se průvodce přesune na další část.

### Existing Smart KML guarantees

- automatické rozdělení je pouze návrh,
- uživatel může uložit původní KML jako jeden let,
- ruční split zůstává dostupný,
- touch-and-go pouze předvyplňuje počet startů/přistání,
- vytvoření profilu letadla je volitelné.

### UI compatibility

Statické mapy a Track Player používají `st.iframe` místo deprecated `streamlit.components.v1.html`. Streamlit prvky používají nové width API.

### Persistence

- DB schema: 8
- žádná migrace
- multi-user tenant ownership zůstává beze změny
- GPS body ani původní KML nejsou při preview modifikovány


## v0.62.2 cleanup rules
1. Runtime behavior and DB schema stay unchanged (`DB_SCHEMA_VERSION = 8`).
2. No release file may contain or replace `data/logbook.sqlite`.
3. Cross-user reads remain explicitly user-scoped; generic table readers are allow-listed.
4. Compatibility is handled in application bootstrap, not through global SQLite monkeypatches.
5. Dependency upgrades are deliberate releases, not implicit deploy-time changes.


## v0.62.2 dashboard analytics layer

`logbook_core/dashboard.py` obsahuje čisté, Streamlit-independent agregace pro období, měsíce, roky, letadla, letiště, trasy a dashboardové rekordy. UI pouze vybírá aktuální sekci a renderuje již agregovaná data. Tím se drží náklad skrytých dashboardových sekcí mimo aktuální rerun.

## v0.67 Pilot Currency & Recency

`logbook_core/currency.py` owns rolling activity and validity-status calculations. The UI page only renders those results.

### Data model

`user_expiries` is a new tenant-scoped table with `user_id`, category, label, expiry date, warning lead time and note. `DB_SCHEMA_VERSION = 9`. The standard idempotent `SCHEMA` bootstrap creates the table on existing databases; existing flight data is untouched.

### Safety boundary

The 90-day cards are logbook activity indicators only. They intentionally do not claim regulatory currency because the current flight model does not encode every rule dimension such as day/night, separate take-offs/approaches, type/class equivalence or sole-manipulator conditions.


## v0.67 portable backup boundary
Portable backups are intentionally account-scoped. Restore rewrites ownership to the currently authenticated `user_id` and never imports authentication credentials or application roles. The portable payload covers `flights`, `aircraft`, `rates`, user airport overrides, `flight_tracks`, `track_points`, `user_expiries`, and `user_settings`. The global airport catalogue, `app_meta`, `audit_log`, `users`, and `user_credentials` are outside the portable restore boundary.

Restore mode in v0.67 is deliberately **replace current profile data**, not merge. This avoids duplicate flights and ambiguous relation matching. The operation is atomic and remaps flight/track IDs when rebuilding GPS relationships.


## v0.67 manual-entry boundary
`logbook_core.flight_entry` contains pure history/default-selection logic. Streamlit session continuity remains in `app.py`. Smart manual defaults are conservative by design: only the previous arrival and last configured aircraft may be carried forward. Arrival and all four flight times require explicit user input or an explicit shortcut action.

The KML import wizard and flight edit form still use the full form layout. `flight_form(..., compact_layout=True)` is currently reserved for new manual entries.


## v0.67 logbook view boundary
`logbook_core.logbook_view` owns pure quick-search and flight-neighbour navigation logic. The Streamlit list renders only one button per visible row; edit/track/delete remain inside the detail dialog. Navigation order follows the exact current filtered + sorted + quick-searched result, not database ID order.

No data model changes are introduced. `DB_SCHEMA_VERSION` remains 9.


## v0.67 track player architecture
`logbook_core.track_player.build_track_player_payload()` prepares a compact, browser-safe payload with coordinates, smoothed speed, altitude, distance, bearing, local clock and elapsed GPS seconds. The embedded player performs continuous interpolation entirely client-side.

The player uses a 0–1 virtual progress axis. When complete timestamps are available the axis maps to GPS elapsed time; otherwise it falls back to point order. Leaflet marker movement, SVG profile cursor and HUD values share the same interpolated sample.

For performance, the whole route is static, completed progress is updated only when the underlying GPS segment changes, and only the current two-point active segment changes every animation frame. No Streamlit rerun occurs while playing or scrubbing.

`DB_SCHEMA_VERSION` remains 9.
