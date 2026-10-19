# GPS V2 D4.3-R3-0 — Independent contact reference evidence protocol

Date: 2026-10-19
Repository: filipto861/flytally-logbook
Research branch: research/gps-v2-d43-r3-evidence-protocol-20261019
Parent: D4.3-R2-2 research-only, Draft PR #368, checked head ebb50abd.
State: R3-0 DESIGN ONLY. No reference annotations or contact truth created; no runtime/schema/UI/flight-record changes.

## 1. Purpose and evidence boundary

The aim is a trustworthy, versioned reference set for research into GPS Touch & Go classification, including false positives (low pass, go-around, taxi), possible false negatives and insufficient-coverage cases. R2-1 measured source-altitude quality; R2-2 reproduced frozen legacy source-shape decisions. Neither independently observed wheels contacting the runway.

The R3 record must never convert a legacy proposed landing, an altitude minimum, a pilot count, a KML filename suggesting EGM96, or a lack of algorithm candidates into externally confirmed physical contact. Contact/non-contact adjudication is separate from pilot description, separate from GPS matching and separate from evidence provenance.

No new detector or adjusted 25 m/s / 30 m / speed / time rule is authorized. V2 native multi-gx still UNSUPPORTED_SOURCE, experimental flag OFF, Pilot Review HIDDEN, and no production landing/recency updates.

## 2. Distinct objects (do not collapse)

A. Source session: one original private recording with local-only, exact content/revision identity, ordered source-block lineage and optional owner-validated manual flight splits. Track segments are not proof of complete flights.

B. Alleged/observed manoeuvre: independently defined human/source assertion about an event, including a bounded uncertainty interval or TIME_UNAVAILABLE. This can exist with NO GPS proposal and without GPS temporal pairing. One manoeuvre may correspond to several overlapping R2 source windows.

C. Evidence item: independently attributable original media / sensor / witness / pilot statement; provenance, integrity, observable coverage and limitations. The same source repeated in different formats is not independent corroboration.

D. Contact adjudication: separately governed status derived only from evidence that directly observes contact or non-contact; NEVER from GPS shape/reporter belief alone. A pilot report is evidence of what the pilot says, not independent ground truth.

E. Comparison/match: later, research-only relation from reference event to legacy/V2 proposal, possibly NONE, AMBIGUOUS, MULTIPLE_WINDOWS, SOURCE_UNAVAILABLE. It must not upgrade contact status or create extra events.

## 3. Orthogonal statuses — proposed frozen vocabulary for R3-0

Claim source / evidence provenance (many-to-one possible):
- PILOT_ATTESTATION (first-party report; independent of algorithm but not third-party corroboration).
- INDEPENDENT_WITNESS (explicit firsthand direct observation, identity and contemporaneous scope privately recorded).
- CONTINUOUS_VIDEO (unaltered media with verified coverage of the relevant runway/contact region).
- AIRCRAFT_SENSOR (direct contact-indicative discrete signal ONLY with device, configuration, synchronization and integrity verified).
- OPERATIONAL_RECORD (e.g. independent ground-operation log; may corroborate sequence, not automatically touchdown).
- GPS_OR_ADSB / DERIVED_ALGORITHM (contextual only, CANNOT adjudicate physical contact).
- OTHER / UNKNOWN (descriptive only).

Contact adjudication (exactly one at each version):
- UNRESOLVED: default, includes GPS-only, absent, incomplete or ambiguous evidence.
- REPORTED_CONTACT_UNCORROBORATED: explicit human report of contact; not a confirmed landing.
- REPORTED_NONCONTACT_UNCORROBORATED: explicit human report of non-contact; not a confirmed negative.
- CORROBORATED_CONTACT: directly observed, applicable contact evidence with identifiable event and acceptable provenance; requires documented adjudication, not an automatic source-type promotion.
- CORROBORATED_NONCONTACT: sufficiently complete direct observation of the entire relevant contact opportunity demonstrating no contact; absence from a sensor or clip alone is INSUFFICIENT.
- CONFLICTED_UNRESOLVED: contradictory evidence or identity/timing conflict, no winner guessed.

Maneuver claim (non-authoritative and independent from contact):
- ROLLING_TOUCH_AND_GO, STOP_AND_GO, FULL_STOP_LANDING, LOW_PASS, GO_AROUND, TAXI_ONLY, UNKNOWN, OTHER_SPECIFIED.
- An attempted go-around can follow contact; label does not settle contact. A video depicting a runway pass does not by itself prove wheel non-contact.

Event-to-GPS association (separate, never contact status):
- NOT_ATTEMPTED; MATCHED_UNAMBIGUOUS; AMBIGUOUS_MULTIPLE; SOURCE_GAP; SOURCE_UNAVAILABLE; NOT_MATCHED.
- NOT_MATCHED must not be interpreted as no contact. Matching is AFTER independent labeling, never reference creation.

