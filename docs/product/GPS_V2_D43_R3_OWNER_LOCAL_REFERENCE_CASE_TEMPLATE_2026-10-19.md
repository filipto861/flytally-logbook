# GPS V2 D4.3-R3 — Owner-local reference event worksheet (TEMPLATE ONLY)

Date of template: 2026-10-19
Protocol: GPS_V2_D43_R3_CONTACT_REFERENCE_DESIGN_V1
Authority: PRIVATE RESEARCH ONLY; no automatic landing count, flight rewrite or recency.
Status: BLANK TEMPLATE, NOT AN ACTUAL EVENT OR AN APPROVED FORM.

DO NOT fill personal details in the GitHub copy, public PR, chat transcript or shared diagnostic output. Make an owner-private copy stored outside the repository. Never attach a raw source track, video or original flight identifiers to a public pull request.

## A. Anonymous record identity

Case ID (new opaque non-identifying random reference): TO_BE_ASSIGNED_PRIVATELY
Claim exists independently of GPS candidate: YES / NO / UNKNOWN
Private source-session token (NOT published): LOCAL_ONLY / UNAVAILABLE
Known source continuity/split status: REVIEW_REQUIRED
Event's source: PILOT_REPORT / FIRST_HAND_WITNESS / CONTINUOUS_VIDEO / APPLICABLE_SENSOR / OPERATIONAL_RECORD / OTHER
Original evidence storage/custodian: PRIVATE_ONLY; do not put a path here
Permission and retention terms: OWNER_DECISION_REQUIRED

## B. Original claim BEFORE showing GPS proposals

Who originally stated or directly observed the event (role only): UNKNOWN
What was stated (verbatim retained PRIVATE, this form stores only a category): NOT_PROVIDED
Claimed manoeuvre:
    ROLLING_TOUCH_AND_GO / STOP_AND_GO / FULL_STOP_LANDING /
    LOW_PASS / GO_AROUND / TAXI_ONLY / UNKNOWN / OTHER_SPECIFIED
Explicit claimed wheel contact:
    YES / NO / NOT_STATED
Temporal location / sequence:
    PRIVATELY_BOUNDED / UNAVAILABLE
Reported time precision:
    DIRECT_CLOCK / APPROXIMATE / SEQUENCE_ONLY / UNKNOWN
Capture independent of seeing FlyTally candidates:
    YES / NO / UNKNOWN

## C. Evidence ledger (one entry PER genuinely distinct original source)

Evidence ID (opaque, private): TO_BE_ASSIGNED
Evidence type: PILOT_ATTESTATION / INDEPENDENT_WITNESS / CONTINUOUS_VIDEO / AIRCRAFT_SENSOR / OPERATIONAL_RECORD / GPS_OR_ADSB / DERIVED_ALGORITHM / OTHER
Directly demonstrates:
    WHEEL_CONTACT / COMPLETE_NONCONTACT / CONTEXT_ONLY / AMBIGUOUS
Coverage of entire relevant contact opportunity:
    COMPLETE / PARTIAL / UNKNOWN / NOT_APPLICABLE
Original integrity and capture traceability:
    ORIGINAL_TRACEABLE / DERIVED_OR_EDITED / UNKNOWN
Clock synchronization support:
    INDEPENDENTLY_VERIFIED / APPROXIMATE / UNKNOWN / NOT_APPLICABLE
Does evidence share the same underlying original observation as another evidence ID?
    YES / NO / UNKNOWN
Aircraft/device model, configuration and applicability verified when relevant:
    YES / NO / NOT_APPLICABLE / UNKNOWN
Access, consent and retention restrictions: OWNER_DECISION_REQUIRED
Limitations / contradictory evidence: REVIEW_REQUIRED
Private source locator/identity: DO NOT PUBLISH

Repeat Section C for each original source. Copies, crops and derived algorithm labels are not independent witnesses.

## D. Adjudication (separate from claim; defaults fail closed)

Research contact status:
    UNRESOLVED [DEFAULT]
    REPORTED_CONTACT_UNCORROBORATED
    REPORTED_NONCONTACT_UNCORROBORATED
    CORROBORATED_CONTACT
    CORROBORATED_NONCONTACT
    CONFLICTED_UNRESOLVED
Reason for status (evidence IDs, coverage/limitations): NO_EVIDENCE_YET
Independent evaluator role/review status: NOT_ASSESSED
Exact reference revision and superseded decisions: NOT_ASSIGNED
Could the event be mislabeled because annotator saw GPS candidates?
    UNKNOWN / POSSIBLE / DOCUMENTED_NO
Eligible for independent detector performance metrics:
    NO [DEFAULT; future separately reviewed eligibility]

This form does NOT confer approval/certification or change logbook landing counts.

## E. GPS comparison — ONLY AFTER independent annotation

GPS source and split revision parity: NOT_ASSESSED
Original source-to-canonical lineage: NOT_ASSESSED
R2-1 source-quality dependence: NOT_ASSESSED
R2-2 shape windows proposed / rejected: NOT_ASSESSED
Matching status:
    NOT_ATTEMPTED [DEFAULT] / MATCHED_UNAMBIGUOUS /
    AMBIGUOUS_MULTIPLE / SOURCE_GAP / SOURCE_UNAVAILABLE / NOT_MATCHED
Number of related source windows: UNAVAILABLE
Data association reason and uncertainty: NOT_ASSESSED
Important: Multiple geometry windows can match one event; no windows may match a real contact. No contact status upgrade is allowed from matching.

## F. Privacy-safe share summary example (categories only; NOT a real event)

case: LOCAL_PRIVATE_RECORD_EXISTS / NOT_CREATED
claimEvidence: PILOT_REPORT_ONLY / MULTISOURCE_PENDING / NONE
adjudication: UNRESOLVED / REPORTED_ONLY / CORROBORATED / CONFLICTED
gpsAssociation: NOT_ATTEMPTED / UNAVAILABLE / REQUIRES_REVIEW
regulatoryUse: PROHIBITED
canAffectCanonicalFlight: false
actualLandings: UNAVAILABLE
recencyEvidence: UNAVAILABLE

The summary deliberately excludes personal/aircraft identity, GPS position, timestamps, sensor readings, source fingerprints, storage links and per-fix indexes.

## G. One targeted evidence request for sample07 (NOT PRE-FILLED AS GROUND TRUTH)

The previous owner statement describes an additional rolling manoeuvre missing from historical detector output. R2-2 produced two rejected ALTITUDE SOURCE WINDOWS for sample07; these do NOT prove an extra aircraft movement or the cause of a missed landing.

First collect, entirely privately:
- Was the manoeuvre a touchdown with wheels physically contacting the runway, or a low approach/go-around?
- Is there an independent full-context video, directly observing witness, or applicable discrete aircraft sensor trace?
- Is the evidence independently associated with the reported manoeuvre without using an R2 altitude minimum as its timestamp?

Until direct corroboration exists, status remains pilot-reported/unresolved rather than CORROBORATED_CONTACT. Do not tune the detector to force a positive.

## H. Review and closeout gates

The owner must decide data custody/retention/permission, authorized evaluator roles, allowed source types and whether research needs a private local validator. This template is not an instruction to upload real identities or sensitive tracks to GitHub or ChatGPT.

Draft case completion is NOT independent contact verification; report every still-missing fact as UNKNOWN/UNAVAILABLE. Any future analytics must use only independently supported positives and negatives, separated by flight and original evidence origin.
