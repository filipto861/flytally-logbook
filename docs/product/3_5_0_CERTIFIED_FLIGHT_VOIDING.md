# 3.5.0 — Certified flight voiding

**Status:** DESIGN / REVIEW ACTIVE  
**Owner:** Filip Točík  
**Date:** 6 October 2026  
**Repo:** `flytally-logbook`  
**Branch:** `feat/3.5.0-certified-flight-voiding`  
**Production baseline:** `3.4.1`

## Product intent

A pilot must be able to remove an incorrectly certified flight from the active logbook.

“Remove” means the flight is no longer operational data anywhere in FlyTally. It must not appear in normal flight browsing and must not contribute to totals, statistics, map output, export/print, recency/compliance, sharing surfaces or any other active-logbook read model.

Certification history must not be destroyed.

## Frozen behavior

1. Only the owning authenticated pilot may void their certified flight.
2. The action requires an explicit destructive confirmation and a mandatory human-readable reason.
3. After success the flight contributes zero active/regulatory credit.
4. The protected certified evidence remains auditable:
   - original flight snapshot;
   - certification hash and certification version;
   - record revision;
   - certified timestamp / certifying user;
   - voided timestamp / voiding user;
   - void reason.
5. Existing certified revision history, audit evidence and signatures/verifications must not be rewritten to make it appear that the certification never existed.
6. Active public shares are revoked.
7. Pending participation / instructor / verification requests tied to the source revision are superseded or cancelled with explicit state.
8. A participant's already-created independently owned flight is not deleted from that participant's account.
9. The existing ordinary-flight Trash mechanism is not authoritative for certified voiding and its 90-day purge/restore semantics must not be reused for protected evidence.
10. No “undo” may silently restore the original certification hash. Any future reinstatement would require a separately designed evidence-preserving workflow.
11. The mutation is atomic. Any failure leaves the certified flight active and unchanged.
12. After mutation, recency/compliance snapshots and all affected cached/read views are refreshed or invalidated.

## Important semantic distinction

A voided certified flight is not:
- an editable draft;
- an ordinary deleted/trash flight;
- a corrected revision;
- a hard-deleted row with no provenance.

It is protected historical evidence that has been explicitly withdrawn from active logbook use.

## Repository discovery — 6 October 2026

The active `flights` table is consumed directly by many independent read paths. Confirmed consumers include:
- Flights list/filter/detail/navigation in `lib/data/flights-fast.ts` and `lib/data/flights.ts`;
- Dashboard/statistics/map data services;
- aeroplane recency in `lib/recency-service.ts` and audit provenance in `lib/recency-audit-service.ts`;
- SPL/BPL/helicopter recency services;
- professional experience/export;
- Print and generic export;
- public flight sharing;
- GPS/track data and related detail surfaces.

Several regulatory consumers explicitly select `FROM flights ... WHERE certified_at IS NOT NULL`. An in-row `voided_at` marker would therefore require a reliable exclusion in every existing and future consumer. One missed query could still count or expose a voided flight.

Current database protection also deliberately rejects DELETE of a certified `flights` row. Certified-linked tables include CASCADE foreign keys for instructor approvals, participations, verifications, connected crew, expenses and public shares. Certified revision history and the generic flight audit log are separate historical stores.

Portable backup is currently versioned through v11 and assumes certified-flight revisions/verifications belong to a live owned `flights` parent. A permanent void archive therefore requires an explicit backup-format extension rather than allowing protected evidence to disappear from disaster-recovery data.

### Draft architecture recommendation

Prefer **Option A: permanent certified-void tombstone/archive + removal from active `flights`**.

Rationale:
- operational exclusion is fail-closed by construction: existing consumers cannot count a row that is no longer in the active authority table;
- no repository-wide dependence on remembering `voided_at IS NULL`;
- ordinary flight detail naturally becomes unavailable after voiding;
- a dedicated audit path can read the immutable void archive instead.

The tombstone must be created before the active row can be deleted and must preserve enough evidence to make the deletion auditable even after FK cascades remove dependent live workflow rows.

Proposed permanent archive payload:
- original flight id / owner;
- complete certified `flight_data` JSON snapshot;
- current certification hash/version/revision/certified timestamp;
- void actor, timestamp and reason;
- archived certified-revision rows;
- flight verification/signature rows;
- instructor-approval rows;
- participation rows;
- connected-crew rows;
- public-share rows;
- expense rows;
- GPS track rows and any legacy track-point evidence required by backup/audit semantics.

