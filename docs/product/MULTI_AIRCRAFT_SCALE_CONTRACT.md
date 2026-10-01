# Multi-aircraft Product Scale — canonical profile & evidence contract

Status: **M0 + M2A merged · M1 closeout candidate**  
Repository baseline: `main@44a70a039dee6abce58370dad31d29ad1d9d67a0`  
Implementation branch: `feat/multi-aircraft-m1-profile-validation`

This document records the repository-backed source-of-truth contract for the Multi-aircraft Product Scale phase. It does not change runtime behavior.

## 1. Product boundary

FlyTally already supports multiple personal aircraft profiles. This phase does **not** introduce a second aircraft/fleet model.

Frozen boundaries:

- one canonical flight model;
- one current personal aircraft profile per user + registration;
- no aircraft-specific flight-entry pages;
- no organization/fleet ownership in this phase;
- catalogue metadata is identity/search convenience, not regulatory authority;
- manual Make / Model / ICAO entry remains available;
- invalid or ambiguous regulatory profile data fails closed;
- historical flight evidence is not silently reclassified by later profile edits;
- exact backup/restore is not routed through current UI canonicalization;
- no schema migration is assumed.

## 2. Canonical source-of-truth classes

### Current aircraft profile

The mutable user-owned record used to supply identity, defaults and explicit applicability for **future** entries.

It is not automatically authoritative for historical regulatory calculations.

### Historical flight snapshot

Fields stored on a flight at entry/certification time. These are the primary source for calculations that ask what aircraft/configuration/category applied to that historical flight.

Current profile edits must not override a populated flight snapshot.

### Catalogue identity metadata

Search/convenience data from the bundled aircraft catalogue. `classHint` is non-binding and must never grant regulatory meaning.

### Dynamic applicability metadata

A current mapping statement intentionally evaluated against historical flight dates. This is distinct from historical flight identity.

The existing Annex-I / ULL Part-FCL override is in this class: it carries an explicit target class plus basis and effective-from date. Ordinary ULL→SEP treatment is automatic in the existing engine and does not depend on this override.

### Certification-protected flight metadata

Versioned flight payload fields covered by certification hashes/revisions. They are not aircraft-profile fields, even when the same conceptual value also exists on the current profile.

## 2A. Flight Entry F0 cross-workstream evidence

Flight Entry Workflow 3.0 F0 identified one unresolved historical-identity interaction that belongs in M2B evidence:

- shared-flight acceptance explicitly supplies the certified source flight's make/model/variant;
- the v6 `BEFORE INSERT` flight identity trigger can then assign make/model/variant from the recipient's current aircraft profile for the same registration;
- therefore complete sharing snapshot equivalence is **not yet proven** and must fail closed to evidence rather than be assumed.

Flight Entry F1.0 addresses this interaction with base migration v17: ordinary empty-snapshot inserts still resolve current profile identity, while any explicitly supplied historical identity tuple is preserved atomically; only an actual registration change refreshes identity. Verification is required before this cross-workstream risk is considered closed.

## 3. Field-by-field aircraft profile matrix

| Aircraft field | Canonical class | Historical flight copy / equivalent | Primary consumers | Contract |
| --- | --- | --- | --- | --- |
| `id` | Current profile row identity | no | DB/UI/sharing/photo FK | Internal identity only. |
| `user_id` | Ownership/auth | flight has its own `user_id` | every server query/action | Server-side ownership boundary; never client-authoritative. |
| `registration` | Current profile key + historical identity | `flights.registration` | flight entry, pricing, sharing, delete guard, backup | Current profile is unique per user+registration; flight copy is historical evidence. Registration is read-only in normal profile edit UI. |
| `aircraft_type` | Current display/legacy identity | `flights.aircraft_type` | UI, legacy/type fallback, certification | Snapshot on flight. Historical consumers prefer the flight value over current profile. |
| `aircraft_make` | Current identity | `flights.aircraft_make` | UI, certification | Snapshot on flight; current profile must not rewrite historical value. |
| `aircraft_model` | Current identity | `flights.aircraft_model` | UI, type-specific helicopter recency, certification | Snapshot on flight. Type-specific historical calculations must use flight snapshot first. |
| `aircraft_variant` | Current identity/applicability detail | `flights.aircraft_variant` | UI, certification | Snapshot on flight; current edit must not rewrite historical value. |
| `icao_type` | Catalogue/reference identity metadata | none today | aircraft picker/profile/share | Convenience/reference only; not regulatory authority and not currently certification evidence. |
| `aircraft_class` | Current regulatory default | `flights.aircraft_class` | flight defaults, category/recency engines, certification | Explicit pilot-confirmed current default; historical calculation uses flight snapshot. |
| `regulatory_category` | Current regulatory default | `flights.regulatory_category` | flight defaults, category/recency engines, certification | Explicit state; historical calculation uses flight snapshot. |
| `balloon_class` | Current BFCL applicability/default | `flights.balloon_class` | flight entry, BFCL recency, certification | Required for balloon profile; historical calculation uses flight snapshot. |
| `balloon_group` | Current BFCL applicability/default | `flights.balloon_group` | flight entry, BFCL recency, certification | Required for hot-air balloon profile; historical calculation uses flight snapshot. |
| `evidence` | Current normal-logbook default | `flights.evidence` | flight entry, recency, certification | Current profile supplies future-entry default; historical flight value is authoritative for that flight. |
| `default_role` | Current UI default | `flights.role` | flight form | Never historical authority; role is flight-specific once saved. |
| `billing_basis` | Current commercial/UI default | `flights.billing_basis` | flight form/cost | Current default only; saved flight billing basis is historical. |
| `default_price_per_hour` | Current commercial fallback | `flights.price_per_hour` | price resolution | Current fallback for future flight pricing; saved flight price remains historical. |
| `active` | Current library state | no | aircraft picker/library | Visibility/selection state only; never changes historical evidence. |
| `part_fcl_credit_class` | Dynamic applicability metadata | no | generic aeroplane recency | Optional atypical Annex-I mapping override. Ordinary ULL→SEP remains automatic. Do not reinterpret as historical aircraft class. |
| `part_fcl_credit_basis` | Dynamic applicability provenance | no | profile validation / audit | Required provenance when an explicit override exists. It is not flight identity. |
| `part_fcl_credit_from` | Dynamic applicability effective date | no | generic aeroplane recency | Applies the explicit override only to flights on/after the recorded date. |
| `note` | Current user metadata | no | aircraft UI/share opt-in | Not regulatory evidence and not copied into flight certification. |
| `created_at` / `updated_at` | Current profile audit metadata | no | persistence/admin | Row lifecycle metadata only. |

