# v0.73.3 – Lightweight GPS Geometry & Dashboard Hot Path

## Why this release exists

Production telemetry after v0.73.2 showed that the PostgreSQL connection pool
was not the bottleneck (pool checkout p95 was effectively zero). Remaining
latency came from:

1. transferring full `flight_tracks.coordinates_json` to the overview map;
2. repeatedly loading a complete flight dataframe for Dashboard/Map;
3. Plotly startup/render cost on the default Dashboard path;
4. a larger-than-needed Folium overview payload.

## Persistent lightweight GPS geometry

### New derived fields

`flight_tracks` now has:

- `overview_coordinates_json`
- `overview_version`

These fields are a derived performance cache only. Full GPS data remains intact
in:

- `flight_tracks.coordinates_json`
- `track_points`

No flight history or GPS fidelity is removed.

### Overview format

The stored overview contains at most 180 geometry-preserving points and only:

- latitude
- longitude

Values are rounded to 6 decimal places. Time, altitude and other full-track data
remain in the canonical track storage.

### Existing tracks

Existing tracks are upgraded lazily:

1. the overview map asks only for overview payloads;
2. if a selected legacy track has no current overview payload, its full
   `coordinates_json` is fetched once;
3. the overview is generated locally;
4. the derived overview is persisted back to PostgreSQL;
5. future map views — including after Streamlit process restart — use the small
   persisted payload.

Therefore the first GPS map view after deployment can still be slower while the
selected legacy tracks are backfilled. The second/warm view is the meaningful
performance measurement.

### New tracks

KML imports generate the lightweight overview at the same time the full track is
stored.

## Dashboard hot path

Dashboard now uses a compact flight projection rather than the full logbook row.

The compact PostgreSQL query selects only fields needed for:
- total/PIC/ULL/EASA metrics
- landings
- time calculations
- monthly trend
- routes / aircraft statistics
- track count / GPS distance

Large or dashboard-irrelevant fields such as notes are not transferred.

Dashboard and Map share this compact session-hot dataset where possible.

## Lightweight Dashboard chart

The default 5-second Dashboard view no longer imports/renders Plotly just to show
the primary monthly chart.

It now uses a lightweight HTML/CSS bar chart. Plotly remains available only
inside detailed statistics where its richer interaction is useful.

## Map render budget

Overview map rendering was tightened:

- Quick: up to 32 tracks, 64 points/track, ~2,048 point budget
- Medium: up to 100 tracks, 120 points/track, ~9,600 point budget
- All: adaptive up to ~18,000 points total

Full flight detail/player data is unchanged.

## Session hot-cache

The hot navigation cache TTL is now 300 seconds.

This is safe because durable writes explicitly invalidate:
- flight hot data
- dashboard hot data
- track/map geometry caches
- count caches
- profile-derived datasets where needed

The longer TTL is primarily protection against repeated hosted PostgreSQL
round-trips during normal navigation.

## Automatic schema upgrade

### SQLite fallback
Schema: 10 → 11

Adds the two derived overview columns to `flight_tracks`.

### PostgreSQL
Foundation/schema: 1 → 2

Startup runs an idempotent runtime upgrade:
- `ADD COLUMN IF NOT EXISTS overview_coordinates_json`
- `ADD COLUMN IF NOT EXISTS overview_version`
- performance indexes for user/date and user/flight track access
- app metadata version update

The PostgreSQL runtime schema upgrade executes before the app marks its DB
runtime ready.

No user action and no Secrets change are required.

## Safety

- PostgreSQL remains the only normal source of truth.
- No automatic fallback to SQLite.
- Full GPS remains untouched.
- Overview backfill is derived cache maintenance and does not advance the
  durable flight-data watermark.
- Portable user backup remains supported.
- No destructive migration is performed.
