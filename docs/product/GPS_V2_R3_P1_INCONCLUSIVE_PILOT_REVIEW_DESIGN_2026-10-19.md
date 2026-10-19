# GPS V2 R3-P1 — Pilot review of inconclusive altitude source evidence: implementation design

Date: 2026-10-19
Repository: filipto861/flytally-logbook, NOT flytally-training
Branch: design/gps-v2-r3-pilot-review-inconclusive-20261019
Base: R3-0B research branch at 66181735618047d1416522db7c6e0d66fb6ea7e3, stacked Draft PR #369.
Status: DISCOVERY / DESIGN / ROADMAP ONLY. NO runtime implementation approval implied by a Draft PR.
Owner direction: prepare a small, fail-closed pilot-review capability for GPS evidence that cannot justify an automatic touchdown event.

## 1. Source-of-truth reconstruction — actual code verified on the R3 design base

| Exact path | Current behavior / invariants |
| --- | --- |
| components/kml-import-form.tsx | Existing single-form GPS import. `inspect(source,name)` retains exact owner-local source text and parsed canonical `points`; `cuts` explicitly define manual/suggested split; `parts` recompute on cut changes. `reviewFor(part)` currently sets starts/takeoffs from `landingCount(part)`, a LEGACY provisional T&G-derived suggestion. Pilot can manually change total and Day/Night split. `resetParts` changes splits/reviews; upload clears old analysis. |
| components/kml-import-form.tsx (GPS REVIEW) | `Review GPS track` disclosure contains `GpsImportReviewPlayer` with `importReviewEvents` based on LEGACY `touchAndGoEvents` and flight envelope; V2 experimental panel condition `GPS_V2_ADVISORY_ENABLED && v2Advisory`. The visual track may be overview/downsampled, while legacy markers derive from canonical full array; do not assume identical per-fix indexing when adding markers. |
| components/gps-import-review-player.tsx | Existing playback, SVG altitude/speed profile and button marker strip; existing `ImportReviewEvent` kinds are takeoff, landing, touch-and-go, split. Do not reuse the contact-seeming touch-and-go marker kind/color for unknown source quality; do not imply two adjacent rejected windows are two events. |
| lib/gps-v2-advisory.ts | `GPS_V2_HORIZONTAL_V3` returns horizontal only DEPARTURE/ARRIVAL/STOP_GO_REVIEW_POINT with `physicalContact=UNRESOLVED`, `wholeFlightLandings=UNAVAILABLE`, `canAffectCanonicalFlight=false`; no vertical T&G detector or count authority. `inspectGpsV2HorizontalTrack` checks source-to-canonical equality and explicit validated split. |
| lib/gps-v2-import-lineage.ts | Strict formats: CSV subset / supported SkyDemon CSV, narrow single-trkseg GPX, **exactly one gx:Track KML**. Native V2 multi-gx:Track returns UNAVAILABLE/UNSUPPORTED_SOURCE. This includes sample07; it must remain so after P1. Do NOT claim source compatibility just because R2-2 research can parse the original privately. |
| research/gps-detection-r21/stage-d43-r2-2-legacy-shape-audit.ts | R2-2 read-only Node research inspection of local-minimum/30m anchors, speed gate, intermediate climb and 25m/s in-span derivative reference. Its current output is ANONYMOUS AGGREGATE ONLY and uses node:crypto, so it is **not a browser-safe per-event view model** or a UI dependency. |
| app/(protected)/flights/actions.ts | `importKmlFlight` re-parses source server-side and requires reviewed, explicit landing total/day-night counts, split/role/crew/aircraft evidence; stores canonical flight+track within existing transactional write. No R3 form fields, flight count edits or server acceptance changes authorized. |
| app/v142-gps-import.css | Existing V2 panel and responsive styles; preserve brand tokens, dark/night legibility and iPad UX. |
| tests/gps-v2-ui-contract.test.ts; tests/gps-v2-import-lineage.test.ts | Existing build-default-OFF/no-form-authority checks and specific multi-gx V2 rejection test V2-F7. These are frozen regressions to preserve. |
| docs/product/GPS_V2_D43_R3_0B_SAMPLE07_SOURCE_REJECTION_DIAGNOSIS_2026-10-19.md | In owner-private replay, sample07 has two overlapping frozen-legacy rejected shape windows due to ONE common recorded 15m/0.52s (~28.85m/s) source-height step. Pilot says one T&G occurred around a private minute; REPORTED_CONTACT_UNCORROBORATED, not independent landing truth. Counterfactual one extra grouping suggestion is NOT a safe detector change. |

