# Letový zápisník

## v0.71 – Pilot Currency & Recency

- new **Recency** navigation page
- last flight and last landing overview
- rolling 90-day **PIC ULL** and **PIC EASA** activity cards
- rolling 30 / 90 / 365 day activity table
- new user-owned validity records for medicals, licences, ratings and other documents
- configurable warning lead time for every validity record
- status states: valid / warning / expired
- strict tenant isolation for validity records
- recency activity is explicitly informational; it does not claim legal passenger-carrying currency
- database schema upgraded from 8 to **9** by adding `user_expiries`

## v0.62.2 – Flight Import UX 2.0

v0.61 sjednocuje KML import do jednoho konzistentního workflow a přidává finální kontrolu před uložením.

### Nový čtyřkrokový KML workflow

1. **KML / Soubor** – nahrání zdrojového KML.
2. **Smart KML / Analýza** – detekce více letů, touch-and-go, časových mezer a GPS anomálií.
3. **Údaje letu / Kontrola polí** – mapa, automaticky odhadnuté časy, letiště, registrace a editovatelný formulář.
4. **Finální kontrola / Uložit** – souhrn všech údajů, nákladů a GPS tracku před skutečným zápisem do databáze.

Do databáze se nic nezapíše, dokud uživatel nepotvrdí finální kontrolu.

### Rozdělené tracky

Pokud Smart KML navrhne více letů, každý díl má vlastní workflow a vlastní finální kontrolu. Po uložení jednoho dílu pokračuje průvodce na další část. Body rozdělení zůstávají po prvním uložení uzamčené stejně jako v předchozí verzi.

### Návrat k editaci

Ve finální kontrole je tlačítko **Upravit údaje**, které vrátí uživatele zpět k formuláři bez ztráty nahraného KML nebo Smart KML analýzy.

### Inline profil letadla

Workflow z v0.60.3 zůstává zachovaný. Pokud importovaná registrace nemá profil letadla, lze jej vytvořit přímo v popupu a potom pokračovat v rozpracovaném importu.

### Branding

Součástí release jsou soubory:

- `assets/logbook_icon.png`
- `assets/logbook_icon_32.png`
- `assets/favicon.ico`

Aplikace používá vlastní ikonu v záložce prohlížeče.

### Streamlit API cleanup

v0.61 odstraňuje staré přímé použití `streamlit.components.v1.html` a hlavní výskyty deprecated `use_container_width`. Interní HTML/JS vizualizace se vykreslují přes současné `st.iframe` API a Streamlit prvky používají `width="stretch"`.

### Databáze

- `APP_VERSION = v0.61`
- `DB_SCHEMA_VERSION = 8`
- není nutná migrace databáze,
- SQLite + privátní GitHub auto-backup zůstává zachován,
- release ZIP neobsahuje `data/logbook.sqlite`.


## v0.62.2 hotfix
- fixes Streamlit 1.62 `StreamlitInvalidWidthError` caused by zero-width runtime iframes
- sidebar toggle and page-transition helper iframes now use 1×1 px dimensions


## v0.62.2
Invisible front-end runtime: sidebar toggle and page-transition scripts now use `st.html(..., unsafe_allow_javascript=True)` instead of 1×1 px iframes, removing the visible white artifacts introduced by the v0.61.1 compatibility hotfix.


## v0.62.2 – Sidebar UX Final Polish
- minimalistický edge handle se dvěma chevrony bez kruhu a pozadí
- ovladač přesunut z řádku Navigace na samostatnou hranu sidebaru
- návrat k rychlejšímu 320 ms motion profilu z dřívějších verzí
- compositor hints přes translate3d/backface visibility a odstranění drahého width transition
- kliknutí pouze přepíná CSS stav; žádný Streamlit rerun


## v0.62.2 – Top Sidebar Chevron Polish
- sidebar handle moved to the upper-right area inside the open sidebar
- two chevrons are horizontal instead of stacked
- chevrons are larger with a wider click target
- closed-state handle remains available at the left edge
- compositor-friendly sidebar motion from v0.61.5 is preserved


## v0.62.2 – Stability & Performance Cleanup
No new user-facing feature is introduced. This release prepares a stable base for v0.62.2.

