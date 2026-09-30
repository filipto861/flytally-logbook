# Flight Entry Workflow 3.0 — F0 Field / Consumer Contract Inventory

**Status:** F0 ANALYSIS COMPLETE · VERIFICATION PENDING  
**Repository baseline:** `main@5dca9b32af8af0d0a76cca1dada6ae27c5446789`  
**Scope:** repository-backed analysis only; no runtime, schema, certification-version, recency-rule or historical-data change.

## 1. Purpose

F0 records the actual semantic contract that exists after F0.1 and before F1 shared normalization.

The inventory answers, for each important flight datum:

- where the value comes from in Manual New/Edit and GPS New;
- whether the value is profile-derived, GPS-derived, pilot-entered or server-derived;
- what Save currently requires;
- what Certification currently requires;
- where the value is persisted;
- whether it is covered by certification hash v1–v8;
- which downstream consumers use drafts versus certified evidence;
- whether the value is common to a multi-part GPS import or per-part;
- which later Flight Entry 3.0 milestone owns any semantic divergence.

This document describes current code. It does not make an incomplete current behavior correct merely by documenting it.

## 2. Write paths and authority

### Manual New / Edit

`components/flight-form.tsx` submits to `createFlight()` / `updateFlight()` in `app/(protected)/flights/actions.ts`.

Both mutations normalize through `parseFlightInput()` in `lib/flight-input.ts`. Expenses are normalized separately by `parseFlightExpenses()`.

Manual create/update therefore already share one parser and one flight-field contract.

### GPS New

`components/kml-import-form.tsx` submits to `importKmlFlight()`.

F0.1 removed the unsafe profile fallback and added a narrow GPS integrity boundary, but GPS still constructs and inserts a smaller semantic flight record directly. It does **not** call `parseFlightInput()`.

GPS is therefore still a second semantic write path. F1 owns convergence.

### Database aircraft-identity snapshot

Migration v6 installs `logbook_snapshot_aircraft_identity()`, a `BEFORE INSERT OR UPDATE OF registration` trigger on `flights`.

On insert / registration change it resolves the current matching aircraft profile and writes:

- `aircraft_make`;
- `aircraft_model` (with `aircraft_type` fallback);
- `aircraft_variant`.

This trigger is currently the final persistence authority for those three identity fields on ordinary Manual/GPS inserts. F1 must treat that trigger as an explicit dependency; it must not accidentally create a competing snapshot rule.

## 3. Field-level contract matrix

Legend:
- **M** = Manual New/Edit.
- **G** = GPS New.
- **Save** = current draft persistence gate, not certification completeness.
- **Cert** = current pilot-certification gate.
- **Hash** = first certification-payload version that covers the field; `—` means the field itself is not hashed.
- **Common / part** describes the current GPS multi-part model.

