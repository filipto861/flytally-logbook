# GPS Detection 2.0 — R2.1c-D3 offline advisory DTO

Date: 2026-10-18. Repo: `filipto861/flytally-logbook`.
Branch: `feat/gps-r21-d3-offline-advisory-dto`, from `main@e6fce0b896dba402a03bc5102d75539d4ca4f1de` (D2-B2 research PR #362 merged).
**Status: D3 Batch 1 offline DTO and 13 synthetic tests IMPLEMENTED IN TOPIC BRANCH; exact-HEAD tests/typecheck/release NOT YET RUN. Draft PR only, no merge/deploy.**

## Frozen decisions, technical reality

D1–D5 owner-approved Pilot Review policy: eventual advisory is inline in existing `Review GPS track` only, ephemeral optional notes default `LEAVE_UNRESOLVED`, no vertical or rate proposals without independently validated unit/mode/parser transforms/sensor provenance, no retained notes or separate saved-track review, no auto-count, no certification and no crossing canonical import actions. Feature flag OFF keeps legacy behavior. Pilot-review hypotheses are *never* proof of gear contact, true touchdown, AGL or runway occupancy. Real owner tracks and postflight reads require separate P0-D3 owner/consent/native RLS/strict-no-write acceptance.

D2-B2 `research/gps-detection-r21/csv-lineage.ts` parses a narrowly constrained **in-memory synthetic CSV subset** with explicit sourceLine→normalizedIndex, declared header units, UTC and no silent point drops. It **cannot** authenticate sensor unit/mode/datum, horizontal/vertical accuracy, raw device origin, physical contact, or track completeness. Pilot result is always `UNAVAILABLE`, whole-flight landing count `UNAVAILABLE`. D2-C.1 production CSV and null-vs-zero repair is already merged to main, but no trusted sensor authorization is derived from it.

## D3 Batch 1 — bounded research-only contract

Create only `research/gps-detection-r21/pilot-review-dto.ts`, direct synthetic tests, and docs. No `app/`, `components/`, production `lib/`, DB, RLS, network, flight actions, account/private GPS, package/migrations, or browser flags.

1. A strict `unknown` input boundary consumes **exact synthetic source text** and explicit `uploadRevision`, `splitRevision`, `split` indices, `algorithmRevision` (pinned). Reject extraneous/forged trust flags and malformed state. The source analyzer is D2-B2 itself, not a caller-prepared `status:'VALIDATED'` envelope. Parser revision is explicit and read-only diagnostic.
2. Bind a review to a **cryptographic SHA-256 of exactly that input string**, upload/split revisions, split index range, parser revision and algorithm revision. This fingerprint establishes *local equality only*, not independent provenance or privacy anonymization. Never emit source CSV, coordinates, sample timestamps, pilot ID, registration or user IDs in the DTO.
3. Return a **discriminated fail-closed** offline DTO, only `UNAVAILABLE` states at this stage: malformed inputs `INVALID_CONTEXT`, unsupported/syntactically bad source `SOURCE_UNAVAILABLE`, valid parsed but independent sensor provenance missing `SOURCE_NOT_VERIFIED`, and stale binding `STALE_CONTEXT`. Never emit an `ADVISORY_ONLY` or `AVAILABLE` branch while the actual source gate cannot authorize it. Independent choice `LEAVE_UNRESOLVED` is the *default note policy*, not a confirmation state.
4. D3 note handling allows **no notes or candidates in this batch**, because no source has pilot-display authority. Any forged incoming nonempty note list fails closed. Changing input text, upload revision, split revision/range, parser or algorithm revision invalidates/rejects previous binding, rather than recycling suggestions.
5. Always `canAffectCanonicalFlight=false`, `physicalContact='UNRESOLVED'`, `fullFlightLandingCount='UNAVAILABLE'`, `altitudeCandidates='HIDDEN'`, `horizontalCandidates='HIDDEN'`, `eventTime='UNAVAILABLE'`, `persistentNotes=false`. No numerical pattern/contact count, automatic day/night/start/landing fields or false authorization bit.

## Red-line acceptance (must test on actual new SHA)

- D3-01: exact strict CSV with missing and measured-zero altitude -> parsed diagnostics only, no pilot hints, no source content leak.
- D3-02: forged `validated:true`, extra keys, null, wrong algorithm or invalid split fail closed.
- D3-03: unsupported dialect, duplicate UTC, invalid coords/time fail closed and do not fabricate values.
- D3-04: identical source/session revision yields same local binding; changed source, upload epoch, split revision, split range or algorithm invalidates old session.
- D3-05: forged notes and malformed old review state fail closed without durable effects.
- D3-06: source header `altitudeFt`/declared metre and syntactic lineage never unlock vertical or horizontal hints or landing counts.
- D3-07: output JSON contains none of original coordinates/timestamps/raw content or flight IDs.
- D3-08: no imports into production, no `app/`/`lib/` changes, package build remains compatible.

**Tests status:** NOT RUN on this new batch. Required next: targeted Node+typecheck, `verify:plan -- --base origin/main`, then risk-planned release acceptance (no PostgreSQL or browser unless actually planned). New code is not permission for production UI integration or release. Later D3 Batch 2 may evaluate pure synthetic event presentation *only* after distinct source/trust authority design and owner review; must never convert this fail-closed DTO into automatic contact counts.
