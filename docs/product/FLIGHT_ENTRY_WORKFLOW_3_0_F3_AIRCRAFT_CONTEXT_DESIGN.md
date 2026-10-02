# Flight Entry Workflow 3.0 — F3 Aircraft Context Simplification

**Status:** F3 DONE / PRODUCTION INTEGRATED · F4 NEXT  
**Repository baseline after F3.2:** main@abc66ae13cfc8a3af7f6ee21f19ab5c8ab63bc73  
**Scope:** aircraft-context authority, explicit override semantics, compact Manual/GPS presentation, historical snapshot protection. No runtime/schema/certification change in F3.0.

## 1. Goal

F3 stops presenting aircraft-profile schema as an ordinary flight-entry task while preserving explicit legitimate per-flight context and historical evidence.

Target:
- valid active profile supplies the normal flight context;
- ordinary entry shows compact evidence-bearing context instead of editable profile schema;
- invalid active profile fails closed as **Needs configuration**;
- explicit per-flight context changes are deliberate and visibly different from profile defaults;
- TMG and other multi-context cases remain explicit;
- editing an existing flight does not silently refresh its stored historical context from a mutable current profile;
- GPS and Manual converge on one aircraft-context authority model before F4.

## 2. Current repository evidence

### Canonical profile validation already exists

validateAircraftProfile() owns ULL/EASA normalization, EASA make/model requirements, class/category compatibility, TMG Aeroplane/Sailplane contexts, OTHER Aeroplane/Sailplane/Other contexts, Part-BFCL class/group applicability, and Part-FCL credit provenance.

resolveFlightEntryAircraftProfileDefaults() fails closed instead of repairing malformed profiles to ULL.

### Manual New/Edit is client-defaulted, not server profile-authoritative

FlightForm resolves the selected profile in the browser and pre-populates evidence, aircraftClass, regulatoryCategory, balloon class/group and aircraft type.

createFlight() and updateFlight() then call parseFlightInput(form) directly. They do not re-resolve the selected active aircraft profile and do not distinguish:
- profile-derived values;
- stored historical snapshot values;
- an intentional flight-level override.

A crafted Manual request can therefore submit any context accepted by the generic parser for the selected registration.

### Invalid Manual profile is visible but not an action-level Save blocker

The client computes profileNeedsConfiguration, opens Aircraft & logbook, and shows Needs configuration.

But:
- the completion blocker list does not include profileNeedsConfiguration;
- Manual actions do not revalidate the selected aircraft profile.

### GPS already has stronger authority

GPS import:
1. re-queries the active owned aircraft on the server;
2. validates the profile;
3. rejects malformed/unavailable profiles;
4. checks submitted logbook/class against canonical profile values;
5. persists server-resolved context.

F3 should converge Manual toward this authority boundary, not weaken GPS.

### Historical Edit already has the right distinction

shouldApplyAircraftProfileDefaults() is false for Edit + same registration, true for New, and true when Edit changes registration.

The database identity snapshot contract matches this:
- same-registration edits keep historical identity;
- actual registration changes snapshot the new aircraft identity;
- explicit shared historical identity survives a conflicting mutable current profile.

F3 should formalize this on the server.

## 3. Authority model — frozen after independent review

F3 distinguishes authority from presentation. The server derives authority; the client never claims PROFILE/SNAPSHOT authority and there is no generic client-sent `OVERRIDE` authority flag.

### PROFILE authority

Applies to:
- Manual New;
- Manual Edit when the final submitted registration differs from the stored registration;
- GPS import.

Manual requirements:
- an owned aircraft profile must exist;
- the profile must validate canonically;
- malformed/unavailable profile => **Needs configuration** / Save unavailable;
- submitted aircraft context must be a member of `allowedFlightContexts(profile)`;
- unexplained drift is rejected rather than silently rewritten;
- aircraft type/identity is profile-owned.

