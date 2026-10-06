# 3.5.0 — Certified flight voiding

**Status:** DESIGN FROZEN — M1 VERIFIED / M2 PRE-GATE VERIFIED / M3 IMPLEMENTED  
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

Portable backup currently emits **version 12**. Version 12 added server authenticity/signature semantics while retaining the v11 section set; certified-flight revisions/verifications still assume a live owned `flights` parent. A permanent void archive therefore requires an explicit backup-format extension rather than allowing protected evidence to disappear from disaster-recovery data.

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
- GPS track rows, including the complete persisted `coordinates_json` / `overview_coordinates_json` payload carried by canonical `flight_tracks` rows.

The certified-flight protection trigger should be changed narrowly: DELETE of a certified row remains forbidden **unless** a matching permanent tombstone already exists for the same owner, flight id, current revision and certification hash. The insert + dependent-workflow transitions + delete must occur in one transaction.

### Backup/recovery consequence

This feature is not schema-only. Portable backup must gain **version 13** with permanent void-tombstone sections. Version 12 must remain fully restorable. Restore must restore tombstones as historical evidence only and must never recreate them as active flights.

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


## Independent review reconciliation — 6 October 2026

Independent review verdict: **APPROVE WITH CHANGES**. The core archive+delete direction is accepted.

Accepted changes:
- do not use an in-row `voided_at` as the sole operational exclusion mechanism;
- do not make the permanent tombstone a single unstructured JSON blob;
- preserve protected evidence under an immutable tombstone parent with queryable archive children;
- add explicit participant-copy provenance before enabling source-flight deletion;
- bind certified DELETE to an exact tombstone created in the same database transaction;
- make tombstone/archive records append-only / immutable;
- use a separate audit-only route for voided records;
- bump portable backup from the actual current version 12 to **version 13**, and restore tombstones as history only;
- treat active-flight + matching-tombstone coexistence as an invalid restore state;
- regression-lock concurrency, direct-delete rejection, recency exclusion, participant-copy survival, share invalidation, backup/restore and correction compatibility.

Repository correction to the reviewer handoff:
- the handoff stated that portable backup was v11;
- current code already emits **portable backup v12** with server authenticity/signature requirements;
- therefore the voiding feature must use **v13**, not v12.

One review recommendation is narrowed rather than copied mechanically:
- the repository uses one server-side `DATABASE_URL` client and does not currently establish a separately verified restricted runtime database role;
- this phase will therefore **not invent a new DB-role/privilege architecture** merely to claim that direct table DML is revoked;
- instead, the safety boundary must be enforceable by existing database invariants: exact tombstone matching, same-transaction binding, immutable archive rows, row locking, unique keys, and server-side authenticated ownership checks;
- a future dedicated runtime DB role may strengthen this further, but is not assumed without deployment evidence.

## Frozen persistence design

### Schema v20

3.5.0 Phase 1 requires database schema **v20**.

Canonical permanent parent:
- `voided_certified_flights`

Required parent evidence:
- archive id;
- original flight id;
- owner user id;
- current record revision;
- certification hash and certification version;
- certified timestamp / certifying user;
- complete certified flight snapshot;
- deterministic snapshot SHA-256;
- archive schema version;
- void timestamp / voiding user / mandatory reason;
- unique void-operation token;
- creating transaction id used only to prove same-transaction DELETE authorization.

Required immutable archive children:
- certified revision history;
- flight verification/signature evidence;
- workflow evidence snapshots for instructor approvals, participations, connected crew and public shares;
- expense evidence;
- GPS track evidence, including full stored track payload needed for audit/backup.

Archive children may use typed relational rows with versioned JSON payloads for the original source record, but protected cryptographic identifiers/status/signature fields and source identifiers must remain independently addressable and hash-verifiable. Missing required evidence is never converted to an empty/default row.

### Participant-copy provenance

Add a permanent provenance record for materialized shared-flight copies before source voiding is enabled.

For each accepted participant copy preserve:
- participant-owned flight id/user;
- original source flight id/user;
- source revision and certification hash;
- participant role / PIC commander basis where applicable;
- acceptance/materialization timestamp when available;
- source void tombstone id once the source is voided.