- removed confirmed dead and legacy UI/map helper code from `app.py`
- removed duplicate `logbook_core.performance` fallback implementations
- removed unused imports and obsolete helper code
- authenticated session IDs no longer have any fallback path to user `1`
- generic cached SQL readers accept only explicitly permitted tables
- normal current-database cold starts skip the unnecessary second full `SCHEMA` DDL pass
- cached track-map JSON decoding uses the standard JSON decoder instead of a Pandas JSON parser
- old global `sitecustomize.py` SQLite monkeypatch was neutralized in v0.61.7 and the startup hook is removed entirely in v0.71
- runtime dependencies are exactly pinned to the versions validated on Streamlit Cloud
- Streamlit 1.62 compatibility checks remain part of the regression suite


## v0.62.2 – Dashboard & Statistics 2.0

- nový rychlý volič období: celá historie, tento rok, posledních 12 měsíců, předchozí rok
- dashboardové filtry zůstávají uživatelsky kombinovatelné s obdobím
- nová horní sada KPI: Block, PIC, Air time, náklady, letadla, letiště/trasy, GPS a poslední let
- přehled přidává rekordy: nejaktivnější měsíc, nejdelší let, top letadlo a top trasu
- nový měsíční kombinovaný graf Block h + počet letů
- roční rozpad podle role a evidence a formátovaný roční souhrn
- rozšířené statistiky letadel včetně podílu na náletu, průměrné délky letu, ceny za block h, GPS a posledního letu
- detail vybraného letadla přímo v dashboardu
- letiště rozlišují odlety, přílety a návštěvy; trasy obsahují průměrný Block a poslední použití
- nákladová sekce má měsíční trend, rozpad podle letadla a průměry
- Poslední lety obsahují 30denní rychlý souhrn a volitelný počet řádků
- agregace dashboardu jsou přesunuty do čistého modulu `logbook_core/dashboard.py`
- jednotlivé dashboardové sekce zůstávají lazy: skryté grafy a tabulky se nevytvářejí
- `DB_SCHEMA_VERSION = 8`; bez migrace databáze


## v0.62.2 – Dashboard Polish
- dashboard hierarchy now prioritizes total logged time
- primary evidence split: ULL and EASA with landing counts
- primary PIC split: PIC ULL and PIC EASA with landing counts
- one dominant monthly chart with metric selector
- contextual items are condensed into one lightweight information line
- aircraft, airports/routes, costs, annual analysis and recent flights remain available under `Detailní statistiky`
- no database migration; schema stays at 8


## v0.62.2 – Dashboard Card Visual Polish
- fixes missing v0.62.1 dashboard-specific CSS
- restores rich card visuals without restoring dashboard clutter
- total time gets a stronger hero-card treatment
- ULL/EASA/PIC cards use subtle accent strips and gradients
- flight and landing counts are displayed as compact chips
- typography, spacing and numeric emphasis are improved
- no data model or calculation changes

## v0.71 – Profile Recency Polish
- removes the standalone Recency item from sidebar navigation
- moves validity/recency into `Profil → Platnosti`
- licence/medical/rating expiry tracking is the primary content
- 90-day ULL/EASA activity is reduced to a small supporting summary
- removes the large 30/90/365-day activity table from the UI
- legacy `Recency` sessions/bookmarks redirect safely to Profile
- database schema remains 9; no migration required


## v0.71 – Data Portability & Backup UX
- adds `Export → Záloha účtu` for every authenticated user
- portable ZIP contains only the signed-in profile's flights, aircraft, rates, custom airports, GPS tracks/points, validity records and preferences
- passwords, password hashes, roles, other users, global airport catalogue and audit history are excluded
- portable restore is tenant-safe: it replaces only the current profile's portable data
- account identity (e-mail/password/role/user id) is never overwritten by restore
- restore validates archive format before writing and runs atomically in a SQLite savepoint
- every restore automatically creates a downloadable safety backup of the state that existed immediately before restore
- human-readable CSV copies of the main tables are included in the ZIP
- full SQLite/GitHub backup remains an admin-only technical backup under Database
- database schema remains 9