An inactive but owned/valid profile may remain usable for explicit historical Manual back-fill. Whether an inactive aircraft is normally shown in the picker is a presentation concern, not the server authority rule.

GPS keeps its existing active-owned-profile selection requirement. F3 converges semantic authority, not every source-specific selectability rule.

### SNAPSHOT authority

Applies to Manual Edit when the normalized final registration equals the normalized stored registration.

Requirements:
- stored flight context remains authoritative even if the current profile changed, was deactivated, or became invalid;
- no silent profile refresh;
- if all aircraft-context fields are unchanged, they pass through without re-validating the historical values against today's validator;
- unrelated edits therefore cannot be blocked solely because a historical row would fail a newer validator;
- an explicit context correction validates only the changed/corrected context;
- registration comparison is canonicalized at least for case and surrounding whitespace and is based on stored registration versus final submitted registration.

### Allowed multi-context selection (A+)

The broad full-regulatory override proposal is superseded.

The shared pure function `allowedFlightContexts(profile)` defines the complete set of legitimate flight contexts a valid profile may produce. Normal profiles usually yield one context. Genuine multi-context profiles may yield multiple explicit choices.

Frozen scope:
- evidence stays profile-owned;
- aircraft class stays profile-owned;
- TMG regulatory context remains an explicit per-flight choice where the profile legitimately supports Part-FCL Aeroplane versus Part-SFCL Sailplane context;
- OTHER category remains explicit through the same multi-context mechanism;
- Balloon class/group remain profile-owned;
- Balloon FREE/TETHERED remains flight-specific;
- aircraft identity/type is never a free flight-level context choice.

Same-registration historical correction is a separate SNAPSHOT correction path and is not authority granted by a client flag.

## 4. Shared server contract — frozen

Use one shared aircraft-context contract, not a second flight model.

Core concepts:
- `FlightAircraftContext`: evidence, aircraftClass, regulatoryCategory, balloonClass, balloonGroup, aircraftType;
- authority kind: PROFILE or SNAPSHOT, derived server-side;
- `allowedFlightContexts(profile)`: pure source of truth for valid PROFILE contexts;
- explicit SNAPSHOT correction detection for editable historical rows.

Server behavior:
- Create => PROFILE.
- Update with normalized stored registration == normalized final registration => SNAPSHOT.
- Update with changed final registration => PROFILE.
- GPS => PROFILE using its existing active-owned-profile selection rule.
- PROFILE submissions outside `allowedFlightContexts(profile)` fail closed.
- SNAPSHOT unchanged context is preserved byte/semantic-equivalently and is not refreshed from the current profile.
- SNAPSHOT changed context is treated as an explicit correction and validated deliberately.
- no silent drift repair, inferred neighboring values, or ULL fallback.

Scope of drift enforcement is aircraft regulatory/identity context only. Flight-level fields such as SP/MP, SE/ME, billing/rates/share defaults and other source-specific flight facts keep their existing contracts unless another milestone changes them explicitly.

## 5. Identity / type handling

F3 keeps the existing database historical identity snapshot contract.

PROFILE:
- aircraftType is profile-owned/server-checked;
- make/model/variant remain owned by the existing snapshot trigger.

SNAPSHOT:
- stored aircraft_type, make/model/variant and regulatory fields stay historical.

OVERRIDE:
- regulatory/logbook context may change explicitly;
- aircraft identity is not a free-text override.

No identity backfill.

## 6. UI target

### Valid profile

Default Manual presentation becomes compact, for example:

**Aircraft context**  
EASA · Aeroplane · SEP · OK-BID  
Profile default

Do not present Logbook/Class/Profile schema as routine editable controls.

Flight-specific fields stay explicit:
- Operation SP/MP;
- Engine SE/ME;
- balloon FREE/TETHERED;
- sailplane launch evidence;
- Role/Crew;
- route/times.

### Invalid active profile

Show:

**Needs configuration**  
This aircraft profile cannot supply a valid logbook context.

