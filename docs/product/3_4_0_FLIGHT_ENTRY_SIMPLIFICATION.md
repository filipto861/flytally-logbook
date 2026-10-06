# 3.4.0 — Flight Entry Simplification

**Status:** DONE / PRODUCTION VERIFIED  
**Date:** 5 October 2026  
**Repo:** `flytally-logbook`  
**Branch:** `feat/3.4.0-flight-entry-simplification`  
**Independent review reconciliation:** `docs/product/3_4_0_REVIEW_RECONCILIATION.md`  
**UI matrix:** `docs/product/3_4_0_FLIGHT_ENTRY_UI_MATRIX.md`

## Goal

Reduce routine Manual and GPS flight-entry cognitive load without weakening source provenance, explicit evidence, certification integrity, recency semantics, sharing boundaries or historical record protection.

The common single-flight GPS path should feel like:

**Source → Flight details → Save & certify**

with advanced/regulatory/detail surfaces progressively disclosed.

## Production problems observed

A normal GPS import can currently show:
- entry-mode switch;
- upload/source state;
- GPS-quality warning;
- split controls;
- map and altitude/speed profile;
- Common details;
- per-flight Review card;
- repeated helper/provenance/status copy;
- landing evidence;
- Night / IFR;
- four movement times;
- notes;
- generic “I reviewed this flight” checkbox;
- reviewed-count summary;
- another review/submit action;
- then a second page with another full Logbook-data review and explicit certification action.

The underlying evidence model is valid; the presentation hierarchy is too dense.

## Verified current-state facts

Repository verification after independent review confirmed:

- `certifyFlight` reads the persisted owned flight row, computes `flightCertificationCompliance`, rejects blocking issues, calculates the v8 certification hash from the persisted row and only then updates certification state.
- The post-save page is not merely a confirmation page: it presents the full editable Logbook-data form, workflow status and certification blockers.
- GPS `part_<n>_reviewed` is required by the import server action but is not stored in `flights` and is not part of the certification fingerprint.
- GPS multi-flight creation is already all-or-none transactional for parent flight + track + required connected-crew child rows.
- Manual and GPS create paths already use the canonical flight fingerprint plus PostgreSQL advisory transaction locks and duplicate checks.
- Recency evaluates only flights with `certified_at IS NOT NULL`.
- Public flight sharing resolves only certified flights.
- `purpose_code` participates in the certification payload from certification version 3 onward.
- Training-purpose UI/server applicability is currently not fully unified: the picker is category-aware, while server normalization additionally gates persisted purpose values by role/evidence context. 3.4.0 must remove this UI/server parity gap.

## Non-negotiable boundaries

- GPS-derived values remain advisory and editable.
- Missing, ambiguous or non-applicable evidence remains unavailable or explicit; never invented.
- IFR remains pilot-entered.
- Existing SERA Day/Night and Night-time suggestion authority/provenance remains unchanged.
- Certification remains an explicit pilot action.
- Existing certification hash/version, compliance rules, audit history, correction revisions, sharing gates and recency authority are reused rather than duplicated.
- No historical flight/certification backfill or destructive rewrite.
- Existing Training purpose codes/history remain backward-compatible.
- ULL continues to hide non-applicable Part-FCL/SFCL/BFCL recency purposes.
- No new generic structured Training / practice purpose in 3.4.0.
- No database migration is assumed.

## Phase 1 — Discovery and contract freeze — DONE

Scope:
- inventory effective Manual/GPS sections, fields, validation, save actions and certification dependencies;
- classify visible UI as **KEEP / COLLAPSE / CONDITIONAL / REMOVE-DUPLICATE**;
- map the post-save review page fields against what is already visible before Save & certify;
- audit Training-purpose UI visibility against server persistence rules and move both onto one shared applicability contract;
- freeze exact warning acknowledgement rules;
- characterize Enter-key/default-submit behavior;
- freeze single-flight Save & certify fallback semantics;
- preserve the existing multi-flight atomic draft-save contract.

