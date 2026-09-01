# Aircraft type catalogue source

FlyTally's bundled aircraft-type catalogue is derived from **Mictronics/aircraft-database**.

- Upstream: https://github.com/Mictronics/aircraft-database
- Source exports: `aircraft_db.zip` and `icao_aircraft_types.zip`
- License: **Open Data Commons Attribution License (ODC-By)**
- Upstream states that exports are updated once per week.
- Imported upstream commit: `6c0da300e67d6f4363322ce740ff7121e5d97d51`
- Imported: 2026-09-01T07:22:43Z

FlyTally uses the catalogue only as an identity/search aid. Manufacturer/model strings are derived from the most frequently observed non-empty description for each ICAO type in the upstream export and remain editable by the pilot.

ICAO aircraft descriptors (for example `L1P`) are **not** Part-FCL aircraft classes. FlyTally may display a non-binding class hint for common landplane combinations, but the pilot must confirm the Part-FCL class separately. No class hint is certification evidence.

Aircraft absent from the catalogue can always be entered manually.