Save is blocked. Link to the Aircraft workspace. Do not manufacture replacement values.

### Historical Edit

Show:

**Stored flight context**  
EASA · Aeroplane · SEP  
Preserved from this flight

Do not label it as current-profile data.

### Multi-context choice / historical correction

Do not expose a generic full-context override.

For a valid PROFILE with more than one member of `allowedFlightContexts(profile)`:
- show only the legitimate contextual decision (TMG regulatory context / OTHER category);
- make the selection explicit and visibly flight-specific;
- reset deterministically to the profile-supported default/selection state.

For same-registration Edit:
- unchanged stored context remains a read-only historical summary;
- a deliberate correction action may expose only the fields that the correction contract actually allows;
- correction never refreshes identity from the current profile.

## 7. Multi-context cases

### TMG

TMG supports Aeroplane · Part-FCL and Sailplane · SPL / Part-SFCL. F3 must not guess one from aircraft type alone.

Draft: keep a visible per-flight Regulatory context choice for TMG, with profile value as initial selection.

### OTHER

Current validator allows EASA OTHER with AEROPLANE, SAILPLANE or OTHER. This also remains explicit.

### Balloon

Balloon class/group are profile context. FREE/TETHERED remains flight-specific BFCL evidence.

## 8. Independent-review reconciliation — frozen

Independent review verdict: **APPROVE WITH CHANGES**.

Accepted:
- broad Option B is not frozen;
- F3 uses **A+**: profile-owned evidence/class with explicit choices only for genuine multi-context profile semantics plus explicit historical SNAPSHOT correction;
- server computes the allowed-context set; no generic client authority flag;
- PROFILE drift is rejected, never silently rewritten;
- unchanged SNAPSHOT context is not revalidated against today's stricter validator;
- same-registration Edit remains independent of a mutable/inactive/invalid current profile;
- aircraft identity/type remains profile/snapshot-owned;
- read-only production census is required before runtime enforcement;
- shared-flight materialization and recipient historical identity paths are outside Manual PROFILE equality enforcement.

Reconciled differences from the reviewer:
- Manual server authority requires **owned + valid**, not necessarily active, so explicit historical back-fill on a retired aircraft is not structurally prohibited. Picker behavior may remain active-first.
- GPS keeps its existing active-profile workflow but receives the same narrow TMG/OTHER common context decision in F3. F4 still owns Role/Crew inheritance and per-part overrides.
- no new provenance schema field is introduced. Persisted flight context remains historical truth; existing audit history should be reused for corrections if it already covers those writes.

Superseded draft decisions remain documented above for traceability but do not control implementation.

## 9. Revised milestones

### F3.0 — discovery / characterization / independent review — DONE
- current Manual/GPS authority divergence characterized;
- historical SNAPSHOT behavior frozen;
- independent review completed and reconciled;
- no runtime/schema change.

### F3.1 — read-only production census + final enforcement gate — DONE
Evidence: `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F31_PRODUCTION_CENSUS.md`.

Production census found:
- 25 aircraft profiles, all active, **0 invalid** under current validator-equivalent checks;
- 289 flights, all with a current matching owned profile by normalized registration;
- 73 apparent category divergences are all certified legacy rows with blank stored `regulatory_category`;
- exactly one evidence/class divergence exists: a certified historical ULL snapshot against a profile now EASA/SEP; the profile update timestamp is later than the flight date;
- 0 explicit nonblank category mismatches;
- 7 historical identity differences against mutable current profiles, reinforcing SNAPSHOT ownership;
- no current TMG/OTHER/Balloon flight/profile population and no populated Part-FCL credit provenance.

No production evidence requires reopening A+. No migration or bulk repair is required. The census was read-only and changed no runtime/schema/certification data.