Evidence confidence is NOT inferred from label names. Each contact adjudication must reference exact supporting evidence item IDs, coverage and limitations. There is no DEVICE_CERTIFIED tier, no automatic regulatory/certification authority and no fixed threshold based on count of witnesses or GPS fixes.

## 4. R3 proposed conceptual record (DESIGN; no app/schema implementation)

ReferenceCase:
- protocolRevision: exact revision ID (R3_CONTACT_REFERENCE_DESIGN_V1).
- caseId: opaque owner-local random non-identifying ID, not an aircraft registration.
- sourceContext: privately bound original-source identity; D4/R1/R2 code revisions and manual split revision; exact hash allowed only in owner-private storage, NEVER a GitHub report.
- eventAssertionId: stable owner-local independent event identity; not canonicalFixIndex or R2 window index.
- timing: event interval with uncertainty and OBSERVED or REPORTED basis; absolute UTC private if absolutely required for synchronization, anonymized report has only coarse categorical timing and no absolute time, GPS index or duration sufficient for route reconstruction.
- claim: one maneuver claim and report role, never contact truth.
- evidenceItems: list with unique evidence ID, source type, acquisition provenance, custody/original vs edited, capture time trust, temporal/spatial observability, direct contact or non-contact coverage, independent-of categories, version, conflict flags, consent/restrictions and local secure storage locator; locator MUST NOT be published.
- adjudication: contact status, explicit supporting evidence IDs, named/adjudicator role privately, date/revision and reason; defaults UNRESOLVED. Contradiction => CONFLICTED_UNRESOLVED. No silent overwrite; append versioned decision.
- matching: independent-to-GPS association status, matching algorithm revision, uncertainty and candidate counts; OPTIONAL and cannot modify the adjudication.
- authority: researchOnly=true, actualLandings=UNAVAILABLE for analytics until a separate approved downstream data contract, canAffectCanonicalFlight=false, recencyEvidence=UNAVAILABLE.

Important: a real source can contain multiple claims but identical replayed media or derived KML data must not inflate source independence. Never store real reference evidence with a committed synthetic fixture. No free-text pilot/aircraft names in public diagnostic summaries.

## 5. Adjudication gates / fail closed

1. A claim can be recorded privately with no media, but cannot become CORROBORATED_CONTACT/NONCONTACT without direct contact observability, source integrity and event/time association. Pilot logbook self-report remains REPORTED_CONTACT_UNCORROBORATED, even where operationally meaningful.
2. Contact-negative control requires observation covering the *entire* relevant runway-contact opportunity. A missing radar point, brief clip, clearance or no legacy candidate is not negative reference truth.
3. A camera/sensor signal requires traceable capture source; time synchronization; coverage; aircraft/sensor applicability when relevant; integrity and no hidden source dependency. Inadequate coverage => UNRESOLVED.
4. GPS/ADS-B, ground speed, altitude derivative, legacy proposal, runway proximity, flight plan, ATC clearance and aircraft taxi status alone are not contact proof.
5. Conflicting credible observations => CONFLICTED_UNRESOLVED with preserved competing evidence IDs and reviews; never majority-vote from duplicate derivative artifacts.
6. A valid reference event must be independently annotated BEFORE the reviewer sees algorithm candidates; otherwise mark POSSIBLE_ANNOTATION_LEAKAGE and exclude from unbiased performance analysis.
7. Event-specific source identity, temporal alignment and ownership must be checked privately; ambiguous pairing cannot produce TP/FP/FN.
8. Missing information is UNAVAILABLE/UNRESOLVED, never false, zero, missing touchdown or default negative. The absence of a label is NOT a confirmed non-contact.
9. Corrections create a new append-only reference revision with link to superseded state. Revocation of consent/media availability invalidates dependent adjudications and any metrics.
10. Experimental labels NEVER flow into certified flights, regulatory recency, saved GPS import, or flight-sharing without a separately designed and approved trust boundary.

## 6. Corpus state at R3-0: NO corroborated labels

R2-2 established six original owner-local anonymous sources with 21 historical legacy altitude proposals across sample03..sample08 (1/1/10/0/6/3), 122 overlapping source geometry windows and three in-span discontinuity-rejected windows; sample07 accounts for two rejected windows. These are NOT 21 independently confirmed touchdowns nor three demonstrated missed landings. R2-1 recorded one global height derivative exceedance in sample07; the two rejected windows may overlap; no independent event/time association can be inferred from aggregate counts.