### Critical product-truth collision

**Legacy landingCount prepopulates landings already.** This creates an existing suggestive data path independently of V2. The proposed P1 feature must neither alter legacy counts nor suggest that a quality warning authorizes a new landing. A warning cannot silently increment starts, takeoffs, Day/Night fields, save notes, PF movements, recency or certification. If the user manually edits existing reviewed flight totals, that remains a separately explicit pilot action governed by existing validators.

**Source eligibility is separate per domain:** research-only multi-gx source *diagnostic* support can exist ONLY as a newly reviewed, explicitly scoped sidecar without changing current production V2 `UNSUPPORTED_SOURCE`. A V2 candidate card must NOT appear for multi-gx input. The user must not mistake a source-quality annotation for a contact hypothesis.

## 2. Alternatives and decision

A. Generic static warning for any file: smallest, but does not identify a qualifying uncertain source pattern. It risks alert fatigue and does not address sample07 causal evidence. **Not a sufficient final feature.**

B. Directly import R2-2 research Node inspector into Next client and show its rejected windows as T&Gs: browser-incompatible (node:crypto), crosses source authority boundary, double counts overlapping windows, and insinuates contact. **REJECT.**

C. **RECOMMENDED: separate, staged bounded read-only source-quality sidecar, then opted-in pilot review card**:
  - Sub-milestone P1A: implement a browser-safe, pure and tightly limited DIAGNOSTIC DTO, with an independent exact original-source/canonical index + gx-block/split provenance contract and parity to frozen legacy rejection. Fail closed on unsupported/unverified source or stale inputs. No UI yet; test local six source corpus privacy-bounded.
  - Sub-milestone P1B: only after P1A proven, consume the bounded DTO in existing `Review GPS track` under explicit opt-in OFF by default. A source-quality card may mark an **inconclusive area for manual inspection**; no T&G emission or count/submit changes. Native V2 candidate availability stays separately UNAVAILABLE on multi-gx sources, even where the explicitly isolated source-quality inspector is supported.
  - P1C is NOT in scope: expanding native V2 multi-gx source acceptance, production contact recognition, automatic count correction or release.

This is one product direction with two independently verifiable implementation batches, not an excuse to infer unsupported timestamps/contacts.

## 3. Exact proposed P1A data contract (DRAFT, not implemented)

The sidecar consumes **exact original upload text + caller-verified canonical points + validated explicit cuts + version/revision binding**; the implementation must internally reconstruct and strictly validate source-to-canonical equivalence rather than trust arbitrary supplied arrays. Do not bridge separate gx blocks or manually split flights. Frozen legacy predicate comparison and source-quality provenance remain first-class and independently revisioned; input change invalidates results.

Possible outputs:
- `UNAVAILABLE(reason)`: source unsupported/malformed, duplicate/collision/conflict ambiguous, source-canonical/split mismatch, revision stale or proof absent; no markers.
- `QUALITY_REVIEW_ONLY`: zero or more **quality contexts**, NOT proposed landings. Each context has an owner-local per-session identity, one or more overlapping legacy source-window references, **bounded relative canonical range** and a reason (e.g. `ALTITUDE_STEP_INSIDE_LEGACY_EVIDENCE_SPAN`) with explicit observed-edge dependencies. The exact ranges may exist only in volatile, client-local state for map/profile seek. No raw positions/times/heights, private digest or flight ID in reports, telemetry, URL, logs or persisted records.
- `NO_QUALIFYING_DIAGNOSTIC` (within the verified, supported evidence scope), never `NO_TOUCHDOWN`. The output does not attest altitude measurement accuracy or identify runway contact.
- Every state fixes `physicalContact=UNRESOLVED`, `actualLandings=UNAVAILABLE`, `canAffectCanonicalFlight=false`.