| Field / semantic group | Manual source | GPS source | Save contract today | Certification contract today | Persistence | Hash | Current important consumers | GPS scope | 3.0 disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `date` | Pilot/default date | Per-part GPS timestamp suggestion, pilot review | M required valid ISO date; G every reviewed part requires valid date | EASA valid date | `flights.date` | v1 | dashboard, statistics/insights, recency, export, print, sharing, duplicate key | Part | Shared normalized field in F1 |
| `registration` | Pilot selects active profile; Edit may retain historical inactive registration | Common selected active aircraft; filename can suggest only an owned registration | Required; G server re-resolves active owned aircraft | Required for EASA | `flights.registration` | v1 | almost all flight consumers; pricing; sharing; tracks | Common | Shared aircraft-context input in F1/F3 |
| `aircraft_type` | Profile-derived when selected; manual fallback only when no active profile is available | Server uses selected active profile | Not intrinsically required by parser | FCL.050 aeroplane/helicopter path requires model or legacy type | `flights.aircraft_type` | v1 | display, identity fallback, export/print, sharing | Common | Server-resolved aircraft snapshot input |
| `aircraft_make` | Not a flight-form field; DB trigger snapshots profile | Same DB trigger | No form gate | Required by current FCL.050 aeroplane/helicopter certification path | `flights.aircraft_make` | v1 | certification, print/export identity, sharing | Common | Keep historical snapshot; explicit F1 dependency on trigger/resolver |
| `aircraft_model` | DB trigger snapshots profile; falls back to type | Same | No form gate | Model or legacy type required in FCL.050 path | `flights.aircraft_model` | v1 | certification, identity, type-specific historical logic, sharing | Common | Historical snapshot |
| `aircraft_variant` | DB trigger snapshots profile | Same | No form gate | No blocking completeness rule | `flights.aircraft_variant` | v1 | certification fingerprint, identity, sharing | Common | Historical snapshot |
| `evidence` | Profile default or explicit valid flight-level value | Canonical selected profile only after F0.1 | Required and canonical | Chooses EASA compliance path; ULL has no FCL/SFCL/BFCL compliance gate | `flights.evidence` | v1 | dashboard/statistics, recency, export/print, category logic, sharing | Common | Canonical normalized context |
| `aircraft_class` | Profile default or explicit valid value | Canonical selected profile only | Required and canonical | Drives category/function rules | `flights.aircraft_class` | v1 | category resolution, recency, dashboard/statistics, certification, sharing | Common | Canonical normalized context |
| `regulatory_category` | Derived from evidence/class except explicit EASA TMG Aeroplane/Sailplane choice | Canonical selected profile | Compatibility with evidence/class enforced | Selects FCL vs SFCL/BFCL certification branch | `flights.regulatory_category` | v5 | certification, dashboard/statistics, print/export, sharing | Common | Canonical normalized context |
| `balloon_class` | Profile-derived hidden context | Canonical profile | Required for Balloon | Required for EASA Balloon | `flights.balloon_class` | v6 | BFCL recency/certification, export/print, sharing | Common | Aircraft context; fail closed |
| `balloon_group` | Profile-derived hidden context | Canonical profile | Required for hot-air balloon | Required A–D for hot-air balloon | `flights.balloon_group` | v6 | BFCL recency/certification, export/print, sharing | Common | Aircraft context; fail closed |
| `balloon_operation` | Pilot enters FREE/TETHERED | Common explicit pilot choice; GPS never infers it | Required for Balloon | Required for EASA Balloon | `flights.balloon_operation` | v7 | BFCL certification/recency, export/print, sharing | Common | Flight-specific; preserve explicit input |
| `launch_method` | Pilot enters for non-TMG sailplane | Currently forced empty | M requires method when launches > 0; G has no equivalent Save field | EASA non-TMG Sailplane requires method | `flights.launch_method` | v5 | SFCL certification/recency, export/print, sharing | Common today by omission | **Parity gap:** F1/F4 source model; UI ownership F3/F4 |
| `launches` | Pilot enters; non-TMG Sailplane Save requires >=1 | Currently forced 0 | M non-TMG Sailplane requires >=1; G does not | EASA non-TMG Sailplane requires >=1 | `flights.launches` | v5 | SFCL certification/recency, export/print, sharing | Common today by omission | **Parity gap** |
| `departure`, `arrival` | Pilot-entered | Per-part airport suggestion + pilot override; may remain blank | Optional at Save | Required for EASA certification in current FCL/SFCL/BFCL paths | `flights.departure/arrival` | v1 | duplicate identity, dashboard/statistics, map, export/print, sharing | Part | Shared per-flight normalized fields |
| `off_block`, `on_block` | Pilot-entered UTC | Per-part GPS envelope suggestion + review | Optional; if entered must be valid and parser enforces block/taxi bounds | FCL aeroplane/helicopter path requires valid UTC pair and positive BLOCK; SFCL/BFCL can certify from credited AIR instead | `flights.off_block/on_block` | v1 | block time, duplicate key, billing, dashboard/statistics, export/print, recency minutes | Part | Shared per-flight normalized fields |
| `takeoff`, `landing` | Pilot-entered UTC | Per-part GPS envelope suggestion + review | Optional; if entered must be valid and AIR cannot exceed known BLOCK + tolerance | SFCL/BFCL can use AIR as credited time; FCL path does not require them separately | `flights.takeoff/landing` | v1 | AIR time, category credit, billing AIR, dashboard/statistics, export/print | Part | Shared per-flight normalized fields |
| `starts` | Derived from landings, legacy starts, or sailplane launches | Per-part reviewed landing count | Bounded; category-dependent derivation | FCL path requires day+night landings == starts; not directly hashed | `flights.starts` | — | legacy movement compatibility, recency fallback, sharing | Part | Derived compatibility field; F1 must define one derivation |
| `landings_day`, `landings_night` | Pilot-adjustable structured counts | G stores all reviewed `starts` as day landings and night=0 | Optional/bounded; Manual generally derives starts from them | FCL path requires sum == starts | `flights.landings_*` | v1 | recency, dashboard/statistics, export/print, sharing | Part | **Source-fidelity gap:** GPS has no day/night classification |
| `movement_evidence_recorded` | Explicit PF checkbox for applicable Part-FCL flights; normal SP PIC/SOLO may be preselected but reviewable | Always FALSE today | Optional explicit evidence | No generic blocking certification requirement | `flights.movement_evidence_recorded` | v4 | FCL.060/recency movement eligibility | Part | **Parity gap:** GPS cannot currently assert PF evidence |
| `takeoffs_day/night` | Explicit PF/SFCL/BFCL counts depending category | Balloon: reviewed takeoffs stored as day; other GPS categories 0 | Category-dependent; current Manual parser does not universally require a positive count | Hashed; category compliance currently does not universally require positive movement counts | `flights.takeoffs_*` | v4 | recency, export/print, sharing | Part | Source/category parity required before widening GPS roles/categories |
| `approaches_day/night` | Explicit when Part-FCL PF movement evidence enabled | Always 0 | Optional evidence | Hashed but not generic certification blocker | `flights.approaches_*` | v4 | FCL.060 recency, sharing | Part | **Parity gap** |
| `operation_type` | Pilot-adjustable SP/MP for applicable categories; parser defaults SP | Forced SP | Canonicalized; not generally Save-required as explicit choice | FCL path requires SP/MP and multi-pilot roles require MP | `flights.operation_type` | v1 | certification, dashboard/statistics, print/export, sharing | Common | F1 must not invent SP where source semantics require MP |
| `engine_type` | Pilot-adjustable SE/ME; class-derived fallback | Class-derived default | Canonicalized | FCL path requires SE/ME | `flights.engine_type` | v1 | certification, statistics/print/export, sharing | Common | Shared normalization |
| `operator_name` | Optional professional context for supported EASA aeroplane/helicopter | Not captured; empty DB default | Optional | No blocking rule | `flights.operator_name` | v8 | detail/sharing/certification fingerprint | Common today by omission | Optional semantic field; F1 should carry without requiring |
| `flight_number` | Optional professional context | Not captured | Optional | No blocking rule | `flights.flight_number` | v8 | detail/sharing/certification fingerprint | Common today by omission | Optional semantic field |
| `operation_context` | Optional but if populated must be canonical and only in supported professional context | Not captured | Invalid populated value rejects M Save | No blocking rule | `flights.operation_context` | v8 | detail/sharing/certification fingerprint | Common today by omission | Optional semantic field |
| `role` | Full canonical role set | PIC only after F0.1; server rejects anything else | Required/canonical | EASA role must be creditable or explicit auxiliary; role drives crew/function requirements | `flights.role` | v1 | function credit, dashboard/statistics, certification, sharing, print/export | Common | F2 owns full source-agnostic Role/Crew parity |
| `commander` | Role-aware; Safety Pilot Actual PIC may be manual or connected display name | Empty for current PIC-only GPS | EASA Safety Pilot requires actual PIC in create/update; ordinary PIC may be blank | EASA certification requires resolvable PIC name; account holder can satisfy applicable self-PIC semantics | `flights.commander` | v1 | certification/print/sharing | Common | F2 role/crew contract |
| `instructor` | EASA DUAL UI marks Instructor/PIC required; other roles optional | Empty | **Current server parser does not independently reject blank DUAL instructor** | EASA DUAL certification blocks without instructor | `flights.instructor` | v1 | certification, training verification, print/sharing | Common | **Confirmed Save boundary gap:** F2 must move rule server-side |
| connected Actual PIC identity | Safety Pilot can select accepted Connection; server rechecks | Unsupported | Separate Save validation for Safety Pilot | Link is not part of certification hash | `flight_connected_crew` + historical `commander` text | — | post-certification PIC invitation/provenance | Common | F2; never infer account from name |
| `verification_name`, `verification_reference` | EASA SPIC/PICUS inline and parser-required | Unsupported | M EASA SPIC/PICUS both required | EASA SPIC/PICUS both required | `flights.verification_*` | v1 | certification, verification, print/export | Common | F2 |
| `pic_minutes`, `copilot_minutes`, `dual_minutes`, `instructor_minutes` | Server-derived from role + credited time | Server-derived with PIC role | Not direct user authority | EASA certification validates allocation against role/credited time | `flights.*_minutes` | v1 | certification, dashboard/statistics, print/export, sharing | Part | F1 shared derived output |
| `night_minutes`, `ifr_minutes` | Optional pilot-entered duration | Not captured; DB defaults 0 | If BLOCK known, cannot exceed it | Cannot exceed BLOCK when applicable | `flights.night_minutes/ifr_minutes` | v1 | dashboard/statistics, certification, print/export, sharing | Part | Optional per-flight semantics; GPS needs explicit future source/override if supported |
| `task` | Optional pilot text, combined with normalized training purpose | Common GPS task field, default "GPS import" | Optional | Can trigger certification warnings/traceability checks | `flights.task` | v1 | certification warnings, recency training evidence, print/export, sharing | Common | F1 carry; F4 decide common/override UX |
| `purpose_code` | Normalized from explicit purpose controls/legacy refresher compatibility | Not captured; DB default empty | Optional/role-filtered | No generic blocker; hashed | `flights.purpose_code` | v3 | recency/revalidation logic, print, sharing | Common today by omission | **Parity/output gap:** canonical record must support it |
| `note` | Optional per-flight note | Per-part reviewed note; import may append review suffix | Optional | Used for certification warning detection/traceability | `flights.note` | v1 | certification, recency text evidence, export/print, sharing | Part | Per-part field |
| `billing_basis` | Profile default may be accepted/changed; Not tracked allowed | Common profile default may be accepted/changed; Not tracked allowed | Invalid stored config must be explicitly resolved; otherwise optional | Not certification evidence | `flights.billing_basis` | — | cost analytics, export, sharing | Common | Commercial metadata outside core regulatory normalization, but one shared persistence rule |
| `price_per_hour` | Server resolves date-effective rate only when billing enabled | Same per-part date-effective server resolution | Derived; nullable/not tracked | Not certification evidence | `flights.price_per_hour` | — | cost analytics, export, sharing | Part result from common billing choice + part date | Preserve server resolution |
| expenses | Optional Manual line items | Unsupported in GPS | Separate parser; max 20 and typed amount/currency validation | Not certification evidence | `flight_expenses` | — | cost UI/analytics/backup | Unsupported | Keep separate child domain; F1 must not silently drop on Edit |
| GPS track / provenance | Optional track attach after flight creation | Source file is mandatory and persisted with each imported flight | GPS import requires credible airborne movement and reviewed parts; Manual flight can exist without track | Not certification evidence/hash | `flight_tracks` / `track_points` | — | map, GPS detail, distance/analytics, sharing copy | Part | Source evidence, not semantic flight identity |
| `certified_at/by`, `certification_hash/version` | Created only by certification action | Same after later certification | Never set by New/Edit/GPS Save | Certification action writes v8 + locks | `flights.*` | metadata | recency gate, sharing gate, verification, audit/output | N/A | Preserve exact current certification boundary |
| `record_revision`, correction metadata | Existing row state | Existing row state | Ordinary draft Save does not increment revision | Correction archives previous certified snapshot then increments revision and clears current certification | `flights`, `flight_certified_revisions` | v2 includes revision/reason | verification, sharing, audit/history | N/A | Frozen historical compatibility |
| lock metadata | Server workflow only | Server workflow only | Locked/certified rows are not editable | Certification locks record | `locked_at/by` | — | mutation guard | N/A | Outside normalized flight payload |