## v0.71 – Flight Entry UX 2.0
- manual flight entry now uses a compact pilot-focused layout
- the most recent flight can prefill the last aircraft and next departure airport
- last aircraft is reused only when its aircraft profile still exists
- no destination or flight times are guessed automatically
- quick route buttons offer local flight, home airport and frequent destinations when relevant
- less frequently used fields (evidence, type/class, crew details, pricing, task and note) live under `Další údaje`
- validation warnings are less visually intrusive during normal manual entry; blocking errors remain explicit
- `Uložit a přidat další` saves a leg and immediately prepares the next one, keeping aircraft/profile values and continuing from the previous arrival
- KML import and existing-flight edit layouts remain unchanged
- database schema remains 9


## v0.71 – Manual Entry None Safety Hotfix
- fixes `AttributeError: 'NoneType' object has no attribute 'upper'` when a new manual flight has an empty arrival
- hardens all new v0.65 manual-entry uppercase conversions against missing optional values
- no UX, database or schema changes


## v0.71 – Flight Detail & Logbook UX Polish
- simplifies the flight list from 15 columns to 9
- removes separate Edit/GPS buttons from every list row; all actions remain available inside Detail
- visible rows now render one Streamlit action button instead of three, reducing widget count substantially
- quick search uses a lower-memory column-mask implementation
- filtered logbook summary now prioritizes flights, Block, PIC and landings
- flight detail adds Previous / Next navigation within the current filtered/search result
- detail overview is reorganized around Block, Air, landings and cost
- aircraft/crew and time information are grouped into two concise panels
- GPS status remains visible without occupying a top-level metric card
- non-blocking validation warnings are collapsed by default
- user-supplied list/detail text is HTML-escaped before unsafe HTML rendering
- KML import, GPS playback, edit form and database schema remain unchanged


## v0.71 – Map & Track UX 2.0
- GPS playback now interpolates continuously between recorded fixes instead of jumping point-to-point
- browser animation uses `requestAnimationFrame`, so moving the aircraft does not trigger Streamlit reruns
- map position, aircraft bearing, altitude, groundspeed, distance, timeline and chart cursor are synchronized
- playback uses actual GPS elapsed time as its horizontal axis when timestamps are available
- profile chart itself is now a draggable scrubber
- timeline scrubber has 10,000 virtual positions for smooth manual movement even after track downsampling
- aircraft icon rotates continuously using the shortest angular path between bearings
- Groundspped is shown primarily in knots with km/h as a secondary value
- `Sledovat letadlo` follow mode keeps the map centered on the aircraft; manual map dragging automatically disables follow mode
- `Celý let` restores the complete route view
- playback speed cycles through 1× / 2× / 4×
- progress rendering is split into completed route + one active segment to avoid rebuilding thousands of polyline points on every animation frame
- start/end markers make route direction immediately visible
- long tracks are capped at 2,800 browser-player points; the complete original KML remains stored
- mobile player uses a shorter map/profile and stacked controls
- data preparation moved to `logbook_core/track_player.py` for testable interpolation metadata
- KML import logic, stored track data and database schema remain unchanged


## v0.71 – Data Quality & Automation
- adds `Databáze → Kvalita dat` without expanding the sidebar
- scan runs only on demand and is scoped strictly to the signed-in user
- simple overall status: OK / UPOZORNĚNÍ / PROBLÉM
- detects missing core fields, invalid evidence/roles and incomplete time pairs
- detects implausible Block/Air relationships, very long flights and suspicious taxi intervals
- detects exact duplicate flights and near-duplicates on the same date/aircraft/route
- checks flight aircraft data against the matching aircraft profile
- detects flights using aircraft registrations without a configured profile
- checks whether used departure/arrival identifiers exist in the global/local airport registry with coordinates
- checks GPS metadata for tracks with fewer than two points or effectively zero distance
- GPS endpoint suggestions can fill a missing departure/arrival after explicit per-flight confirmation
- safe bulk repair only fills empty evidence/type/class/role values from aircraft profiles; existing values are never overwritten
- mismatches, duplicate deletion and unknown airport decisions remain manual
- every applied repair is audited and triggers the existing post-change backup flow
- Data Quality result is kept in session only; no schema table is added
- database schema remains 9


