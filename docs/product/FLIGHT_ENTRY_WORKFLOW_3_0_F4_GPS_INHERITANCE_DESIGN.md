# Flight Entry Workflow 3.0 — F4 GPS Multi-part Inheritance

**Status:** DISCOVERY COMPLETE · DESIGN DRAFT / INDEPENDENT REVIEW GATE  
**Repository baseline:** `main@245a90ec1c25d98653b804657c8b00941b5bca84`  
**Scope:** common GPS Role/Crew context, whole-part Role/Crew overrides, fully resolved server normalization, atomic persistence.  
**Out of scope:** aircraft-context redesign, certification v1–v8 changes, historical backfill, field-level inheritance, GPS-derived crew inference.

## 1. Goal

F4 implements frozen Decision D9/D10 from the canonical Flight Entry Workflow 3.0 contract:

- one GPS import session has one common aircraft identity;
- Role/Crew defaults are common to all split parts;
- a part may explicitly own one complete Role/Crew override;
- common edits affect inherited parts only;
- Reset to common removes the part override;
- final server persistence receives fully resolved Role/Crew values, never an `inherit` marker;
- every part is normalized/validated before mutation;
- any invalid part aborts the entire import.

## 2. Repository evidence at F4 start

### GPS role gate is intentionally still PIC-only

`lib/gps-import-integrity.ts` currently freezes:

```ts
export const GPS_IMPORT_ROLES=["PIC"] as const;
```

`validateGpsImportRole()` rejects every other role with the explicit message that GPS currently supports PIC only.

The GPS UI mirrors that server boundary with one common Role selector containing only PIC.

### Per-part state does not contain Role/Crew

`components/kml-import-form.tsx` currently models each reviewed split with route/timeline, movement evidence, Night/IFR and note data. Role/Crew is not part of the per-part Review state.

Aircraft identity/context, Operation/Engine, billing, Balloon operation and Role are common import values.

### GPS candidates already use the shared pure normalizer

`gpsFlightCandidate()` builds a `FlightDraftCandidate` for each reviewed part and `importKmlFlight()` passes every candidate through `normalizeFlightDraft()` before persistence.

That normalizer already applies the source-agnostic RoleCrew contract:
- EASA DUAL requires instructor/PIC;
- EASA SPIC/PICUS require supervisor name + countersignature reference;
- unsupported roles fail closed;
- ULL keeps the existing permissive RoleCrew policy.

Current GPS candidates intentionally supply blank commander/instructor/verification fields because GPS role support is PIC-only.

### Safety Pilot needs more than text fields

Manual Safety Pilot already uses `resolveSafetyPilotPicForSave()`:
- manual Actual PIC or explicit accepted Connection;
- account-ID based Connection recheck;
- authoritative display-name snapshot;
- separate `flight_connected_crew` metadata.

GPS import does not currently run this resolver or create connected-crew rows.

F4 must not enable GPS Safety Pilot until equivalent server-authoritative semantics exist for common and overridden parts.

### Atomic multi-part persistence already exists

`importKmlFlight()` currently:
1. validates track/splits;
2. builds and normalizes all reviewed part candidates;
3. checks duplicate fingerprints;
4. checks existing duplicates;
5. executes duplicate locks + flight inserts + track inserts in one SQL transaction;
6. returns a generic rollback error if the transaction fails.

F4 should extend this boundary, not replace it.

### F3 aircraft authority is already common

Registration and aircraft context are resolved once per import session under F3 PROFILE authority. TMG/OTHER regulatory context is a common session choice. Aircraft identity is not a per-part F4 override.

## 3. Frozen product boundaries

F4 MUST preserve:
- no field-level Role/Crew inheritance;
- no per-part aircraft registration/profile/context override;
- no crew inference from GPS;
- no name→account matching;
- no silent role repair;
- no partial import;
- no persistence of `inherit` markers;
- no certification payload/version change;
- no historical data rewrite;
- no expansion of per-part overrides to Operation/Engine, Balloon operation, billing or aircraft context unless a separate evidence-backed decision changes scope.

## 4. Draft domain model

Client state may represent inheritance explicitly:

```ts
type GpsRoleCrewContext = {
  role: RoleCrewRole;
  commander: string;
  instructor: string;
  verificationName: string;
  verificationReference: string;
  safetyPilotMode: "MANUAL" | "CONNECTION" | "";
  connectedPicUserId: number | null;
};

type PartRoleCrewState =
  | { kind: "INHERIT" }
  | { kind: "OVERRIDE"; context: GpsRoleCrewContext };
```

This is UI state only. It is not a persistence schema.

Server input should provide common Role/Crew plus an explicit per-part override envelope. The server must validate the envelope and resolve each part into one complete Role/Crew context before calling `gpsFlightCandidate()` / `normalizeFlightDraft()`.

No final `FlightInput` may contain inheritance metadata.

## 5. Draft server resolution order

For each part:

1. Resolve common aircraft PROFILE authority once for the import session.
2. Parse/validate common Role/Crew context.
3. Parse each part's override flag.
4. If inherited, use the common Role/Crew context.
5. If overridden, require one complete override context for that final role; never merge individual missing fields from common.
6. For Safety Pilot, resolve manual/Connection Actual PIC server-side after final part context is known.
7. Build a complete GPS candidate.
8. Run the shared pure normalizer.
9. Resolve date-effective billing price.
10. Only after every part succeeds: duplicate checks and one atomic write transaction.
11. Insert/update any Safety Pilot connected-crew child metadata in that same transaction and recheck live Connection state at the write boundary.

