# FlyTally v1.57.0 — Flight Entry Workflow Simplification

## Objective

Make normal manual flight entry understandable without requiring the pilot to know FlyTally's internal data model. The release is workflow-focused: reduce repeated typing, surface useful feedback earlier, and ensure a required choice is never hidden inside a collapsed section.

## UX audit findings

1. **Route repetition** — frequently flown routes still required retyping both airports even though FlyTally already maintains recent-route statistics.
2. **Local flights** — a departure-equals-arrival flight required typing the same airport twice.
3. **Duration feedback** — BLOCK and AIR were calculated, but the useful result was only obvious lower down in review/cost UI.
4. **Progressive-disclosure edge case** — Logbook or Cost sections could be collapsed while containing a required choice.
5. **Review feedback** — the review badge reported only a count of missing fields instead of naming the fields.
6. **Mobile source choice** — Manual/GPS source cards consumed disproportionate vertical space before the pilot reached the flight itself.

## Changes

- Reuse the existing `getRecentRoutes()` query in New flight and expose up to four frequent/recent route shortcuts.
- Add an explicit **Local · DEP → DEP** shortcut. FlyTally does not silently assume a local flight; the pilot chooses it.
- Show live **BLOCK** and **AIR** durations immediately below the four timeline fields.
- Open Logbook details when EASA, missing logbook/class, or a countersignature requirement makes the section relevant.
- Open Cost & notes when the required billing basis is missing.
- Auto-open is one-way assistance: completing the field does not unexpectedly close the section; the pilot remains in control of the disclosure.
- Name the exact missing required fields in Review before save.
- Keep Manual entry / GPS import source selection compact on narrow screens while retaining both entry modes.
- Update the progress wording so it reflects the actual one-page workflow and inline review.

## Deliberately unchanged

- `parseFlightInput()` and all stored flight-field semantics.
- FCL.050/FCL.060, LAPL, FCL.740.A and eligible ULL-credit behavior.
- EASA structured movement evidence, PF interpretation and countersignature rules.
- Aircraft registration/profile authority and v1.53.1 stale-state protection.
- Certification fingerprints, record revisions, signatures and shared-flight ownership.
- GPS evidence/import semantics, print/export and backup/restore.

## Validation contract

Before production merge the release must pass:

- TypeScript;
- the complete TypeScript regression suite, including the v1.51 regulatory safety net;
- PostgreSQL acceptance;
- Next.js production build;
- a clean Vercel preview after temporary tooling is removed;
- production GitHub CI after squash merge;
- production deployment smoke and runtime error/fatal audit.

## Release record

Production-facing changes are also recorded in `CHANGELOG.md`. This document preserves the reasoning and UX boundary for later refactors so future releases can improve presentation without accidentally changing flight semantics.