### F3.2 — pure shared authority resolver — DONE / PRODUCTION VERIFIED
- added `lib/flight-aircraft-context-authority.ts` with pure `allowedFlightContexts(profile)`;
- validates the complete profile authority input, including Part-FCL credit provenance, before producing any allowed context;
- standard profiles produce exactly one context; TMG produces only AEROPLANE/SAILPLANE and OTHER only AEROPLANE/SAILPLANE/OTHER, with current profile category first;
- evidence/class, Balloon class/group and aircraft type remain profile-owned dimensions;
- added raw SNAPSHOT normalization/comparison that deliberately preserves legacy blank `regulatory_category` instead of deriving today's value;
- added PROFILE/SNAPSHOT authority derivation from operation type + stored registration versus final normalized submitted registration, including the A→B→A final-state case;
- added exact allowed-context membership checks and explicit SNAPSHOT change classification;
- F3.2 remains deliberately **unwired** from Manual/GPS mutations; F3.3 owns persistence enforcement.

Verification:
- PR #229 merged as `abc66ae13cfc8a3af7f6ee21f19ab5c8ab63bc73`;
- Verify FlyTally web #1097 PASS: TypeScript, full unit/regression gate and PostgreSQL acceptance PASS; PostgreSQL **66/66**;
- Browser smoke #470 PASS: production build + Chromium browser suite;
- Vercel production `dpl_7vwVVvE98UZVYJ6upCB9CQnfok4a` READY on the exact merge SHA, aliases `fly-tally.com`, alias error null;
- DB migration/schema change: N/A.

### F3.3 — server enforcement + GPS authority convergence — DONE / LOCAL VERIFIED
Implementation branch: `feat/flight-entry-f33-aircraft-authority`.

Implemented:
- Manual New and registration-change saves re-resolve the owned aircraft profile server-side, validate complete profile provenance and require exact membership in `allowedFlightContexts(profile)`;
- Manual PROFILE persistence writes the canonical server-authorized context, not raw request aircraft-context values;
- same-registration Edit derives SNAPSHOT authority from stored versus final normalized registration and persists the stored historical context without current-profile validation;
- legacy blank stored `regulatory_category` remains blank when the current UI only presented the derived category and all other stored context fields are unchanged;
- unexplained PROFILE or SNAPSHOT drift fails closed; deliberate same-registration historical correction remains a separate F3.4/F3.5 path rather than an implicit override;
- shared-flight materialization/recipient historical identity remains outside the Manual PROFILE equality gate;
- GPS keeps active-owned-profile selection, uses the shared PROFILE authority resolver and exposes one common whole-session TMG/OTHER context choice when the allowed set has multiple members;
- GPS Role remains PIC-only until F4;
- Part-FCL credit provenance is carried through the entry authority boundary and malformed provenance fails closed.

Local verification:
- final head `065896d3c9aa75fee8c2c0c7cc7a2f6abc20e52a`: full unit/regression **1102/1102 PASS**;
- runtime-identical head `3644a85d6da5e01a96c6869b9537c114d395e299`: TypeScript PASS, PostgreSQL core **66/66 PASS**, production build PASS;
- final-head delta after that runtime verification is test-only: one stale F1.3 source-contract assertion was aligned with canonical PROFILE authority persistence;
- Windows PostgreSQL acceptance portability was repaired by explicit `-d`, UTF-8 stdin SQL and CRLF normalization; local PostgreSQL remained localhost-only;
- CI/PR/deploy intentionally NOT RUN yet;
- DB migration/schema change: N/A; certification v1–v8 unchanged.

### F3.4 — compact context UX — DONE / LOCAL VERIFIED
Implementation branch: `feat/flight-entry-f34-aircraft-context-ux`.