## 4. Certification payload boundary

Current certification payload compatibility is frozen:

- **v1:** identity, route, four times, operation/engine, landings, night/IFR, function times, commander/instructor/role, task/note/verification;
- **v2:** record revision + correction reason;
- **v3:** purpose code;
- **v4:** structured movement evidence, take-offs and approaches;
- **v5:** regulatory category + sailplane launch evidence;
- **v6:** balloon class/group;
- **v7:** balloon operation;
- **v8:** professional operator/flight/operation context.

F1/F2 must not reorder, reinterpret or silently expand old certification payloads.

Important persisted data that is **not independently covered by the v8 hash** includes:

- `starts`;
- billing basis / hourly price;
- expense rows;
- GPS track content;
- connected-account PIC link;
- lock timestamps/actors.

This is a compatibility observation, not an instruction to change the hash.

## 5. Downstream consumer matrix

| Consumer | Drafts visible? | Certified-only? | Relevant contract |
| --- | :---: | :---: | --- |
| Dashboard | ✅ | ❌ | Reads stored evidence/category/class/role/times/landings/function time/cost directly; invalid drafts can affect totals immediately |
| Statistics / Pilot Insights | ✅ | ❌ | Reads stored identity/category/role/times/function/cost directly |
| Map / route analytics | ✅ where flight/track exists | ❌ | Reads registration/evidence/date/route/times plus GPS tracks |
| CSV/XLS export | ✅ | ❌ | Exports stored draft identity and certification marker; current tabular columns omit purpose code, professional v8 fields, movement-evidence flag and approach counts |
| JSON account backup | ✅ | ❌ | Recovery/export boundary is separate and expected to preserve stored records, not re-normalize through current UI |
| Printable logbook | ✅, explicitly marked DRAFT | ❌ | Reads flight snapshot and purpose/verification; output is format-oriented and does not expose every persisted semantic field |
| Certification | draft input only | N/A | Converts a compliant draft into protected v8 evidence |
| Canonical recency service | ❌ | ✅ | Query explicitly requires `f.certified_at IS NOT NULL`; flight snapshot drives historical activity, with explicit current-profile `part_fcl_credit_*` metadata as dynamic applicability |
| Sharing / participation | ❌ source must be certified | ✅ source | Binds invitation to exact `source_revision` + `source_hash`; recipient flight remains independently owned evidence |
| Instructor/supervising verification | ❌ source must be certified/current revision | ✅ | Signature/verification binds exact flight revision/hash |