Current repository behavior already protects the independent participant-owned `flights` row from source deletion; the vulnerable object is the source `flight_participations` row, which currently has an `ON DELETE CASCADE` source FK and would otherwise erase provenance. Phase 1 must backfill permanent provenance before enabling certified voiding.

### Certified DELETE database invariant

The existing certified-flight protection remains the default.

A certified `flights` row may be deleted only when all are true:
1. a permanent tombstone for the same owner/original flight/revision/certification hash exists;
2. the tombstone snapshot hash matches the exact certified row being removed;
3. the tombstone was created in the **same database transaction** as the DELETE;
4. the operation has a unique id and the row is locked against concurrent correction/void;
5. all mandatory archive children/provenance transitions have succeeded.

A tombstone created in an earlier committed transaction must **not** authorize a later DELETE.

The void transaction must lock the active flight row before snapshotting. Two concurrent requests may yield only one tombstone; the second request must resolve to an explicit already-voided/not-found outcome, never a second archive.

### Current-table cleanup after archive

After all protected snapshots are safely stored:
- pending participations are transitioned/snapshotted as superseded/cancelled and related notifications are made non-actionable;
- pending instructor approvals / verifications are transitioned/snapshotted;
- active public shares are revoked before their live rows disappear;
- accepted participant-copy provenance is bound to the tombstone;
- current `flight_certified_revisions` rows for the source are copied into the tombstone archive and removed from the active revision archive so no future direct consumer can mistake them for active evidence;
- live dependent rows may then cascade/delete only after their permanent archive copy exists;
- the active `flights` row is removed last.

The tombstone parent and children are immutable after commit.

### Operational exclusion

Because the active `flights` row is removed, ordinary Flights/detail/navigation, Dashboard, Statistics, Map, Print/Export, professional experience and all category recency engines exclude the voided flight by construction.

Any consumer that reads `flight_certified_revisions`, audit history or collaboration tables directly must still be audited so archived evidence cannot re-enter an active calculation.

### Audit surface

Use a dedicated immutable route:
- `/audit/voided-flights/[id]`

The route is authenticated/read-only and never exposes edit, correction, share, certification or ordinary flight-navigation actions.

The legacy active-flight audit route may redirect an authorized owner to the tombstone audit route when the active flight no longer exists, but the tombstone is not represented as an active flight.

### Backup / restore v13

Portable backup v13 adds permanent certified-void archive/provenance sections while retaining all v12 authenticity requirements.

Restore invariants:
- tombstones restore as history only;
- a tombstone is never materialized into `flights`;
- a backup containing both an active flight and a matching tombstone is rejected;
- existing v12 and older supported backups remain restorable;
- void actor/time/reason, certification hash/revision/version and archive hashes are preserved exactly;
- repeated restore is idempotent;
- accepted participant copies remain active and retain provenance to the restored tombstone;
- a restored tombstone cannot authorize a future active-flight resurrection or certified DELETE because same-transaction authorization is not satisfied.

## Implementation milestones

### M1 — Schema v20 + archive invariants — VERIFIED LOCAL

M1 local verification on exact head `676a18d0ed9829abe0b6e5fd7eebf34a6c3c69e4`:
- TypeScript: PASS;
- migration/schema source contract: **10/10 PASS**;
- PostgreSQL acceptance: **6/6 PASS**;
- negative PostgreSQL log messages for unauthorized DELETE, active+tombstone coexistence, archive mutation and late archive-child insertion are expected assertions, not failures.
- tombstone parent;
- immutable archive children;
- same-transaction DELETE authorization;
- participant provenance table/backfill;
- migration and rollback/preflight tests.

### M2 — Domain mutation — PRE-GATE VERIFIED / END-TO-END PENDING

