# Independent Review Handoff — Flight Entry Workflow 3.0 / F3 Aircraft Context

> **Status:** REQUESTED · read-only architecture/data-integrity review before F3 runtime authority changes.  
> **Repository baseline:** main@663b1af89ae320059039efada82cfeb349c7032f.  
> **F2 status:** DONE / PRODUCTION VERIFIED.

## Reviewer role

Act as an independent reviewer. Challenge the proposed F3 design against current repository behavior, data integrity, historical snapshot compatibility and the Manual/GPS convergence goal. Do not implement code.

Primary docs:
- ROADMAP.md
- FEATURES.md
- CHANGELOG.md
- ARCHITECTURE.md
- docs/product/FLIGHT_ENTRY_WORKFLOW_3_0.md
- docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F0_FIELD_CONSUMER_MATRIX.md
- docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F1_DESIGN.md
- docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F3_AIRCRAFT_CONTEXT_DESIGN.md

Primary runtime:
- lib/aircraft-profile-context.ts
- lib/aircraft-profile-validation.ts
- lib/flight-form-rules.ts
- lib/data/aircraft.ts
- components/flight-form.tsx
- components/kml-import-form.tsx
- lib/flight-input.ts
- lib/gps-import-integrity.ts
- app/(protected)/flights/actions.ts
- lib/db-optimization.ts

Primary tests:
- tests/flight-form-rules.test.ts
- tests/v335-aircraft-profile-validation.test.ts
- tests/v310-flight-entry-f00-characterization.test.ts
- tests/v311-flight-entry-f01-gps-integrity.test.ts
- tests/integration/postgres-aircraft-profile-validation.test.ts
- tests/integration/postgres-flight-identity-snapshot.test.ts
- tests/v349-flight-entry-f30-aircraft-context-characterization.test.ts

## Current verified baseline

F2 closed with:
- RoleCrew Save/UI contract;
- Safety Pilot server-authoritative Actual PIC;
- explicit verification account binding;
- compatibility freeze for overlapping crew evidence;
- certification v1-v8 unchanged;
- GPS still PIC-only.

F2 runtime/test closeout:
- PR #223 merged as bc187e307958054efa2e32db316b06139d10df6e;
- Verify #1095 PASS: TypeScript, 1077/1077 unit/regression, PostgreSQL 66/66;
- Browser #469 PASS: production build, Chromium 36 passed / 2 skipped;
- production dpl_GFWksQDdFMoSr9qyvQYgiCBd2ShJ READY on exact runtime SHA;
- docs closeout PR #224;
- current main before F3.0: 663b1af89ae320059039efada82cfeb349c7032f.

## F3 confirmed findings

### 1. Profile validator is canonical and fail-closed

validateAircraftProfile() already handles:
- ULL / EASA;
- EASA make/model requirement;
- class/category compatibility;
- TMG AEROPLANE or SAILPLANE;
- OTHER AEROPLANE / SAILPLANE / OTHER;
- Balloon class/group;
- explicit Part-FCL credit provenance.

resolveFlightEntryAircraftProfileDefaults() refuses malformed profile defaults instead of repairing them.

### 2. Manual aircraft context is currently client-defaulted

FlightForm resolves the selected aircraft profile and pre-fills aircraft context, but createFlight()/updateFlight() only parse submitted FormData. They do not re-query and validate the active aircraft profile.

A crafted Manual request can submit any otherwise-valid logbook/class/category combination for the chosen registration.

### 3. Manual invalid-profile state is not authoritative

The UI can show Needs configuration and expand Aircraft & logbook, but profileNeedsConfiguration is not itself in the Save blocker array and the server actions do not reject an invalid selected profile.

### 4. GPS is already server-authoritative

GPS:
- queries active owned aircraft;
- validates profile;
- rejects malformed/unavailable profiles;
- rejects submitted class/logbook drift;
- persists server-resolved context.

### 5. Historical Edit must remain independent of mutable current profile