Adjacent data:

- `aircraft_photos`: current presentation metadata; recipient import is opt-in; no regulatory meaning.
- `rates`: user-owned dated commercial history keyed by registration; flight creation resolves a price and stores it on the flight. Rate history is not regulatory aircraft applicability.
- `aircraft_profile_shares`: transfer snapshots; recipient gets an independent personal copy, not shared ownership.

## 4. Entry and consumer inventory

| Path | Role in contract | Required M1/M2 behavior |
| --- | --- | --- |
| `components/aircraft-manager.tsx` | Full profile editor | UI collects explicit identity/category state; no independent business-rule fork. |
| `components/quick-aircraft-form.tsx` | Quick profile creation | Must converge on the same server profile contract as full editor. |
| `app/(protected)/database/actions.ts` | Normal profile persistence | Existing strongest validation boundary; candidate logic to extract into reusable canonical parser. |
| `lib/aircraft-profile-context.ts` | Regulatory profile normalization | Shared canonical regulatory mapping; invalid combinations fail closed. |
| `components/aircraft-type-picker.tsx` + catalogue | Identity/search convenience | Manual fallback retained; hints stay non-binding. |
| `app/(protected)/connections/aircraft-share-actions.ts` | Shared snapshot import | Must use the same regulatory validation rules as direct persistence; share-specific optional groups remain separate. |
| `lib/aircraft-sharing.ts` | Share snapshot parsing | Parsing/casing is not sufficient regulatory validation. |
| `lib/data/aircraft.ts` + `components/flight-form.tsx` | Future flight defaults | Current profile supplies defaults; saved flight becomes independent historical evidence. |
| `app/(protected)/flights/actions.ts` | Manual/GPS flight persistence | Flight stores explicit category/configuration state; GPS must not invent missing regulatory evidence. |
| `lib/certification-integrity.ts` | Protected historical payload | Existing payload versions/hashes remain unchanged by this phase unless a separately approved migration/version is required. |
| `lib/helicopter-recency-service.ts` | Type-specific historical recency | Current profile model must not override a populated historical flight model. |
| `lib/spl-recency-service.ts` | Sailplane/TMG historical recency | Already consumes flight regulatory/class evidence directly; preserve. |
| `lib/balloon-recency-service.ts` | Balloon historical recency | Already consumes flight balloon evidence directly; preserve. |
| `lib/recency-service.ts` | Aeroplane/ULL recency | Historical flight class/evidence come from flight; current `part_fcl_credit_*` join is the intentional dynamic mapping exception described below. |
| `lib/account-backup.ts` | Portable export | Exports aircraft and flights independently; preserve exact evidence. |
| `lib/account-restore-v6.ts` | Exact restore | Must remain raw/table-compatible for historical/protected data; do not route through M1 UI validator. |
| aircraft deletion/deactivation actions | Lifecycle protection | Referenced aircraft cannot be destructively removed; historical flights remain intact. |

## 5. Reconciled decisions

### D1 — Shared import validation

For regulatory profile fields, shared import now uses the same canonical server-side validation as normal Add/Edit.

Allowed share-specific differences:

- optional photo/default/rate/rate-history/note groups;
- duplicate-registration review;
- snapshot provenance;
- absent optional data.

Not allowed:

- a weaker regulatory combination matrix;
- silent repair of malformed required fields;
- accepting a stale snapshot merely because its strings can be uppercased.