The key product boundary remains: **draft does not mean regulatory evidence**, but drafts are still real application data and can influence non-regulatory product outputs.

## 6. Repository-backed divergences that F1/F2 must resolve

### A. Two semantic write paths still exist

Manual create/edit use `parseFlightInput()`. GPS still builds a direct INSERT payload.

F1 must converge equivalent PIC records before broader UX simplification.

### B. DUAL Save enforcement is split between UI and server

Manual EASA DUAL renders Instructor/PIC as HTML-required and Certification rejects a missing instructor, but `parseFlightInput()` itself does not reject a crafted DUAL Save without one.

F2 must make the server contract authoritative. Do not rely on browser `required`.

### C. GPS category evidence is intentionally incomplete outside the current PIC baseline

Current GPS lacks source/override semantics for several fields that Manual can store:

- non-TMG sailplane launch method/count;
- ordinary Part-FCL PF movement evidence and approaches;
- TMG explicit movement evidence;
- night/IFR;
- professional context;
- purpose code;
- expenses;
- all non-PIC role/crew/supervision semantics.

The correct F1 response is not to invent defaults. Unsupported semantic data must remain explicit/unavailable until a source or user override exists.

### D. GPS day/night movement fidelity is lossy

Current GPS stores reviewed landings as day landings and, for Balloon, reviewed take-offs as day take-offs. It has no day/night classification boundary.