Acceptance:
- no field disappears merely because it looks optional;
- no UI Training-purpose option can be silently discarded by server normalization;
- no hidden section converts “unset” into an invented zero/default;
- certification summary includes every materially sealed evidence domain without duplicating the whole form;
- no runtime code is changed before this design gate is closed.

## Phase 2 — Information hierarchy

### GPS Source

Default visible:
- uploaded file/source name;
- point count and detected-flight count;
- one concise source state;
- any real GPS-quality warning.

Conditional / progressive:
- split controls hidden for one clean detected flight;
- split editor appears only for multi-flight detection, manual split or ambiguity;
- map + altitude/speed profile live under **Review GPS track**;
- a non-good track-quality warning may auto-open GPS review;
- raw diagnostics stay secondary.

### Flight context

Replace the large Common details block with one compact editable summary.

Always include:
- aircraft registration/type;
- regulatory category / evidence basis;
- role;
- operation / engine where applicable.

Billing may remain visible as a secondary cost summary but is not a substitute for regulatory evidence context.

Per-flight Role/Crew divergence in split imports must remain visible.

### Flight card

Default visible:
- date;
- departure / arrival;
- landings total + Day/Night when applicable;
- Off-block / Takeoff / Landing / On-block;
- Night / IFR when applicable;
- concise Notes affordance;
- any blocking evidence problem.

Repeated helper/provenance/status text should be removed where the value plus one compact source/status cue already communicates the decision.

## Phase 3 — Progressive optional/contextual detail

Collapsed by default:
- additional crew;
- detailed aircraft provenance;
- Training purpose;
- Task / exercise;
- Costs / additional expenses;
- professional context;
- extended movement evidence when not required;
- source diagnostics.

Auto-open when:
- selected role/category makes the section required;
- existing Edit data is populated;
- validation finds a problem;
- the pilot explicitly opens it.

Each collapsed summary must represent actual state, for example:
- Crew: none / instructor name / Actual PIC;
- Training: none / selected purpose;
- Night / IFR: recorded value or explicit unavailable/unset state;
- Costs: not tracked / tracked basis;
- Professional context: none / operator-flight reference.

Collapsed presentation must not synthesize missing values as zero.

### Training purpose

Current catalogue remains unchanged:
1. Aircraft differences training / endorsement
2. Aircraft familiarisation
3. LAPL(A) FCL.140.A refresher training
4. LAPL(H) FCL.140.H refresher training
5. SEP/TMG FCL.740.A refresher training
6. SPL SFCL.160 recency training
7. BPL BFCL.160 recency training

Frozen decisions:
- preserve category applicability filtering;
- ULL continues to hide Part-FCL/SFCL/BFCL recency purposes;
- do not add a generic structured Training / practice marker in 3.4.0;
- ordinary descriptive detail remains in Task / exercise;
- one shared applicability predicate must drive UI visibility and server persistence;
- existing stored/certified purpose values remain visible/preserved even if current applicability changes.

## Phase 4 — Same-page completion and certification

### Single-flight Manual / GPS

Primary explicit action:

**Save & certify flight**

Secondary action:

**Save draft**

Rules:
- missing/default form intent always means **Save draft**, never certify;
- pressing Enter must therefore never certify implicitly;
- Save & certify is available only through an explicit button/action;
- the server first persists the draft using the existing canonical save path;
- certification then re-reads the persisted row and reuses one shared certification helper derived from current `certifyFlight`;
- certification hash is always calculated from the persisted row, never directly from form payload;
- if certification cannot complete after the draft was safely saved, the result is **Saved as draft — not certified**, with the exact blocker shown;
- no automatic retry may create or certify a second flight;
- existing canonical duplicate/advisory-lock protection remains required and gets regression coverage;
- successfully certified records redirect to the normal certified flight detail without another certification click;
- certification failure may redirect to the saved draft with the relevant section opened;
- certified-flight editing remains on the existing correction-revision workflow;
- Save & certify must never send crew/PIC invitations or verification requests automatically.

### Pre-certification summary