Current shouldApplyAircraftProfileDefaults() already distinguishes:
- same-registration Edit => keep stored context;
- New / registration change => apply current profile.

Migration-v17 identity tests prove:
- same-registration update preserves historical identity;
- actual registration change snapshots new profile identity;
- explicit historical shared identity survives recipient profile differences.

### 6. Existing Manual contract permits explicit valid flight-level context

The F0 field/consumer matrix describes evidence/class as profile default or explicit valid flight-level values. F3 acceptance also says legitimate explicit flight context must remain available.

## Proposed authority model

Server derives base authority:

- CREATE => PROFILE
- UPDATE same registration => SNAPSHOT
- UPDATE changed registration => PROFILE
- client can request OVERRIDE but cannot claim PROFILE or SNAPSHOT authority

PROFILE:
- active owned aircraft required;
- profile must validate;
- submitted unexplained drift rejected;
- profile owns aircraft type/identity.

SNAPSHOT:
- stored flight context is authoritative;
- current profile does not refresh it.

OVERRIDE:
- explicit user action only;
- submitted context validated;
- does not mutate aircraft profile;
- New/registration-change still requires valid target profile identity;
- same-registration draft/correction may explicitly change stored context without current-profile equality.

No new database column is proposed in the first pass. Stored flight context remains the historical result.

## Draft UX

Valid profile:
- compact Aircraft context summary;
- profile schema controls hidden from normal entry.

Invalid profile:
- Needs configuration;
- Save blocked;
- route to Aircraft workspace.

Historical Edit:
- compact Stored flight context summary;
- do not claim current profile provenance.

Flight-specific fields remain visible where applicable:
- SP/MP;
- SE/ME;
- TMG regulatory context;
- balloon FREE/TETHERED;
- sailplane launch evidence.

## Review questions

Please answer explicitly.

1. Is PROFILE / SNAPSHOT / explicit OVERRIDE the correct authority split?
2. Should PROFILE/SNAPSHOT drift be rejected, rather than silently rewritten to authority?
3. Should Manual New and registration-change require a valid active profile before any explicit override is allowed?
4. Should same-registration Edit remain fully independent of the mutable current profile, including when that profile is inactive/invalid?
5. Override breadth:
   - A: only multi-context regulatory-category override (TMG/OTHER);
   - B: explicit full regulatory override preserving current valid flight-level evidence/class/category flexibility;
   - C: no override except historical correction.
   Which should F3 freeze?
6. If B is accepted, should balloon class/group participate in explicit override only when the selected override context is Balloon?
7. Should aircraft type remain profile/snapshot-owned and never be a free flight-level override for a selected aircraft?
8. For TMG, should Regulatory context stay visible as a normal flight-level decision even when the profile has a default?
9. For OTHER, should category be equally explicit, or only exposed through the general override affordance?
10. Should GPS gain a common explicit context override in F3 so Manual/GPS converge now, or remain profile-only until F4?
11. Is a transient override flag sufficient, with persisted context values as historical truth, or does override provenance require a schema field?
12. Does the proposed invalid-profile rule conflict with any legitimate historical/new-entry workflow?
13. Are there hidden consumers that require profile equality or override provenance beyond the persisted flight fields?
14. Is the proposed milestone split F3.0–F3.5 appropriately scoped?

## Constraints

Do not propose:
- repairing invalid profile to ULL;
- refreshing same-registration historical identity/context from current profile;
- rewriting certified rows;
- changing certification v1-v8;
- inferring context from aircraft type name;
- broadening GPS RoleCrew beyond PIC in F3;
- a second flight model.

## Requested response

1. Verdict: APPROVE / APPROVE WITH CHANGES / BLOCK.
2. Blocking findings.
3. Authority-model verdict.
4. Override-scope recommendation.
5. Manual New/Edit recommendation.
6. GPS timing recommendation.
7. TMG/OTHER recommendation.
8. Schema/provenance recommendation.
9. Missing consumers/tests.
10. Exact implementation order.
11. Any item Filip must decide before runtime work.