Staged implementation:
- valid Manual PROFILE => compact **Profile context** summary + hidden profile-owned evidence/class/type/Balloon fields;
- same-registration Edit => compact **Stored flight context** summary + hidden stored SNAPSHOT fields; current mutable profile is not used for the submitted aircraft context;
- legacy blank stored `regulatory_category` remains blank on submission and the copy explicitly avoids claiming a backfill;
- invalid PROFILE => **Needs configuration** completion blocker with Aircraft configuration opened separately so the current draft remains intact;
- Manual and GPS expose a regulatory-context selector only when the shared resolver returns multiple legitimate contexts; this covers TMG and OTHER without a generic evidence/class override;
- GPS Common details replaces disabled duplicate profile schema controls with the same compact profile summary;
- Operation/Engine and Balloon FREE/TETHERED remain flight-specific, as do sailplane launch evidence and Role/Crew;
- focused regression/source-contract coverage added in `tests/v353-flight-entry-f34-aircraft-context-ux.test.ts`;
- older B3/B5/F3 characterization tests were reconciled only where F3.4 intentionally supersedes their presentation assumptions.

Verification:
- final local head `e305f3ef3985d371a385a0e7231ec42d8a6d135e`;
- TypeScript PASS;
- full unit/regression **1110/1110 PASS**, 0 fail, 0 skipped;
- production build PASS;
- disposable localhost browser DB bootstrap PASS on PostgreSQL 16;
- targeted authenticated Chromium **5/5 PASS** covering Manual/GPS compact context, invalid PROFILE, TMG A+ choice, GPS-save SNAPSHOT reopen, and the existing responsive desktop/iPad landscape/iPad portrait/mobile × light/dark matrix;
- no database migration/schema change;
- certification v1–v8 unchanged;
- CI/PR/deploy not run yet;
- F3.3 server authority remains the fail-closed persistence boundary.

## 9.5 F3.4 local verification evidence

- Manual PROFILE and same-registration SNAPSHOT presentation both use the shared F3 authority concepts without exposing generic evidence/class/type override controls.
- Manual and GPS multi-context selection is bounded to the resolver-provided TMG/OTHER regulatory-category set.
- Invalid PROFILE is visible, blocks completion, and routes to Aircraft configuration without replacing the in-progress entry page.
- Compact summaries preserve profile-owned aircraft type, include Balloon profile detail where applicable, and de-duplicate repeated labels.
- Browser fixture carries the existing Part-FCL provenance columns and an explicit TMG case; this is test infrastructure only.
- Full final-head unit/regression gate: **1110/1110 PASS**, 0 fail, 0 skipped.
- TypeScript: PASS.
- Production build: PASS.
- Disposable localhost browser bootstrap: PASS.
- Targeted authenticated Chromium: **5/5 PASS**, including responsive light/dark context-card coverage.
- Database migration/schema change: N/A.
- Certification v1–v8: unchanged.
- CI, PR, merge and production deployment: NOT RUN / not claimed.
- Next roadmap step: **F3.5 action/persistence/browser/production closeout**.

### F3.5 — action/persistence/browser/production closeout — DONE / LOCAL VERIFIED

Independent review reconciliation:
- second-AI verdict: **APPROVE WITH CHANGES**; no confirmed runtime correctness defect;
- real mutation-boundary proof is required for crafted PROFILE/SNAPSHOT/A+ drift, final registration normalization, unchanged historical SNAPSHOT under inactive/invalid current profiles, submit-time PROFILE re-resolution, Quick Add → immediate Save, TMG/OTHER and Balloon ownership;
- browser proof is limited to same-registration historical Edit and Quick Add → immediate Save because F3.4 already covered the responsive compact-context matrix;
- source audit supersedes the draft request for new generic consumer tests: export/statistics use stored `flights` context, trash restores raw stored context, print uses stored F3 context and only joins current Aircraft for ICAO presentation code; existing certification/shared/backup/restore/recency suites remain authoritative;
- profile-read→flight-write locking/versioning is non-blocking for this phase; submit-time server re-resolution is the accepted authority point;
- deliberate same-registration historical correction remains a separate explicit future path and is not required for unchanged SNAPSHOT safety;
- no runtime/schema change is planned unless a test proves an actual defect.