F1/F4 must not generalize this into authoritative night/day inference.

### E. Aircraft identity has a hidden DB write dependency

Make/model/variant are finalized by the v6 trigger rather than by `FlightInput`.

That is safe for ordinary Manual/GPS inserts when the selected current profile is the intended source, but F1 must explicitly preserve the historical snapshot rule rather than accidentally duplicating or bypassing it.

### F. Shared-flight copy + aircraft identity trigger needs dedicated review

`acceptSharedFlight()` explicitly supplies the certified source flight's make/model/variant, but every flight INSERT also runs `logbook_snapshot_aircraft_identity()`, which overwrites those fields from the recipient's current aircraft profile when a matching registration is visible.

That creates a repository-backed risk that a recipient's mutable current profile can replace source snapshot identity during creation of the participant flight. F0 does **not** change it. It must be resolved before claiming complete Manual/GPS/Sharing snapshot equivalence; this also intersects Multi-aircraft M2B.

### G. Tabular export is not a complete semantic mirror

Current CSV/XLS flight columns do not include:

- `purpose_code`;
- `operator_name`, `flight_number`, `operation_context`;
- `movement_evidence_recorded`;
- `approaches_day/night`.

This is an output-completeness issue, not permission for F1 to drop those fields.

## 7. F1 design contract derived from F0

