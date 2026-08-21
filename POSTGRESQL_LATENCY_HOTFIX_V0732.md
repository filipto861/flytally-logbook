# v0.73.2 – Map & Database Latency Hotfix

## Production evidence

v0.73.1 runtime telemetry showed:

- SQL p50: ~145 ms
- SQL p95: ~488 ms
- pool checkout p95: 0 ms
- Map render: ~1.3–1.5 s
- Database render: ~0.8 s
- SELECT track_points: ~723 ms

The pool was not the bottleneck. Network round-trips and one expensive GPS
window query were.

## Map hot path

### Before
The GPS overview selected candidate points from `track_points` using:
- `ROW_NUMBER() OVER (PARTITION BY track_id ...)`
- `COUNT(*) OVER (...)`
- modulo sampling
- sort by track/sequence

This was appropriate for local SQLite but expensive across hosted PostgreSQL.

### v0.73.2
The overview now:
1. reads lightweight track metadata;
2. selects the bounded set of track IDs according to the existing render plan;
3. fetches only `id, coordinates_json` from those `flight_tracks` rows;
4. performs the existing geometry-preserving simplification locally in Python;
5. caches the selected geometry payloads.

The canonical stored GPS data is unchanged. `track_points` remains available for
track detail, data quality and future analytical operations, but it is no longer
in the overview-map hot path.

## Database → Aircraft

### Before
Opening the Aircraft section could require independent PostgreSQL reads for:
- aircraft
- rates
- aircraft usage aggregation
- airport registry count
- common header counts

### v0.73.2
PostgreSQL loads aircraft profiles, rate history and flight-usage aggregation in
one denormalized SQL result and splits the small result locally.

The exact airport total requires reading tenant airport overrides from
PostgreSQL. That read is now deferred until the user actually selects the
Airport section.

Shared header counts continue to use the session-hot count cache introduced in
v0.73.1.

## Cache invalidation

The new geometry and aircraft-bundle caches are invalidated by the same durable
write scopes as their underlying data:
- track / track_points changes
- flight changes
- aircraft changes
- rate changes

## Compatibility

- no database migration
- PostgreSQL schema remains 1
- SQLite schema remains 10
- no Secrets change
- no change to stored track fidelity
- SQLite emergency fallback remains supported

## Validation

The release regression suite includes dedicated assertions that:
- overview map no longer calls `read_sampled_track_points`
- overview geometry query does not reference `track_points`
- aircraft Database section uses one bundle reader
- PostgreSQL bundle contains one application SQL query
- airport count is deferred outside the Airport section
- new caches are correctly invalidated