The certified-flight protection trigger should be changed narrowly: DELETE of a certified row remains forbidden **unless** a matching permanent tombstone already exists for the same owner, flight id, current revision and certification hash. The insert + dependent-workflow transitions + delete must occur in one transaction.

### Backup/recovery consequence

This feature is not schema-only. Portable backup must gain a new format revision that includes permanent void tombstones. Restore must restore tombstones as historical evidence only and must never recreate them as active flights.

### Open design points for independent review

1. Is archive+delete preferable to an explicit state column given the large direct-query surface?
2. Is a single immutable JSON tombstone sufficient for dependent evidence, or should verification/participation provenance remain relational?
3. How should accepted participant copies retain provenance after the source row is removed?
4. Should the existing `/flights/[id]/audit` route fall back to the void archive, or should voided records use a separate audit-only route?
5. What is the minimum safe backup-format change so a restore can never resurrect a voided flight as active?

## Persistence design gate

Do **not** implement the UI first.

The implementation must choose one canonical persistence model only after repository-wide consumer discovery and independent review.

Candidate models to evaluate:

### Option A — tombstone/archive + remove from active `flights`
Move the complete protected record and required linked evidence into a permanent certified-void archive, then remove it from the active `flights` table atomically.

Advantage:
- fail-safe exclusion from existing operational consumers because the row is no longer in the active source table.

Risk:
- linked FK/workflow/history relationships must be preserved deliberately;
- restore/backup/audit semantics become more complex.

### Option B — explicit `voided_at` state on `flights`
Keep the record in `flights` and mark it voided.

Advantage:
- linked evidence remains attached to the existing flight id.

Risk:
- every current and future consumer must reliably filter voided rows;
- one missed query could leak a voided flight into recency, totals, exports or UI.

Because project policy prefers fail-closed behavior, Option B is not acceptable without strong evidence that exclusion can be centralized and enforced rather than relying on scattered query discipline.

## Discovery required before implementation

Inventory at minimum:
- flight list/detail/navigation;
- Dashboard;
- Statistics;
- Map;
- Print / Export / professional export;
- recency engines for all supported categories;
- licences/recency evidence links;
- public share routes;
- Connections / participations;
- instructor approvals;
- flight verifications / signatures;
- notification/action surfaces;
- backups and restore;
- deleted-flight recovery;
- audit history;
- admin/database diagnostics;
- deduplication / future flight creation;
- any materialized/cached recency snapshots.

## Server action contract

The final server mutation must:
- verify authenticated ownership;
- verify the flight is currently certified;
- reject already-voided / non-certified / stale state;
- require a bounded non-empty reason;
- snapshot/preserve protected evidence before exclusion;
- revoke/supersede dependent active workflows;
- exclude the record from active-logbook authority atomically;
- refresh recency and revalidate affected views only after commit.

No client-only gate may be treated as authorization.

## UX contract

Location:
- Flight detail → **More** → destructive **Remove certified flight** action.

Confirmation:
- explicitly state that the flight will disappear from logbook totals, recency, statistics, map and exports;
- explicitly state that audit history will remain;
- require a reason;
- use pending/disabled duplicate-submit protection;
- do not expose raw server errors.

Post-success:
- redirect to Flights;
- the removed flight must not be reachable through ordinary flight detail/navigation;
- audit/recovery evidence may remain available only through the dedicated historical/audit surface.

## Verification / acceptance

Required before merge:
- TypeScript;
- targeted unit/regression tests;
- PostgreSQL integration covering atomic archive/void behavior;
- complete active-read-model exclusion tests;
- recency recalculation tests;
- sharing/verification transition tests;
- backup/restore compatibility tests;
- authenticated browser acceptance for destructive confirmation and disappearance;
- production build;
- full application regression gate;
- migration preflight/postflight if schema changes;
- ROADMAP / FEATURES / CHANGELOG reconciliation;
- production smoke after deployment.

## Non-goals

- permanently erasing protected certification evidence;
- deleting another pilot's independent copy;
- silently editing the certified revision into a different flight;
- treating voiding as a substitute for ordinary correction when the flight itself should remain valid;
- regulatory/legal claims that FlyTally voiding alone satisfies a specific authority procedure without separate evidence.
