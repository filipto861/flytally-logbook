# Logbook architecture — v0.71

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

## v0.71 Pilot Currency & Recency

`logbook_core/currency.py` owns rolling activity and validity-status calculations. The UI page only renders those results.

### Data model

`user_expiries` is a new tenant-scoped table with `user_id`, category, label, expiry date, warning lead time and note. `DB_SCHEMA_VERSION = 9`. The standard idempotent `SCHEMA` bootstrap creates the table on existing databases; existing flight data is untouched.

### Safety boundary

The 90-day cards are logbook activity indicators only. They intentionally do not claim regulatory currency because the current flight model does not encode every rule dimension such as day/night, separate take-offs/approaches, type/class equivalence or sole-manipulator conditions.


## v0.71 portable backup boundary
Portable backups are intentionally account-scoped. Restore rewrites ownership to the currently authenticated `user_id` and never imports authentication credentials or application roles. The portable payload covers `flights`, `aircraft`, `rates`, user airport overrides, `flight_tracks`, `track_points`, `user_expiries`, and `user_settings`. The global airport catalogue, `app_meta`, `audit_log`, `users`, and `user_credentials` are outside the portable restore boundary.

Restore mode in v0.71 is deliberately **replace current profile data**, not merge. This avoids duplicate flights and ambiguous relation matching. The operation is atomic and remaps flight/track IDs when rebuilding GPS relationships.


## v0.71 manual-entry boundary
`logbook_core.flight_entry` contains pure history/default-selection logic. Streamlit session continuity remains in `app.py`. Smart manual defaults are conservative by design: only the previous arrival and last configured aircraft may be carried forward. Arrival and all four flight times require explicit user input or an explicit shortcut action.

The KML import wizard and flight edit form still use the full form layout. `flight_form(..., compact_layout=True)` is currently reserved for new manual entries.


## v0.71 logbook view boundary
`logbook_core.logbook_view` owns pure quick-search and flight-neighbour navigation logic. The Streamlit list renders only one button per visible row; edit/track/delete remain inside the detail dialog. Navigation order follows the exact current filtered + sorted + quick-searched result, not database ID order.

No data model changes are introduced. `DB_SCHEMA_VERSION` remains 9.


## v0.71 track player architecture
`logbook_core.track_player.build_track_player_payload()` prepares a compact, browser-safe payload with coordinates, smoothed speed, altitude, distance, bearing, local clock and elapsed GPS seconds. The embedded player performs continuous interpolation entirely client-side.

The player uses a 0–1 virtual progress axis. When complete timestamps are available the axis maps to GPS elapsed time; otherwise it falls back to point order. Leaflet marker movement, SVG profile cursor and HUD values share the same interpolated sample.

For performance, the whole route is static, completed progress is updated only when the underlying GPS segment changes, and only the current two-point active segment changes every animation frame. No Streamlit rerun occurs while playing or scrubbing.

`DB_SCHEMA_VERSION` remains 9.


## v0.71 Data Quality boundary
`logbook_core.data_quality.scan_data_quality()` is a pure diagnostic engine. It accepts already user-scoped flights, aircraft profiles, used-airport membership and minimal GPS metadata and returns findings without writing data.

Only missing profile-derived values are classified as safe bulk patches. The UI applies partial updates through a tenant-scoped transaction and audit entry. GPS airport suggestions are derived separately from track endpoints and the cached minimal airport spatial index and always require an explicit per-flight action.

The scan is intentionally manual and session-local, so normal Dashboard/Logbook/Database startup does not gain another full-data scan. Full KML coordinate payloads are not loaded for Data Quality; only indexed first/last normalized GPS points are queried.

`DB_SCHEMA_VERSION` remains 9.


## v0.71 production hardening boundary
The application remains SQLite-first, but the persistence boundary is cleaner for a later PostgreSQL repository layer. `logbook_core.sqlite_runtime` owns consistent SQLite snapshots and upload validation. Runtime initialization is protected by a process lock, while user-data caches are invalidated by tenant key where possible.

SQLite tenant integrity is now defense-in-depth: application ownership checks remain primary, and database triggers reject new `flight_tracks` or `track_points` relations whose parent belongs to another user. Existing historical inconsistencies remain visible through Admin → Security/Service rather than being silently rewritten.

Semantic flight normalization was removed from the global admin Safe Service. User content is corrected only through Data Quality's explicit, tenant-scoped actions. Admin Safe Service is limited to structural point cleanup/count synchronization, indexes/triggers, and optimizer maintenance.


## v0.71 database foundation

### Runtime boundary
`connect()` and all production CRUD continue to use `data/logbook.sqlite`. v0.71 intentionally does **not** introduce a runtime backend selector. `postgres_cutover_enabled()` always returns `False`.

This separation prevents a partially migrated target or an accidentally configured `DATABASE_URL` from becoming production data.

### PostgreSQL target modules
- `database_foundation.py`: target configuration, DSN redaction and the cutover lock.
- `postgres_schema.py`: PostgreSQL DDL, indexes, table/column migration manifest and ownership triggers.
- `postgres_runtime.py`: lazy Psycopg pool and read-only diagnostics.
- `postgres_migration.py`: consistent snapshot migration, row-count verification, sequence repair and tenant/FK validation.
- `scripts/migrate_sqlite_to_postgres.py`: explicit CLI entrypoint requiring `--confirm MIGRATE`.

### Migration invariants
The migrator preserves all primary IDs to keep foreign keys and audit object references stable. It refuses a non-empty target instead of trying to merge or overwrite records. The whole copy is performed inside one PostgreSQL transaction under an advisory transaction lock.

The large world-airport catalogue remains a local read-only SQLite asset because it is reference data, not tenant-owned transactional data.

### Next cutover step
A later release can move CRUD repositories behind a backend interface and run PostgreSQL in shadow/read-validation mode before a production cutover. v0.71 only builds and validates the target foundation.


## v0.71 shadow verification architecture

The PostgreSQL target remains outside the production CRUD path.

`shadow_verification.py` creates a consistent temporary SQLite snapshot before every comparison. The quick path compares:
1. source/target migration watermark,
2. normalized counts for every transactional table,
3. per-user flight and GPS summary metrics.

The deep path additionally iterates every table in deterministic primary-key order and hashes canonical row values with SHA-256. Floating-point values are normalized to a stable 12-significant-digit representation to avoid backend display artifacts while preserving meaningful migrated values.

Target-only `app_meta` keys (`shadow_*`, `storage_backend`, `postgres_foundation_schema`) are excluded from normalized app_meta counts/fingerprints.

A stale shadow is distinct from a mismatch. If production SQLite gets a confirmed write after shadow creation, `last_change_at` changes and the verifier reports `stale` even when the historical shadow data is internally valid.

No PostgreSQL DELETE/TRUNCATE/reset path exists in the application in v0.71.
