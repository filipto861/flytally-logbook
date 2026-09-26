# v2.0-A — Category foundation

This stage starts the FlyTally 2.0 multi-category work without changing the regulatory meaning of existing records.

## Goal

Create one canonical category/capability contract shared by aircraft profiles, flight entry and later v2.0 work. The contract describes how a stored regulatory category should be presented and which evidence model belongs to it. It does **not** infer privileges, rewrite certified records or convert evidence between regulatory systems.

## Canonical categories

- `AEROPLANE` — Part-FCL aeroplane context
- `ULL` — existing ULL context
- `SAILPLANE` — Part-SFCL / SPL context
- `HELICOPTER` — Part-FCL helicopter context
- `BALLOON` — Part-BFCL / BPL context
- `OTHER` — conservative fallback with no regulatory assumptions

## Evidence capabilities

The foundation explicitly keeps these evidence models separate:

- Aeroplane / Helicopter EASA: `FCL060_PF`
- non-TMG Sailplane: `SFCL_LAUNCH`
- SPL TMG: `SFCL_TMG`
- Balloon: `BFCL_TAKEOFF_LANDING`
- ULL / Other: no EASA movement evidence assumption

A capability is a routing/presentation description only. Regulatory credit remains in the existing authoritative recency and certification engines.

## Compatibility rules

- A historical TMG without explicit regulatory category remains `AEROPLANE`.
- A TMG with an explicit `SAILPLANE` snapshot stays in the SPL / Part-SFCL context.
- Non-TMG gliders remain `SAILPLANE` and keep launch evidence.
- Helicopter recency remains type-specific.
- Balloon take-offs/landings remain BFCL evidence and must never be treated as FCL.060 PF triples.
- ULL must never gain EASA movement semantics through category inference.
- `OTHER` stays conservative.

## This stage deliberately does not

- add a new database schema,
- change certification fingerprints,
- change stored flight categories,
- infer licences, ratings, privileges or operation type,
- change existing Aeroplane/ULL flight credit,
- replace the existing SPL, Helicopter or BPL recency engines,
- introduce separate Add flight pages per category.

## v2.0 follow-up stages

1. **v2.0-B — Category-specific flight entry**: consume the capability contract across Add/Edit flight and progressive disclosure.
2. **v2.0-C — Multi-category logbook UX**: category-aware Flights, filters, Dashboard/Statistics and detail presentation.
3. **v2.0-D — Print / Export / Pilot profile**: coherent multi-category totals, outputs and credentials.
4. **v2.0-RC — Migration / regression / hardening**: historical accounts, certified evidence, sharing, backup/restore, mobile and scale gates.