M2 implementation batch:
- canonical `voidCertifiedFlightRecord()` service;
- authenticated server action delegates to the domain service;
- exact certified row is protected by owner scope + revision/hash + `xmin` + row lock;
- all current protected evidence is snapshotted before deletion and stale evidence fails closed;
- pending workflow rows are superseded, public shares revoked, pending request notifications made non-actionable, accepted-copy provenance bound to the tombstone;
- source certified revisions and canonical `flight_tracks` rows are removed from active stores only after archive-count proof;
- final `flights` DELETE is gated on complete archive/source counts, after which recency and all active views are invalidated;
- shared-copy materialization creates provenance before linking the participant-owned copy.

M2 pre-gate on `55088124d14c4e0fe6dfb6249f06407975085009`: TypeScript PASS; targeted source/domain contracts **35/35 PASS**; FI/PIC PostgreSQL materialization **3/3 PASS**. End-to-end execution of the canonical void transaction remains part of the browser/integration gate.
- one canonical server-side void operation;
- authenticated ownership + mandatory reason;
- row lock/concurrency behavior;
- archive snapshots;
- workflow/share/provenance transitions;
- active-row removal;
- recency refresh and cache/view invalidation.

### M3 — Audit-only UX — IMPLEMENTED / VERIFICATION PENDING

M3 implementation batch:
- certified Flight detail → More → **Remove certified flight**;
- explicit destructive modal explains exclusion from Flights, totals, statistics, map, exports and recency/compliance;
- mandatory 8–1000 character removal reason;
- pending/disabled duplicate-submit protection and non-raw error handling;
- success returns to Flights with a one-time completion notice and link to the permanent audit record;
- dedicated authenticated read-only `/audit/voided-flights/[id]` route verifies the permanent archive hash and preserved certification fingerprint;
- legacy `/flights/[id]/audit` links redirect to the tombstone audit when the active source no longer exists;
- source-level UX contract tests added.

M3 source/build gate on `e72ee05b35595c70a01a209e9d6ac903e7656e61`: TypeScript PASS; targeted certification/domain/UI contracts **28/28 PASS**; production Next.js build PASS.

Authenticated browser acceptance is now implemented and pending execution.

First browser execution on `bc0fd31`: **0/2 PASS**. Both desktop and mobile failed closed before mutation because the new domain service queried a non-existent `track_points` table. Repository reconciliation confirmed that FlyTally stores the complete GPS payload directly in `flight_tracks.coordinates_json` / `overview_coordinates_json`; there is no canonical secondary point table. The unsupported assumption was removed from runtime, schema archive kinds and tests. Exact-current-head verification is required. It creates and certifies a real test flight through the UI, removes it through the certified-flight modal, verifies the active row/list disappear, verifies the immutable tombstone/reason/hashes remain, opens the permanent audit route, and proves the legacy audit URL redirects to the tombstone.
- Flight detail → More → Remove certified flight;
- destructive confirmation + mandatory reason;
- duplicate-submit protection;
- redirect to Flights after success;
- separate immutable void-audit route.

Second browser execution on `dbcefaf`: TypeScript PASS, targeted contracts **28/28 PASS**, PostgreSQL schema acceptance **6/6 PASS**, production build PASS, but browser **0/2 PASS** because the page remained on the certified flight detail after submit. No domain-service exception was emitted in this run, but the original test asserted navigation before database state, so it did not prove whether the mutation committed. The completion flow is therefore hardened in two ways: success now redirects **server-side** from the Server Action instead of relying on a client `useEffect` after deleting the current route's backing row, and browser acceptance now proves active-row deletion + tombstone existence before asserting navigation.

### M4 — Backup / restore v13
- export/archive sections;
- parser/authenticity/count validation;
- exact restore support;
- resurrection/conflict guards;
- v12 backward compatibility.

### M5 — Consumer and integration verification
- active read-model exclusion;
- all category recency/compliance;
- professional export / print / map / statistics / dashboard;
- sharing/notifications/collaboration;
- participant-copy survival/provenance;
- correction workflow compatibility.

### M6 — Release gate / documentation
- full unit/regression;
- PostgreSQL integration;
- authenticated browser acceptance;
- production build;
- ROADMAP / FEATURES / CHANGELOG;
- migration deployment prerequisite;
- production smoke and post-deploy runtime checks.