## v0.71 – Production Hardening & Performance Audit
- schema marker 10: adds tenant-owner guard triggers and a user/id audit index; no user data table rebuild
- thread-safe SQLite cold initialization plus 10-second busy timeout
- removes accidental double/triple Streamlit cache decorators that could retain stale inner cache values
- cache invalidation is user-keyed where practical instead of clearing unrelated users' cached data
- account login/logout now clears the complete browser session state to prevent cross-account residue of prepared backups, imports or form values
- repeated failed login attempts receive a short session-level exponential cooldown
- GitHub backups are serialized process-wide to avoid concurrent remote-SHA races
- GitHub/admin SQLite backup uses SQLite Backup API snapshots rather than reading the live WAL database file directly
- full database restore validates size, SQLite integrity, foreign keys, required tables and schema compatibility before an atomic replacement
- full database restore forces reauthentication afterward
- admin download generates a snapshot only on request rather than reading the DB on every rerun
- Data Quality remains the only place for semantic flight repairs; admin Safe Service now performs structural repairs only
- database health JSON inspection is bounded to the latest 500 tracks
- map mini-table unsafe HTML values are consistently escaped
- index-friendly exact airport-ident lookups replace `UPPER(TRIM(...))` scans
- removes unreachable Database branches, stale cache invalidation names, obsolete helpers and the Python `sitecustomize` startup hook


## v0.71 – Navigation Performance Hotfix
- sidebar navigation now uses a Streamlit button callback and performs only the rerun already caused by the click
- removes the redundant explicit `st.rerun()` that previously caused two complete script passes for every menu change
- keeps the selected page available before the same rerun reaches the main router
- adds a request-local current-profile snapshot so repeated role/name/timezone/currency lookups inside one rerun do not repeatedly traverse the Streamlit data-cache wrapper
- the request-local profile cache is recreated on every script run, so the v0.69 authentication/session hardening remains intact
- shortens only the visual page-loader fade timings; the loader safety timeouts remain in place
- database schema remains 10


## v0.71 – PostgreSQL & Production Multi-User Foundation
- SQLite remains the only active application runtime in this release
- PostgreSQL runtime cutover is deliberately hard-locked off
- adds a versioned PostgreSQL schema mirroring all Logbook account/user/flight/aircraft/airport/GPS/audit tables
- PostgreSQL schema includes tenant-owner trigger guards for flight → track → GPS point relationships
- adds lazy Psycopg 3 connection pooling for target diagnostics and future runtime use
- PostgreSQL credentials are accepted only from Streamlit Secrets/environment and are redacted in the UI
- adds Admin → PostgreSQL diagnostics, healthcheck, source/target row-count comparison and migration downloads
- adds a safe SQLite → PostgreSQL CLI migration tool
- migration always uses a transactionally consistent SQLite Backup API snapshot
- source IDs and user_id ownership are preserved
- target must be empty; the migration tool never truncates or deletes PostgreSQL data
- post-copy verification checks every table count plus tenant/FK ownership invariants
- PostgreSQL sequences are advanced after preserved-ID import
- world `data/airports_full.sqlite` is intentionally not migrated; it remains a shared read-only reference catalogue
- full password hashes and account credentials are migrated because this is a whole-application database migration, not a portable user export
- SQLite schema remains 10; PostgreSQL foundation schema is version 1


## v0.71 – PostgreSQL Shadow Migration & Verification
- production read/write runtime remains SQLite; cutover is still hard-locked off
- Admin → PostgreSQL becomes a shadow migration/verification control center
- first shadow migration can be launched from Admin only after exact confirmation and credential-copy acknowledgement
- migration still refuses any non-empty PostgreSQL Logbook target and never deletes target rows
- migration now marks the target with shadow protocol metadata and migration timestamp
- quick verification compares normalized table counts and per-user pilot totals
- pilot totals include flights, landings, Block, Air, PIC, PIC ULL/EASA, ULL/EASA, DUAL, track count and GPS point count
- source and target `last_change_at` are compared so an older shadow is clearly reported as STALE rather than corrupt
- deep verification computes canonical SHA-256 fingerprints for every migrated table
- target-only shadow metadata is intentionally excluded from source/target fingerprints and normalized app_meta counts
- verification works from a transactionally consistent SQLite snapshot
- source/target diagnostic COUNT-query latency is shown separately and explicitly not treated as a whole-app benchmark
- shadow verification reports can be downloaded as JSON
- adds `scripts/verify_postgres_shadow.py` with optional `--deep`
- no automatic shadow reset/resync exists in v0.71; a stale shadow is non-destructive evidence that SQLite changed after the snapshot
- SQLite schema remains 10; PostgreSQL schema remains foundation v1; shadow protocol v1