Closeout matrix:
Cover at minimum:
- crafted FormData drift for each authority mode;
- registration normalization including A→B→A UI round-trip with final server comparison against stored registration;
- same-registration Edit with inactive/invalid current profile;
- legacy unchanged SNAPSHOT that fails today's validator;
- profile-changed-between-render-and-submit race;
- Quick Add followed by immediate Save;
- TMG/OTHER common Manual/GPS context;
- Balloon class/group profile ownership and FREE/TETHERED flight specificity;
- certification v1–v8 invariance;
- historical identity/shared materialization invariance;
- exact backup/restore, trash/restore, export/print/statistics/recency characterization where affected;
- desktop/iPad/mobile, light/dark browser acceptance;
- required ROADMAP / FEATURES / CHANGELOG closeout and production evidence.

F3.5 result:
- no application-runtime defect was found and no F3.5 runtime change was required;
- action/browser persistence proves unchanged SNAPSHOT survives inactive/invalid current profile state and legacy blank stored category remains blank;
- crafted SNAPSHOT, PROFILE and A+ drift fail closed at the real mutation boundary;
- authority follows the final normalized registration, including the A→B→A UI round-trip;
- PROFILE is re-resolved at submit time, so a profile changed after render cannot silently persist stale context;
- Quick Add creates a canonical profile that is immediately available for Manual PROFILE Save;
- TMG/OTHER choices remain bounded to allowed contexts and Balloon class/group stay profile-owned while FREE/TETHERED remains flight-specific;
- downstream source audit confirms export/statistics/trash/print do not refresh F3 authority from mutable profile state;
- certification v1–v8, shared materialization, backup/restore and recency invariance remain covered by existing regression suites;
- the microscopic profile-read→flight-write race and explicit historical-context correction path remain documented non-blocking follow-ups rather than F3 defects.

Local evidence:
- full unit/regression: **1119/1119 PASS**, 0 fail, 0 skipped;
- disposable browser DB bootstrap: PASS;
- targeted authenticated Chromium F3.5 suite: **4/4 PASS**;
- PostgreSQL core: **66/66 PASS** on the runtime-identical F3.5 head;
- TypeScript: PASS on the runtime-identical F3.5 head;
- production build: PASS on the runtime-identical F3.5 head;
- final F3.5 changes after those runtime gates were limited to tests/browser fixtures/docs;
- DB migration/schema: N/A;
- certification v1–v8: unchanged;
- CI/PR: intentionally NOT RUN; direct fast-forward integration was used after explicit approval.
- Production integration: `main@a4b1c626d487aad86ef3e2de887df50a0a2b9248`, runtime tree identical to the locally verified F3 closeout tree.
- Vercel: `dpl_Dn3PAymjG7aCds9xsw18shzkYM4a` READY, `fly-tally.com` alias healthy, public HTTP 200.
- Immediate post-deploy runtime-error check: none reported in the selected 30-minute window.
- Rollback anchor: `chore/pre-f3-integration-anchor` → `4906c1c376d48e9032d23f85b73aea560843f8a5`.

F3 is closed and production-integrated. **F4 multi-part GPS inheritance is the next implementation milestone.**

## 9.1 F3.0 verification evidence

- PR #225 merged as `4e42dbf7fd095aa768e404500b141510386a18c5`.
- Verify FlyTally web #1096 PASS: application/TypeScript gate PASS, 1084/1084 unit/regression, PostgreSQL 66/66.
- Browser smoke: N/A for F3.0 because only documentation and characterization tests changed.
- DB/schema/deploy: N/A.
- Runtime semantics remain unchanged; F3.1 is review-gated.

## 9.2 F3.1 production-census evidence