A *single common bad altitude edge* referenced by multiple rejected minima must yield ONE grouped quality-review context, not one 'possible T&G' per minimum. Every context must include its original frozen legacy reason and source-quality applicability, not a new free-form heuristic score. Do not reuse the historical <8-fix candidate grouping as proof of an event; for quality contexts, coalescing must be explicit by **shared causal invalid edge** and verified source partition, not distance in seconds or arbitrary runway assumptions.

No context is allowed to claim a missing/confirmed touchdown, or that the absence of a qualifying context means no unrecognized T&G. A context spanning a D4 source boundary, manual cut, altitude conflict, invalid/collided UTC, or unsupported continuity cannot be displayed as a traceable continuous manoeuvre. Fail closed to bounded `UNAVAILABLE`/source-quality warning, not a connected marker.

### Browser compatibility and isolation

Current R2-2 module imports node:crypto and returns only counts. P1A must extract only pure, read-only browser-safe logic with native targeted parity/negative tests, rather than importing research module into `components` or `lib` or duplicating legacy semantics without an explicit parity assertion. Any source hashing/binding remains outside the browser display DTO; a local component state identity and source/cuts algorithm revision equality can invalidate client caches without printing a digest. Existing client `Analysis` already owns source text and cuts. Treat stale source, different file, changed split, algorithm revision or local browser navigation as invalidation; no stale badge from prior analysis.

The research sidecar must remain independent of V2 native input support; do not relax `lib/gps-v2-import-lineage.ts` or `lib/gps-v2-advisory.ts` as an implementation shortcut.

## 4. P1B minimal UX contract (AFTER P1A evidence)

Place one discreet card inside existing `details.gps-track-review`, adjacent to the V2 experiment, reusing current spacing, typography and warning patterns. Suggested wording:

**GPS altitude needs pilot review**
**A recorded altitude jump prevents a reliable automatic interpretation in this part of the track. Review the graph and enter the correct landing total yourself.**
**Status: Unresolved · GPS cannot confirm runway contact.**

One local 'Inspect on profile' action may seek the existing player to a source-backed observation region if precise index parity is proven and any track downsampling handled correctly. Otherwise no seek control. Explicit 'Reviewed' acknowledgement, if later approved, would be *ephemeral only* and invalidated on source/cut change, not a basis to add a touchdown. No new Save button, automatic 'Add T&G', 'Accept suggested contact', hidden input, form submission field or persisted event decision.

The preview must **not** use amber event markers labeled T&G or display a speculative GPS touchdown time. Prefer existing `track-time-warning` and secondary link language; no fake confidence percentage. OFF behavior remains byte/DOM contract equivalent to current legacy import. Unsupported V2 states still state `UNAVAILABLE / UNSUPPORTED_SOURCE`; the independent quality card, if implemented, MUST clearly identify itself as a separate diagnostic and cannot imply native V2 compatibility.

### Interactivity, form state and lifecycle

On file replacement/upload, split edits, source rev changes, source parser mismatch, recomputation unavailable: clear quality-review contexts and any reviewed acknowledgement synchronously. Manual flight total/day-night values follow current explicit user input rules, not sidecar results. UI must not hijack the existing native `onSubmit` or `useUnsavedFormGuard` flow. Duplicate-submit protection stays existing PendingActionButton.

If quality sidecar cannot associate a source window, show only an honest generic *manual inspection* message or no card; never invent a point, time, surface, title 'missed landing', or automatic count. UI review of original sample07 is **conditional** on separately established source-quality diagnostic input provenance; until then multi-gx is still V2 unsupported.

## 5. Dependencies and risk gates

- P1A 0: exact branch/source inventory and R2 frozen reference parity confirmation; explicit source format/effectivity decision. Limit first instrumented diagnostic to **known gx:Track KML dialect with exact D4.1 provenance and R2 quality parity**, not generic GPX/CSV despite V2 separate support. Unknown/mixed source => UNAVAILABLE.
- P1A 1: fail-closed browser-safe sidecar + dedicated tests, isolated from production `landingCount`, V2 algorithm and saved flight models.
- P1A 2: original six KML owner-local comparative reports, anonymized only; sample07 one quality context from two source windows ONLY if index/edge/reason parity independently verified and genuinely inside a single source partition. R2-2 counts alone are insufficient.
- P1B 0: explicit owner acceptance of P1A and final UI copy/action; feature flag opt-in design (default OFF, no silent build enablement).
- P1B 1: one existing-review card + optional correct source-local seek; add CSS only in existing GPS stylesheet and use design tokens. No new top-level navigation.
- P1B 2: targeted unit/source contracts, full regression selected by release planner, typecheck/build, desktop/iPad landscape/portrait/mobile dark/light browser review, V2 ON/OFF tests, exact verified DB/saved-flight parity if submission paths touched; production smoke only after explicit deploy authorization.