## 6. UI target

Common details gain the full source-agnostic Role/Crew controls, reusing Manual semantics and labels where practical.

Each split card shows:

```text
Role/Crew
Using common: PIC
[Override for this flight]
```

When overridden:

```text
Role/Crew override
Role: DUAL
Instructor / PIC: ...
[Reset to common]
```

Only fields applicable to the override's final role are shown.

The user must never edit individual inherited fields. A part either inherits the entire Role/Crew context or owns the entire override.

## 7. State transitions requiring explicit treatment

### Common Role/Crew edit
- inherited parts immediately resolve to the new common context;
- overridden parts remain unchanged;
- readiness must fail closed if the new common context is incomplete for any inherited part.

### Create override
- initialize from the currently resolved common context as a convenience snapshot;
- from that point the override is independent of later common edits.

### Reset to common
- delete the override state completely;
- the part immediately follows current common Role/Crew.

### Split structure changes
Draft proposal: clear all per-part Role/Crew overrides when split boundaries/part count change.

Reason: index-based overrides cannot be safely re-associated with materially changed track sections. Preserving them heuristically risks assigning crew evidence to the wrong flight.

This decision is review-gated.

### Role switch inside common or override
Local text may be preserved for user convenience, consistent with F2's non-destructive edit policy, but only fields applicable to the final role may be submitted/resolved into the final candidate. No stale hidden Role/Crew evidence should be persisted accidentally.

## 8. Safety Pilot draft

F4 should support Safety Pilot only if full parity can be preserved.

Common Safety Pilot context may use:
- Manual Actual PIC text; or
- one accepted Connection by account ID.

Inherited parts share that exact resolved Actual-PIC context.

An overridden part may choose a different complete Safety Pilot context.

For connected mode:
- client submits explicit account ID, never a display-name identity claim;
- server rechecks accepted Connection;
- server snapshots current display name into `commander`;
- each resulting Safety Pilot flight gets its own `flight_connected_crew` row;
- live Connection is rechecked at the atomic write boundary;
- failure for one part aborts all flights/tracks/child rows.

No invitation is sent during Save.

## 9. Acceptance matrix

At minimum prove:

1. one-part PIC remains behaviorally equivalent to pre-F4 GPS PIC;
2. two inherited PIC parts resolve identically except part-specific source evidence;
3. common PIC → DUAL makes all inherited parts require common Instructor/PIC;
4. one part overridden back to PIC remains PIC while another inherits DUAL;
5. common change after override changes only inherited parts;
6. Reset to common removes override semantics;
7. crafted partial override cannot borrow missing Role/Crew fields from common;
8. crafted unsupported role fails closed;
9. EASA DUAL, SPIC and PICUS requirements match Manual/shared RoleCrew semantics;
10. Safety Pilot Manual common context persists commander correctly;
11. Safety Pilot accepted-Connection common context persists commander + one child link per resulting source flight;
12. revoked Connection aborts the entire import with no flights/tracks/child rows;
13. mixed inherited/overridden Safety Pilot context remains deterministic;
14. split structure change cannot silently reassign an old override to a new physical segment;
15. one invalid part aborts the complete N-part transaction;
16. duplicates remain duplicate-safe under mixed overrides;
17. aircraft/profile authority remains common and cannot be overridden per part;
18. TMG/OTHER common regulatory context remains common;
19. Operation/Engine and other non-RoleCrew common values remain outside per-part overrides;
20. certification v1–v8 and historical data remain unchanged.

## 10. Verification plan

Expected gates after implementation:
- focused pure resolver/state tests;
- source-contract tests proving the server never persists inheritance markers;
- full unit/regression;
- TypeScript;
- PostgreSQL acceptance for atomic multi-part + connected-crew rows;
- production build;
- authenticated Chromium:
  - common DUAL;
  - inherited + overridden role;
  - Reset to common;
  - Safety Pilot manual;
  - Safety Pilot accepted Connection;
  - revoked Connection fail-closed;
  - responsive desktop/iPad/mobile and light/dark for override UX;
- no DB migration unless implementation evidence proves one necessary.

## 11. Review-gated questions

1. Should split-boundary changes always clear all part Role/Crew overrides?
2. Should the client submit resolved complete per-part contexts, or common+override envelopes that the server resolves? Preferred: server resolves common+override envelopes to avoid trusting client inheritance resolution.
3. Is the existing Manual Safety Pilot resolver reusable directly, or should F4 extract a pure/common RoleCrew resolution layer plus transaction-safe connected-child plan?
4. Should F4 enable every canonical Manual role immediately, or only roles whose full RoleCrew semantics can be proven end-to-end in this milestone?
5. How should ULL RoleCrew display behave when canonical roles have no EASA Save blockers?
6. Should changing common Role/Crew mark inherited parts as unreviewed, or is a separate Role/Crew completeness gate sufficient?
7. What is the minimum safe transaction shape for N flights + tracks + zero-or-more connected-crew rows while preserving current advisory locks and duplicate behavior?

No runtime implementation begins until this review is reconciled.