- Database inspection was read-only; no production row was mutated.
- Profile population: 25 total / 25 active / 0 invalid.
- Flight population: 289 total / 289 current-profile matches.
- Legacy blank stored regulatory category: 73 certified rows / 0 drafts.
- Explicit nonblank category mismatch: 0.
- Evidence/class mismatch against current profile: 1 certified historical snapshot; current profile was updated after the flight date.
- Historical identity differences against current profile: 7 total (4 certified / 3 draft).
- TMG/OTHER/Balloon profile/flight population: 0; populated Part-FCL credit provenance: 0 profiles.
- Runtime/schema/certification/deploy: N/A.
- A+ remains frozen; F3.2 is next.

## 9.3 F3.2 verification evidence

- New pure authority module: `lib/flight-aircraft-context-authority.ts`.
- Focused matrix: `tests/v350-flight-entry-f32-aircraft-context-authority.test.ts`.
- The test matrix covers EASA SEP, ULL, TMG, OTHER, Balloon, malformed EASA identity, malformed Part-FCL credit provenance, authority derivation, final-registration normalization, legacy blank SNAPSHOT preservation, crafted drift and the explicit not-yet-wired milestone boundary.
- Verify #1097 PASS; PostgreSQL acceptance artifact reports 66/66.
- Browser #470 PASS; production build PASS.
- Production deployment is READY on exact main SHA with no alias error.
- No database migration and no mutation wiring were introduced.

## 9.4 F3.3 local verification evidence

- Manual Create, registration-change Edit, same-registration SNAPSHOT Edit and GPS PROFILE authority are wired through the shared F3 contract.
- Canonical PROFILE context is persisted from server authority on Create; Update persists either canonical PROFILE authority or preserved SNAPSHOT authority.
- Focused F3.3 coverage exercises PROFILE authorization, A+ TMG/OTHER narrowing, unchanged SNAPSHOT preservation, GPS convergence, shared-materialization isolation and source-level persistence wiring.
- Full final-head unit/regression gate: **1102/1102 PASS**, 0 fail, 0 skipped.
- PostgreSQL core acceptance: **66/66 PASS** on the runtime-identical head.
- TypeScript: PASS on the runtime-identical head.
- Production build: PASS on the runtime-identical head.
- No database migration, schema mutation or certification v1–v8 change.
- No CI, PR, merge or production deployment is claimed by this local closeout.
- Next roadmap step: **F3.4 compact context UX**.

## 9.6 F3.5 local verification evidence

- Independent reviewer verdict was **APPROVE WITH CHANGES**; reconciliation required end-to-end proof rather than speculative locking/refactoring.
- Unit/regression final branch gate: **1119/1119 PASS**, 0 fail, 0 skipped.
- Authenticated desktop Chromium F3.5 closeout: **4/4 PASS**.
- Browser database bootstrap: PASS on disposable localhost PostgreSQL.
- Runtime-identical F3.5 evidence retained from the preceding gate: PostgreSQL core **66/66 PASS**, TypeScript PASS and production build PASS.
- No application-runtime code changed during F3.5; changes are test coverage, browser fixture parity and documentation.
- No database migration and no certification v1–v8 change.
- No CI, PR, merge or production deployment is claimed.
- Remaining deferred items: microscopic profile-read→write race and deliberate same-registration historical context correction UX.
- Integration/production verification is required before beginning F4 implementation on canonical main.

## 10. Acceptance criteria

F3 cannot close until:
- ordinary valid-profile entry no longer asks users to re-enter aircraft-profile schema;
- Manual New/registration-change uses server-authoritative owned + valid profile context; GPS keeps its existing active-owned-profile selection requirement;
- invalid profile cannot be bypassed by crafted Manual context fields;
- same-registration Edit preserves stored historical context;
- a multi-context choice or SNAPSHOT correction cannot be inferred from drift;
- TMG/multi-context cases stay explicit;
- GPS and Manual use the same aircraft-context authority concepts;
- certification v1–v8 and historical identity snapshots remain unchanged;
- no guessed/backfilled context is written;
- F4 receives one clear common aircraft-context contract.