F1 may begin only with these constraints:

1. Introduce one server-side normalized semantic flight object used by Manual create/update and GPS resolved parts.
2. Keep source evidence separate from semantic flight identity:
   - GPS track/provenance remains child/source evidence;
   - expenses remain child commercial data;
   - connected-account links remain collaboration metadata.
3. Preserve current historical aircraft snapshot behavior. If identity resolution moves out of the DB trigger, migration/backward-compatibility and sharing effects require explicit design review first.
4. Equivalent Manual and GPS **PIC** inputs must produce equivalent semantic flight fields where both sources actually provide the same evidence.
5. No source may create a value merely because another source has a UI field for it.
6. Role/Crew completeness beyond the current GPS PIC boundary belongs to F2; until then unsupported GPS roles remain rejected.
7. Save completeness and Certification completeness remain separate:
   - Draft Save may intentionally permit missing route/time evidence;
   - EASA certification remains the stronger compliance gate.
8. Do not change certification payload v1–v8.
9. Do not rewrite historical rows or infer missing old GPS evidence.
10. Shared-flight identity-trigger risk must be reviewed before F1 closeout, even if its implementation is handled as a tightly scoped integrity fix rather than inside the normalization refactor.

## 8. F1 acceptance evidence

Before F1 is accepted, tests must prove at minimum:

- Manual create and Edit still normalize through the same contract;
- GPS resolved PIC uses that shared contract rather than a handwritten flight INSERT semantic map;
- valid EASA/SEP PIC Manual vs GPS equivalence for common fields;
- valid explicit ULL PIC Manual vs GPS equivalence for common fields;
- malformed aircraft context fails closed;
- unsupported GPS role fails closed;
- optional missing route/time remains a valid draft where current product contract permits it;
- certification requirements remain unchanged for an equivalent stored record;
- function-time allocation remains canonical;
- duplicate/advisory-lock/atomic GPS behavior remains intact;
- v1–v8 certification verification remains regression-covered;
- no historical identity is silently replaced by mutable current profile state.

## 9. Deferred decisions / ownership

| Finding | Owner milestone | F0 action |
| --- | --- | --- |
| Shared normalized flight semantics | F1 | Contract frozen here |
| DUAL server Save requirement | F2 (may require shared validator foundation in F1) | Explicitly recorded |
| GPS Safety Pilot / SPIC / PICUS / other role parity | F2 | Keep rejected |
| Aircraft-context UI simplification | F3 | No F0 UI change |
| GPS common/per-part inheritance | F4 | Current common vs part map recorded |
| GPS day/night and other source-fidelity inputs | F4 / later source capability | Never infer |
| Shared-flight identity trigger risk | Integrity review before F1 closeout; intersects M2B | Must not be lost |
| CSV/XLS semantic completeness | Output/export follow-up | Do not couple to F1 normalization unless required |
| Recency current-profile `part_fcl_credit_*` join | M2B dynamic-applicability audit | Preserve existing explicit effective-dated semantics |

## 10. F0 closeout criterion

F0 is complete when:

- this matrix is reconciled against current code;
- ROADMAP / FEATURES / CHANGELOG / Flight Entry 3.0 contract point to it;
- source-contract tests lock the most dangerous boundaries that F1 must not accidentally change;
- no runtime behavior is changed by F0 itself.

The next implementation milestone is **F1 — Shared normalization / semantic write contract**.