sample07 has an OWNER/PILOT-REPORTED additional rolling maneuver per prior source documentation. For now:
- independent reference event: NOT YET LOCALLY ANNOTATED;
- maneuver claim: PILOT_REPORTED rolling T&G, provenance details to be supplied/verified privately;
- physical contact: REPORTED_CONTACT_UNCORROBORATED at most if the pilot explicitly attests wheel contact, otherwise UNRESOLVED;
- third-party corroboration: NOT PROVIDED;
- trustworthy GPS pairing: NOT ASSESSED;
- any true positive/false negative count: UNAVAILABLE.

Do not pre-create a CORROBORATED_CONTACT row or extract the precise timestamp from a GPS minimum. A statement that sample07 contains two rejected windows is NOT two claimed manoeuvres.

sample03/04/05/06/08: No reference non-contact labels or independent contact-positive labels have been established merely by the R2 diagnostics. Prior legacy 0 in sample06 cannot be used as a negative label.

## 7. Minimum owner-local capture workflow (not implemented)

A. Choose one event *from pilot log, original video or first-hand independent source*, not from R2 candidate indexes.
B. Store original material off-repo with restricted access and capture provenance; record a new anonymous caseId and independent evidence IDs.
C. Privately record the exact claim wording, role, whether wheel contact was directly seen/felt, relative sequencing and stated uncertainty. Pilot statement remains human report.
D. Have a separate evaluator examine qualifying original direct-contact / non-contact evidence without GPS/algorithm output when available; log explicit support/coverage limitations.
E. Assign contact status using the gates above. If no independent evidence, preserve uncorroborated status and stop.
F. Only after labeling, match with original GPS using validated D4 lineage and source/split context, preserving possible many-windows-to-one-event and UNKNOWN.
G. Publish only aggregate counts by category after minimum reporting/privacy review. For rare events, suppress small cells that risk re-identifying a flight; release policy needs owner approval.

## 8. Validation protocol: avoid measuring noise as accuracy

A future benchmark can report precision/recall/sensitivity only from reference positives AND reference negatives which meet independently reviewed observability and event coverage, with explicit denominator/selection criteria, and no dependence on training/tuning targets. Split by originating flight/session (and where needed aircraft/recording source) so repeated fixes/camera views do not leak across training/validation.

Uncorroborated pilot reports are a useful diagnostic queue but do NOT enter a verified-contact confusion matrix. Insufficient observation windows remain UNAVAILABLE, never negative. The six KML are an exploratory corpus, not a representative statistical sample. No preset sample-size target or accuracy percentage is defensible yet.

Freeze any test set before detector tuning; version label decisions and calibrations separately, and report data volume, capture coverage, unresolved labels, independence limitations and possible selection bias.

## 9. Phases, tests and explicit owner decisions

R3-0 DESIGN (this branch): exact evidence source inventory, statuses, privacy/authority, edge cases, owner capture template and phased acceptance. Documentation-only; no R3 labels, storage or runtime implementation.
R3-1 OPTIONAL OWNER-LOCAL CAPTURE: decide where media is stored, who may annotate, retention/deletion, consent rules and whether a local-only form/CLI is preferable. Only after explicit product approval implement a bounded, research-only annotation validator with tests; no DB tables by default.
R3-2 EVIDENCE ACQUISITION / INDEPENDENT ADJUDICATION: collect real owner-private direct evidence; record conflict/coverage and independent verifier limitations; no automatic conversion of GPS source shape to contact truth.
R3-3 VALIDATION READINESS: audit balanced reference positives and negatives, isolation, revision bindings, privacy, scope and benchmark eligibility. No detector tuning until specific review approval.
R3-4 FUTURE IMPLEMENTATION: if adequate evidence exists, separately design/approve detector change, regression set, UI and release gates. No implicit production rollout.

Tests for any future R3-1 validator: no-contact absence fails closed, uncorroborated pilot positive never confirmed, permission/capture-time conflicts, non-contact incomplete video, reused derivative evidence independence, conflicting witness statements, edited media integrity, stale source or split invalidates GPS match but not pilot claim, unknown sensor installation/config, ambiguous many-window matching, old certified flights unchanged, privacy redaction and consent withdrawal cascading invalidation. All NOT RUN because R3 code does not exist.

**Owner decisions not guessed:** evidence storage/retention/consent policy; permitted independent reference source types and adjudicator roles; private material access; whether first capture is paper/template only or a local validator. These decisions precede new code or private evidence collection.

## 10. Status and closing evidence

R3-0 documents authored on a child research branch; no executable code, tests, DB, UI, feature flag, legacy or production files changed. Node/TypeScript/build/browser/CI and six-private-KML R3 execution NOT RUN / N/A, since no R3 implementation. No branch merge, deployment or production release. ROADMAP, FEATURES, CHANGELOG must record R3-0 DESIGN only; next task is owner review of evidence-source and privacy decisions.
