# GPS Detection 2.0 — Stage D pilot-labeled research protocol

**2026-10-18. Status: DESIGN / READ-ONLY RESEARCH; no new database read authorized, no production changes, no algorithm acceptance.**
Repo: flytally-logbook. Topic: PR #364. Excludes flytally-training.

## Verified repository constraints

- Canonical legacy detector: `lib/track-processing.ts`, `touchAndGoEvents()` plus `landingCount() = 1 + touchAndGoEvents().length` (advisory suggestion, not independent touchdown truth).
- Current V2 `lib/gps-v2-advisory.ts`: `GPS_V2_HORIZONTAL_V3` only horizontal departure/arrival/stop-go hypotheses. It cannot infer wheel contact, altitude datum, regulatory movement count, or aircraft-specific performance envelopes.
- `docs/product/GPS_DETECTION_2_0_R21_D3_OFFLINE_DTO_2026-10-18.md` freezes `horizontalCandidates=HIDDEN` in production until independently validated sensor/source provenance and owner decision. PR #364 experimental flag-gated UI conflicts with broad pilot-visible approval. DO NOT turn it on in production pending explicit policy reconciliation.
- Existing postflight/private saved GPS review requires separate P0-D3 owner/consent/native RLS/strict-no-write acceptance. Do not query records using broad DB service credentials or assume existing storage means permission for a new analysis path.
- `docs/product/GPS_TOUCH_AND_GO_RELIABILITY.md` and `3_5_1_GPS_TOUCH_AND_GO_RELIABILITY.md` freeze historical false-positive guardrails; do not change 28/145 km/h, 30 m or 25 m/s thresholds merely to fit two flights.

## Owner-confirmed real-track truth, with classification and timing uncertainty

| Local private file | Actual T&G | Actual full stops | Other labeled negative | Legacy hypotheses | V2 STOP_GO | Evaluation |
| --- | ---: | ---: | --- | --- | ---: | --- |
| 121002.kml | 2 | 1 | low pass ~15:55 UTC (= +00:30:05 relative) | +00:51:51 (~16:16:46 UTC); +00:56:50 (~16:21:45 UTC), both owner-confirmed minute-level correspondence | 0 | Legacy 2 matched positives; V2 two missed review proposals; low pass not called T&G. Two V2 ARRIVAL suggestions (+00:22:37, +00:24:22) are unresolved/not verified. |
| 121001.kml | 1 | 1 | unknown | +00:30:25 (~14:44:45 UTC), known false proposal; +01:01:35 (~15:15:55 UTC), matches owner-confirmed ~15:15 UTC (+01:00:40) at minute-level | 0 | Legacy 1 matched positive /1 false positive; V2 missed T&G review suggestion. |

No file is a certified instrument record. Actual events are pilot-reported approximate time labels; do not interpret as second-exact position contact. Legacy 3 matched T&G hypotheses and 1 confirmed false hypothesis among these two files, **not an unbiased global accuracy metric**. Other files: three Lksz tracks V2 ADVISORY_ONLY with no horizontal suggestions; alternate OK-EUI15 KML `UNSUPPORTED_SOURCE`. No physical-contact truth available for these. No original route, absolute file date, coordinates, registration, user ID or full GPS content belongs in repo.

## Proposed low-risk source acquisition order

**Track A — existing local exports:** owner executes exact-HEAD read-only comparator on a batch; output only (anonymous local sample number, point count, parser status, relative event offsets/types, source conflict count), no raw route. File-type unsupported remains unavailable; first classify KML tags/segments with aggregate counts before expanding parser.

**Track B — saved tracks in the owner's app:** owner manually opens *their own* existing Flight detail/replay in FlyTally. Pilot reviews the route and records truth in a private local worksheet. No automation, DB read, new endpoint, account tokens, screenshots containing sensitive coordinates, RLS bypass, or writes to saved flight, until a separate security-reviewed P0-D3 owner/consent/strict-read-only retrieval contract is implemented. Existing flight view is not authorization for a new bulk GPS extraction feature.

Suggested private worksheet columns: anonymous sample reference; input format; recorded track duration; observed T&G count; observed full-stop count; observed low passes; observed rejected/ambiguous periods; each event's **relative elapsed time ± uncertainty**, event class (T&G, FULL_STOP, LOW_PASS, OTHER, UNKNOWN), observed/pilot-confirmed source and certainty, legacy relative proposals, V2 relative proposals. Do not convert unknown to zero, and do not make sheet public without owner's explicit decision. Store no names, registrations or geography in GitHub.

## Analysis milestones and gates

D1. **Create labeled sample matrix:** target at least the two currently labeled flights plus additional known positive and negative controls across source variants. Owner confirms event counts/times; current 3 T&G + 1 low pass are initial data only. A false legacy suggestion cannot be classified as low pass without owner confirmation. Mark unmatched hypotheses as false proposal only if complete pilot count/timing permits.

D2. **Read-only diagnostics:** compare exact time-synchronized legacy and V2 outputs. Measure candidate matching with declared ±time tolerance and uncertainty envelope (not arbitrary post hoc window); report matched positives, false proposals, missed ground-truth events separately for landing, full-stop, low-pass, and unavailable source. Extract feature behavior around an event using redacted statistics only: sampling time gaps, horizontal speed regimes, altitude quality/discontinuity flags, source duplicate collisions, split membership. Never expose exact geo or absolute timestamps.

D3. **Design alternatives:** (A) preserve conservative horizontal V2 and accept intentional low recall; (B) add explicitly NON-COUNTED possible rolling-T&G review using source-backed vertical shape + fail-closed quality and applicability gates, after resolving D3 prohibition; (C) improve legacy false-positive filters only, avoid add-event automatic inference. No proposed thresholds are approved here. Document false-positive/false-negative trade-offs, provenance limits, and fallback/unavailable behavior.

D4. **Independent DeepSeek read-only design review:** send only redacted corpus matrix, frozen decisions, algorithm boundaries and proposed synthetic test contract; ask about duplicate timestamps, event locality, false-low-pass behavior, source applicability, privacy/RLS and operational data integrity. Reviewer is not aviation authority.

D5. **Only after owner approval:** frozen design → synthetic before/after regressions, targeted GPS corpus, complete unit suite, TypeScript, exact-HEAD ON/OFF risk release builds/browser where selected, updated ROADMAP/FEATURES/CHANGELOG. Maintain default-OFF until D3 policy, source trust and pilot preview acceptance are resolved.

## Acceptance / non-goals

- No existing logbook movement fields, certification or regulatory recency updated by GPS research; contact `UNRESOLVED`, totals `UNAVAILABLE` in V2.
- Support untrusted/partial/unknown source as `UNAVAILABLE` without treating it as zero movement.
- No private database bulk read before explicit secure owner/RLS path approval.
- No merge, deploy, migration or PR promotion in this research milestone.
- Success means reproducible, pilot-labeled *diagnostic* evidence and reviewed design—not declaring GPS touchdown detection reliable after two flights.