R3 pilot-report contact evidence **does not unlock detector positives**, no precision/recall claims, no new sensor calibration. Independent direct contact/non-contact truth (R3 reference tier) remains a separate evidence stream.

## 6. Acceptance and regression tests — prospective, NOT RUN

1. `sample07` source: owner-private R2-2 two rejected windows share one exact source edge, same validated flight partition -> one **quality review** context, no T&G count.
2. `sample04` distinct rejected context not silently dropped; all six sources retain exact legacy emission counts 1/1/10/0/6/3 and original R2-2 aggregate parity. Sources with no reason never synthesize a marker.
3. Multi-gx V2 remains `UNAVAILABLE / UNSUPPORTED_SOURCE` even if P1A diagnostic has an explicitly independent quality observation. No V2 event or airport/touchdown inferred from it.
4. Two overlapping windows with DIFFERENT bad edges are not spuriously merged; one event claim cannot be deduced from any clustering.
5. D4 inter-block join, dedup conflict, time collision, stale source/cuts, source parser revision and malformed/missing data => fail closed or UNKNOWN, no connected timestamp/position.
6. 16s, 35.35s, 94.39s and 491.57s intervals show **unobserved intervening motion**, never 'quality passed' because historical >25m/s guard skipped them.
7. Low pass, go-around, taxi, final landing, sawtooth and false altitude step fixture controls do not produce contact labels, extra starts, regulatory evidence or new auto suggestions.
8. New UI source/cut change removes previously shown contexts/acknowledgements; unsupported source no bogus clickable marker.
9. No extra `name`-bearing input or FormData mutation, no import action changes; exact legacy `landingCount` review defaults and separately manual overrides remain unchanged when flag ON/OFF.
10. Visual markers are not double-counted or mislabeled; profile seek position matches actual canonical point after overview reduction; otherwise seek disabled.
11. Every response and public CLI excludes coordinates, altitude, UTC, filenames/registration, source digest and precise indexes; local DOM may use bounded relative region only after source parity.
12. UI keyboard accessible, focus visible, labels clear and tested at desktop / iPad portrait+landscape / mobile, dark/night and light; loading/empty/invalid states consistent.
13. Actual V2 UI contract `GPS_V2_ADVISORY_ENABLED` remains exact opt-in default OFF; `tests/gps-v2-ui-contract.test.ts` and `tests/gps-v2-import-lineage.test.ts` V2-F7 stay PASS.
14. Full required risk-planner regression and browser verification evidence before any production enablement; local Node PASS must never be claimed CI PASS.

## 7. Scope exclusions, rollout and owner review

DO: present uncertainty as uncertainty, keep source provenance and one shared-edge grouping, allow ordinary *separate manual input* in already-existing flight review, track research data privately, and preserve legacy runtime.
DO NOT: new Touch & Go detector, global filter relaxation, automatic landing count, implicit prefill from quality context, source V2 acceptance expansion, unverified 'wheel contact' label, GPS location telemetry, certified logbook editing, schema migration or deployment.

R3-P1 DESIGN milestone acceptance: exact current UI/source/action/test inspection + source-supported plan + frozen safe DTO/UX contract + acceptance matrix + ROADMAP/FEATURES/CHANGELOG updated. This is not P1A or P1B implementation completion.

Owner decision before code: confirm P1A narrowed to source-quality diagnostics for proven gx:Track KML only and P1B opt-in review panel, with multi-gx V2 still strictly unsupported. New aviation-sensitive source compatibility and browser computation architecture deserves independent read-only second-AI review after design and BEFORE P1A implementation; reviewer cannot override actual repo or owner scope. Previous expedited R2 research waiver does not itself authorize this new source/UI boundary.

Verification for this docs-only design: typecheck/Node/build/Playwright/DB/CI NOT RUN/N/A; no code, legacy feature flag, main or production changed. No merge or deploy.