Legacy malformed share snapshot policy: reject the regulatory profile import with an actionable review path. Do not manufacture a plausible category/class.

### D2 — Helicopter type-specific historical recency

The current query's preference for mutable `aircraft.aircraft_model` is incompatible with the historical-snapshot boundary.

Target historical type resolution:

1. populated `flights.aircraft_model`;
2. otherwise populated `flights.aircraft_type` as the bounded legacy identity fallback;
3. otherwise **unresolved**.

Do not silently fall back to the current aircraft profile or registration as helicopter type identity.

Compatibility rationale:

- schema migration v6 backfilled `flights.aircraft_model` from the then-current aircraft profile/legacy flight type;
- current/new flight creation snapshots identity;
- therefore truly unresolved historical rows should be exceptional.

If unresolved rows could affect a type-specific result, the recency presentation must not claim a false CURRENT state. M2A must add an explicit incomplete/limited-evidence path rather than crediting the current profile.

### D3 — ULL / Annex-I Part-FCL mapping

Repository history confirms this is intentionally **not the same semantic case as helicopter type**.

Existing regulatory core:

- ordinary certified ULL/Annex-I aeroplane PIC experience is automatically treated as SEP experience for the applicable experience routes;
- this automatic ULL→SEP path does not require `part_fcl_credit_*`;
- `part_fcl_credit_class` is retained only as an internal atypical mapping override such as a genuine TMG;
- `part_fcl_credit_from` bounds that explicit mapping by flight date;
- `part_fcl_credit_basis` is provenance and is required by current persistence when an explicit override exists;
- the override UI is intentionally hidden but stored metadata is preserved.

Therefore for this phase:

- keep `part_fcl_credit_*` as **dynamic current applicability/provenance metadata**;
- do not snapshot it onto flights;
- do not analogize it to helicopter historical type;
- do not remove the effective-date check;
- any future UI that edits this mapping must expose/protect provenance and make clear that it can change recency applicability from the recorded effective date.

This decision preserves the established v1.51.4 contract rather than inventing new ULL semantics.

### D4 — Backup / restore boundary

The M1 profile validator applies to **new/interactive profile persistence paths**, not exact backup restore.

Exact restore must continue to:

- validate backup/certification integrity through the restore-specific contract;
- preserve legacy/non-canonical aircraft rows when required for exact historical recovery;
- restore protected flight certification fields/hashes without running current profile canonicalization over them.

Any future cleanup of restored legacy profile rows requires a separately designed, additive migration/review path.

### D5 — Certification boundary

M2A/M1 do not change certification payload versions or historical hashes.

Changing which stored flight field a **read-only recency service** consults is separate from rewriting the certified flight.

Regression requirement: existing certification v1–v8 verification remains unchanged.

## 6. Milestone order after independent review

The independent review agreed with the phase direction but identified a sequencing risk: canonicalizing current profile writes before fixing a historical calculation that reads mutable profile data could harden the wrong dependency.

Reconciled implementation order:

1. **M0 — contract & evidence audit** — this document.
2. **M2A — helicopter historical snapshot integrity — DONE** — snapshot-first type resolution + incomplete-evidence compatibility.
3. **M1 — canonical aircraft-profile validation — DONE** — one reusable validator for direct Add/Edit + shared import.
4. **M2B — remaining historical/dynamic applicability verification — NEXT** — preserve documented ULL mapping semantics and audit any remaining current-profile joins.
5. **M3 — heterogeneous no-code onboarding proof.**
6. **M4 — sharing, recovery, measured scale and release closeout.**

## 7. Required regression evidence by milestone

### M2A

- historical helicopter recency is unchanged by later current-profile model edits;
- populated `flight.aircraft_model` wins;
- legacy `flight.aircraft_type` fallback is bounded;
- missing type evidence cannot produce false CURRENT;
- existing certification hashes remain verifiable.

### M1

- ULL / SEP / MEP / SET / TMG-Part-FCL / TMG-Part-SFCL / Glider / Helicopter / Balloon class+group / Other matrix;
- Quick Add and full editor persist equivalent semantics;
- shared import uses the same regulatory rules;
- missing optional share groups remain allowed;
- malformed required share fields fail closed;
- duplicate registration handling remains explicit;
- M1 validator is not used by exact backup/restore.

### M2B

- automatic ordinary ULL→SEP behavior remains unchanged;
- atypical explicit TMG override respects class + effective-from;
- basis/provenance remains required for explicit override persistence;
- no other recency service silently prefers mutable current profile for historical identity.

### M3 / M4

- all supported categories can be onboarded without make/model-specific code;
- catalogue and manual identity paths converge;
- sharing remains recipient-owned copy semantics;
- backup/restore preserves historical/certified evidence;
- deletion/deactivation protections remain;
- performance optimization requires measured evidence;
- desktop/iPad/mobile and light/dark browser verification.

## 8. M0 closeout

M0 is complete when this contract, the updated roadmap and the independent review reconciliation are merged.

No runtime/schema/product behavior change is part of M0.
