# Flight Entry Workflow 3.0 — F6 Browser / Responsive / Production Closeout

**Status:** LOCAL VERIFIED · FINAL PR / CI / MERGE / PRODUCTION CLOSEOUT PENDING  
**Runtime baseline:** F5 DONE / LOCAL VERIFIED on `feat/flight-entry-f5-primary-ux`  
**Scope:** final browser/responsive acceptance, PR/CI, merge, production deployment and smoke.  
**Runtime behavior changes in F6:** none planned.

## 1. Goal

F6 is the final acceptance phase for Flight Entry Workflow 3.0.

It does not add flight semantics. It proves that the already-converged Manual/GPS workflow remains usable across the required role/source states and cockpit/mobile presentation envelope, then closes the branch through CI and production verification.

## 2. Frozen required presentation envelope

Every F6 matrix state is exercised in:

| State | CSS viewport |
| --- | --- |
| Desktop | 1440 × 900 |
| iPad landscape | 1024 × 768 |
| iPad portrait | 768 × 1024 |
| Mobile | 390 × 844 |
| Compact mobile | 320 × 800 |
| 200% reflow equivalent | 720 × 450 |

The 720 × 450 state represents the CSS layout viewport produced by a 1440 × 900 window at 200% browser reflow.

Every presentation state runs in:
- Light;
- Dark.

The gate requires zero document-level horizontal overflow.

## 3. Frozen role/source coverage

### Manual
- PIC;
- DUAL;
- Safety Pilot — Manual Actual PIC;
- Safety Pilot — accepted Connection;
- SPIC;
- PICUS.

Required evidence:
- role-required identity is visible inline;
- required cues remain required;
- Safety Pilot Manual/Connection selector remains explicit;
- normal PIC does not expose role-required identity controls;
- primary Save & review action remains available;
- no horizontal overflow.

### GPS single-flight
- PIC;
- DUAL;
- Safety Pilot — Manual;
- Safety Pilot — accepted Connection.

Required evidence:
- GPS role allowlist stays exactly PIC / DUAL / SAFETY PILOT;
- no F6 widening to SPIC/PICUS;
- common DUAL Instructor/PIC remains inline;
- Safety Pilot identity remains explicit;
- review card remains usable;
- no horizontal overflow.

### GPS multi-part
- common inherited DUAL;
- complete per-flight connected Safety Pilot override;
- Reset to common remains visible;
- common and override summaries remain readable;
- no horizontal overflow.

### Invalid profile
- Manual invalid profile;
- GPS invalid profile;
- Needs configuration remains explicit;
- Open Aircraft recovery remains available;
- mode switching does not cross-wire or hide the unresolved state.

## 4. Existing evidence reused rather than repeated

F6 does not repeat expensive gates without reason.

Current runtime-equivalent evidence from F5:
- focused F5 source/reconciliation: 16/16 PASS;
- full unit/regression: 1151/1151 PASS;
- TypeScript PASS;
- production build PASS;
- authenticated F5 browser: 2/2 PASS.

Existing earlier workflow evidence also remains valid for specialized persistence/atomicity:
- F4.3 PostgreSQL connected Safety Pilot: 5/5 PASS;
- F4.3 authenticated browser: 3/3 PASS;
- F4.4 responsive override closeout: 1/1 PASS;
- F2.5 role matrix and earlier browser role semantics remain retained regression coverage.

Because F6 adds only E2E/source-contract/docs coverage before PR, a new local production build is not required unless runtime code changes after this point. Final PR CI will execute the repository's release gates.

## 5. F6 implementation

Added:
- one shared F6 presentation viewport list in `e2e/public-shell.spec.mjs`;
- Manual full role/mode matrix;
- GPS single-flight role matrix;
- GPS multi-part inheritance/override matrix;
- Manual + GPS invalid-profile recovery matrix;
- focused source contract `tests/v360-flight-entry-f6-closeout.test.ts`.

No application component, parser, normalizer, server action, persistence, DB schema, certification payload or recency code is changed by F6 staging.

## 6. Verification sequence

### Local focused gate
1. `tests/v360-flight-entry-f6-closeout.test.ts`
2. authenticated Playwright `--grep "F6"`

If those pass and no runtime file changes:
- do not rerun the already-clean F5 full suite/build locally solely because E2E/docs changed;
- open final PR against `main`;
- require all GitHub CI checks PASS.

### Final closeout
After CI PASS:
1. merge PR to `main`;
2. verify exact production deployment SHA;
3. verify production domain alias;
4. smoke public root, login and protected New Flight route;
5. check immediate Vercel runtime errors;
6. update ROADMAP / FEATURES / CHANGELOG / canonical contract to DONE / PRODUCTION VERIFIED.

## 7. Fail-closed / deferred boundaries

F6 must not:
- widen GPS roles beyond PIC / DUAL / Safety Pilot;
- invent SPIC/PICUS split-record countersignature inheritance;
- change Manual RoleCrew semantics;
- change aircraft authority;
- change certification completeness;
- infer identity from names;
- change DB/schema/certification versions;
- change historical records.

The open SPIC/PICUS GPS countersignature-reference inheritance decision remains deferred outside the closed F4/F5/F6 implementation scope unless new product evidence reopens it.

## 8. Acceptance

F6 local acceptance is **complete**:
- focused source contract **6/6 PASS**;
- authenticated F6 browser matrix **4/4 PASS**;
- required desktop/iPad/mobile/320/200%-reflow states exercised in Light + Dark with shared zero-horizontal-overflow assertions;
- required Manual/GPS/invalid-profile states remained explicit;
- no runtime behavior changed during F6.

F6 is DONE only after:
- final PR CI PASS;
- merge to `main`;
- production deployment READY for the exact merge SHA;
- production smoke PASS;
- immediate runtime-error check clean;
- required documentation synchronized.
