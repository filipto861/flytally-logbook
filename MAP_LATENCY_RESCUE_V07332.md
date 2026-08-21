# v0.73.3.2 – Map Latency Rescue

Production metrics after v0.73.3.1 showed Map average ~1.9 s, with synchronous `UPDATE flight_tracks MANY` ~849 ms and repeated `SELECT flight_tracks` queries.

Changes:
- remove lazy overview backfill from interactive Map path
- run one-time derived overview backfill server-side at startup
- collapse selected GPS map metadata + overview geometry into one PostgreSQL query
- defer full GPS track table metadata until explicitly requested
- retain full GPS fidelity and existing PostgreSQL/SQLite schema versions