Immediately adjacent to the primary action, show a compact summary of what will be sealed:
- date;
- route;
- aircraft registration/type;
- regulatory category / evidence basis;
- role / required crew evidence;
- operation / engine where applicable;
- four movement times;
- landings Day/Night;
- Night / IFR;
- any certification blockers.

Add one concise consequence line:

**Certified flights are locked; later changes are recorded as corrections.**

Do not duplicate the entire form.

### Warning acknowledgement

Remove the generic normal-case “I reviewed this flight” checkbox and its server requirement.

Targeted acknowledgement is required only for a non-blocking GPS-quality warning that the pilot is allowed to accept after visual review.

Do not add another checkbox merely because:
- a touch-and-go was detected — the detected count/value remains visible and editable;
- SERA classification is near the confidence boundary — current logic already fails closed to manual input;
- the aircraft profile needs configuration — that remains a blocker;
- the pilot explicitly changed a split — that deliberate action is itself evidence of review.

If a GPS condition makes key evidence genuinely ambiguous, fail closed or require manual correction instead of hiding the ambiguity behind acknowledgement.

## Phase 5 — Multi-flight behavior

3.4.0 does **not** add direct batch certification.

For multi-flight GPS imports:
- keep the existing all-or-none transactional draft creation;
- primary action is **Save N flights as drafts**;
- no imported part is certified in that action;
- each saved draft remains excluded from recency and public sharing until explicitly certified;
- existing per-part Role/Crew divergence remains visible;
- future batch certification, if desired, is a separate release requiring an all-or-none certification transaction contract.

This avoids introducing transaction-handle/refactor risk into 3.4.0 merely to support an uncommon batch action.

## Phase 6 — Responsive / interaction polish

Verify:
- desktop;
- iPad landscape;
- iPad portrait;
- mobile 390;
- compact mobile / reflow;
- light + dark.

Acceptance:
- materially fewer default-visible sections than production 2.7.0;
- one obvious primary action for the current context;
- no horizontal overflow;
- validation identifies the exact disclosure needing attention;
- pending/disabled states prevent duplicate submit;
- keyboard/focus order remains usable;
- screen-reader status announces save/certification result;
- no raw server errors.

## Phase 7 — Release closeout — DONE

Local release verification on the final candidate:
- TypeScript: **PASS**;
- complete unit/regression suite: **1230/1230 PASS**;
- PostgreSQL core acceptance: **73/73 PASS**;
- production Next.js build: **PASS**;
- targeted authenticated 3.4.0 browser acceptance: **6/6 PASS** across desktop Chromium and mobile Chromium;
- focused responsive Flight Entry smoke: **1/1 PASS**, internally covering desktop 1440, iPad landscape, iPad portrait and mobile 390 in light + dark;
- targeted 3.4.0 source/contract pack: **13/13 PASS**;
- GitHub CI: **NOT RUN by policy**; workflows are manual-only diagnostics.

Production closeout on 5 October 2026:
- PR #240 merged to `main` as `76b57c5674ffcc8c62bfbe73c59974cfde341a7a`;
- merged `package.json` is `3.4.0`;
- Vercel production deployment `dpl_3Zcyq7QmdSGPj1AcSHe2gj2Rn29r` is **READY** on the exact merge SHA;
- deployment carries the `fly-tally.com` alias;
- production runtime logs show successful HTTP 200 responses across authenticated dashboard/flight routes;
- grouped runtime-error check found no errors in the checked post-deploy window;
- production DB remains schema v19;
- certification payload remains v8;
- no historical flight/certification/audit rewrite and no schema migration occurred in 3.4.0.

## Definition of Done

3.4.0 closeout satisfies:
- simplified hierarchy is production deployed;
- single-flight same-page explicit Save & certify is verified;
- Enter/default submit cannot certify;
- Save draft remains valid;
- multi-flight imports remain atomic draft-only;
- generic reviewed checkbox is removed without losing warning-specific evidence;
- Training-purpose UI/server applicability uses one shared contract;
- certification/audit/correction/share/recency authority remains intact;
- responsive light/dark acceptance passes;
- `package.json` and shipped CHANGELOG release heading agree on `3.4.0`; Git tag / GitHub Release must agree when a release tag is used.
