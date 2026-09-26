# FlyTally v1.58.0 — Flight Entry Polish & Smart Defaults

## Objective

Reduce visual noise in New flight and make FlyTally's existing safe defaults easier to understand. The release removes a v1.57 experiment that proved unnecessary in real use, keeps only the useful local-flight helper, and moves required-field guidance closer to the field that needs attention.

## UX decisions

1. **Quick Routes removed** — recent-route buttons duplicated information already easy to type and added a full visual row to the most important form. The recent-route database query remains available elsewhere but is no longer executed by New flight.
2. **Local flight retained, but demoted** — a local flight is still common enough to justify one click. It now appears only as a small contextual action below Arrival after Departure is known.
3. **Smart defaults are transparent** — FlyTally already derives aircraft type, normal logbook, class, billing/rate and initial role from the selected aircraft profile where safe. The form now explains that behavior rather than adding more automatic guesses.
4. **Required guidance is local** — Registration, Role, Logbook, Class and Billing already had required semantics. Missing-state guidance now appears directly at those controls as well as in Review. No new field became mandatory.
5. **Airport typing is mobile-safe** — Departure and Arrival disable autocorrect and spellcheck so iOS/Android keyboards do not rewrite ICAO/location identifiers.

## Smart-default boundary

FlyTally may prefill values owned by the aircraft profile or obvious mechanical defaults. It must not infer flight-specific or regulatory facts merely for convenience. In particular, v1.58 does not newly infer pilot role, PF evidence, instructor/supervisor identity, countersignature evidence, movement counts or Part-FCL qualification/class from unrelated data.

## Deliberately unchanged

- `parseFlightInput()` and stored flight semantics;
- FCL.050/FCL.060, LAPL and FCL.740.A calculations;
- eligible ULL credit rules;
- movement/PF evidence and countersignature rules;
- certification fingerprints, revisions and signatures;
- aircraft-state integrity introduced in v1.53.1;
- GPS import/evidence, sharing, print/export and backup/restore.

## Verification contract

Release requires TypeScript, the full regression suite, PostgreSQL acceptance, Next.js production build, a clean Vercel preview, squash merge, production CI, production deployment smoke and runtime error/fatal audit.
