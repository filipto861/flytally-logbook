# Flight Entry Workflow 3.0 — F4 Independent Review Handoff

## Role

Act as an independent read-only reviewer.

Do not implement code. Do not broaden scope without a demonstrated data-integrity need.

Repository: `filipto861/flytally-logbook`  
Branch: `feat/flight-entry-f4-gps-inheritance`  
Baseline: `main@245a90ec1c25d98653b804657c8b00941b5bca84`  
Primary draft: `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F4_GPS_INHERITANCE_DESIGN.md`

## Why this milestone exists

F0–F3 are complete and F3 is production-integrated.

GPS still intentionally supports PIC only. The canonical product contract already froze F4 as:
- common values;
- common Role/Crew by default;
- explicit whole Role/Crew override per split part;
- no field-level inheritance;
- server receives fully resolved values before persistence;
- N-part persistence remains atomic.

F4 is where GPS Role/Crew moves from the temporary PIC-only safety boundary toward Manual semantic parity without inventing crew evidence.

## Current repository facts

### Role gate
`lib/gps-import-integrity.ts`:
- `GPS_IMPORT_ROLES=["PIC"]`;
- all non-PIC GPS roles are rejected server-side.

### UI
`components/kml-import-form.tsx`:
- one common Role select exists and contains PIC only;
- per-part Review state contains route/time/movement/Night/IFR/note;
- there is no per-part Role/Crew override state;
- Registration, aircraft authority, Operation/Engine, billing, Balloon operation and Role are common session values.

### Shared normalization
`gpsFlightCandidate()` → `normalizeFlightDraft()` is already used per reviewed GPS part.

The pure normalizer already applies the shared RoleCrew rules used by Manual:
- EASA DUAL needs instructor/PIC;
- EASA SPIC/PICUS need supervising pilot + countersignature reference;
- unsupported role fails closed;
- ULL retains current permissive RoleCrew behavior.

GPS currently supplies blank crew fields because only PIC is supported.

### Safety Pilot
Manual Save already has `resolveSafetyPilotPicForSave()`:
- Manual Actual PIC text or explicit accepted Connection;
- account ID, not name matching;
- accepted Connection recheck;
- authoritative display-name snapshot;
- separate `flight_connected_crew` metadata.

GPS import does not currently use this resolver or write connected-crew metadata.

### Atomic persistence
Current `importKmlFlight()`:
- validates all parts;
- normalizes all parts;
- calculates fingerprints;
- pre-checks duplicates;
- acquires advisory transaction locks;
- inserts flights + tracks in one SQL transaction;
- any transaction failure returns a rollback message.

This is an asset to preserve.

### Aircraft authority
F3 already made aircraft PROFILE authority common for the whole import:
- one registration/profile per session;
- server revalidates;
- TMG/OTHER regulatory context is a common choice;
- aircraft identity is not per-part.

## Frozen constraints

Do not:
- add field-level Role/Crew inheritance;
- infer crew from GPS;
- infer accounts from names;
- allow per-part aircraft identity/profile overrides;
- persist `inherit` markers;
- silently repair invalid roles or crew;
- partially save a multi-part import;
- alter certification v1–v8;
- rewrite historical flights;
- expand unrelated per-part overrides without evidence.

## Draft design to review

Preferred model:
- common complete Role/Crew context;
- each part has either INHERIT or one complete OVERRIDE context;
- server parses common + override envelopes and resolves each part before building the candidate;
- missing fields in an override do not fall back field-by-field to common;
- common edits affect only inherited parts;
- Reset to common deletes the override;
- when split structure changes, all part Role/Crew overrides are cleared because index-based re-association is unsafe;
- Safety Pilot is enabled only with full Manual/Connection parity;
- connected Safety Pilot child rows are created atomically with each relevant resulting flight;
- live Connection failure for one part aborts the entire import.

## Questions

Please answer:

1. Is whole-context INHERIT/OVERRIDE the correct model, or is there a safer simpler alternative that still satisfies the frozen D9 contract?

2. Should split structure changes always clear all overrides? If not, define a deterministic evidence-safe mapping rule.

3. Should server input be:
   A. fully client-resolved contexts, or
   B. common context + explicit whole-part override envelopes that the server resolves?
   The draft prefers B.

4. Does F4 need every canonical Manual role, or should some roles remain GPS-blocked even after F4? Identify any role whose semantics cannot safely be reproduced from current shared contracts.

5. For EASA DUAL/SPIC/PICUS, is reusing `roleCrewSpec()` + `normalizeFlightDraft()` sufficient, or is another server resolver required?

6. For Safety Pilot, should the existing Manual `resolveSafetyPilotPicForSave()` be reused per final part, or should a lower-level reusable resolver/plan be extracted? Consider:
   - accepted Connection recheck;
   - common versus overridden Actual PIC;
   - display-name snapshot;
   - one child row per source flight;
   - one revoked Connection aborting all parts.

7. Can connected Safety Pilot child inserts safely be composed into the existing `sql.transaction([...locks,...inserts])` approach, or should transaction construction be restructured?

8. Is the existing duplicate/fingerprint strategy still correct when two split parts have different Role/Crew overrides? Note that duplicate identity currently depends on date, registration, off-block, departure and arrival, not Role.

9. Should changing common Role/Crew invalidate each inherited part's `reviewed` confirmation, or can a separate common Role/Crew completeness gate safely preserve route/timeline review confirmation?

10. Is preserving locally typed role-specific values while switching roles acceptable if only applicable final-role fields are submitted/persisted?

11. Are Operation/Engine, Balloon FREE/TETHERED, billing and regulatory context correctly kept outside F4 per-part overrides?

12. Does any proposed behavior require a DB migration? Default expectation is no.

13. Identify concrete crafted-request cases needed to prove the server does not accept:
   - partial overrides;
   - stale hidden crew fields;
   - unsupported roles;
   - client-faked inheritance resolution;
   - per-part aircraft drift.

14. Identify the minimum browser matrix needed after implementation without duplicating F2/F3 coverage.

15. Is any part of this draft over-engineered? Recommend the smallest safe F4.

## Required output

Return:

### A. Verdict
- APPROVE
- APPROVE WITH CHANGES
- BLOCK — CORRECTNESS DEFECT

### B. Critical findings
Only actual correctness/data-integrity issues.

### C. Frozen decisions accepted/rejected
For each major draft decision, say KEEP / CHANGE and why.

### D. Minimum implementation architecture
Exact boundaries/functions/state model you recommend.

### E. Test matrix
Separate:
- pure/unit;
- source-contract;
- PostgreSQL/action;
- authenticated browser.

### F. Non-blocking/deferred items
Useful later but not required for F4.

### G. Recommended milestone batches
Smallest safe sequence from design to closeout.

Do not recommend a runtime implementation until you have reconciled your conclusions with the actual repository constraints above.
