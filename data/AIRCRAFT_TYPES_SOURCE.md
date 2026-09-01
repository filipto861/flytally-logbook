# FlyTally aircraft type catalogue

FlyTally bundles a normalized aircraft-type catalogue derived from the public **whatisflying-db** aircraft type database.

- Upstream: https://github.com/laegsgaardTroels/whatisflying-db
- Source file: `data/aircraft_types.csv`
- Upstream commit imported: `e168f2a591bcddeabd6c9830e0fcd482a050b13f`
- Database license: **Open Data Commons Open Database License (ODbL)**
- A copy of the upstream database license is stored at `data/licenses/WHATSFLYING_ODBL.txt`.

This derived aircraft catalogue is distributed under the same ODbL terms. Attribution applies to the catalogue/database data; it does not change the license of FlyTally application code.

FlyTally uses the catalogue only as an identity/search aid. ICAO descriptors such as `L1P` are not Part-FCL aircraft classes. A catalogue entry may expose a non-binding class hint (for example `L1P → SEP`) to reduce typing, but the pilot must separately confirm the actual Part-FCL class. The hint is never certification evidence.

Aircraft missing from the catalogue are always supported through manual entry. User-entered Make, Model and ICAO values remain editable even after a catalogue choice.
