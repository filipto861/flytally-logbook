# v2.0-B — Category-specific flight entry

This stage keeps one Add/Edit flight workflow while making category-specific evidence and terminology explicit.

## UX contract

- Aeroplane and Helicopter retain Part-FCL PF movement evidence and SP/MP + SE/ME controls.
- ULL retains the existing standard controls without gaining EASA movement semantics.
- SPL TMG retains standard time/take-off controls while staying outside FCL.060 PF evidence.
- Non-TMG Sailplane focuses on launch method, launches and landings; generic SP/MP + SE/ME selectors are hidden from normal entry.
- Balloon focuses on BFCL free/tethered operation and explicit take-off/landing evidence; generic SP/MP + SE/ME selectors are hidden from normal entry.
- Hidden legacy technical values are preserved on edit for backward compatibility; this stage does not rewrite historical records.
- Professional operation context remains available only for explicitly supported EASA Aeroplane/Helicopter contexts.

## Safety

No schema changes, no certification changes, no category inference beyond the v2.0-A contract, and no privilege calculation changes. Existing authoritative recency engines remain unchanged.
