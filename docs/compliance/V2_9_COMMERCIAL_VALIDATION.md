# FlyTally v2.9 — Commercial & External Validation

Status: implementation in progress  
Scope: shared FlyTally commercial-launch boundary across Logbook and Training.

## Objective

v2.9 does not declare FlyTally legally or regulatorily approved. It converts the external-launch work into an explicit, fail-closed engineering contract so that later billing, public marketing and authority-facing claims cannot be enabled accidentally.

The release remains split between:

- **technical controls we can implement and regression-test now**, and
- **external decisions/approvals that must be supplied by the appropriate human authority, lawyer, provider or regulator.**

## C1 — Commercial launch contract

The canonical launch state is owned by FlyTally Logbook because it also owns the canonical legal centre.

Allowed requested stages:

- `private-beta`
- `external-validation`
- `commercial`

The default is `private-beta`. An invalid value fails closed to the private-beta behavior.

Requesting `commercial` is not sufficient. The effective stage becomes commercial only after every required gate is explicitly cleared **and** the final commercial legal surface has been implemented in code. C1 deliberately keeps that code gate closed, so even a fully cleared external ledger remains `external-validation` until C2 replaces the private-beta terms with the externally reviewed commercial surface.

### Approval-required gates

These may only be cleared with `APPROVED`:

- formal operator/controller identity;
- jurisdiction-appropriate legal review;
- consumer-law, cancellation/refund and ADR review;
- privacy, DPA/subprocessor and international-transfer review;
- Training source/publication-rights review;
- operational DSAR/incident/security/content-report readiness;
- commercial-policy approval;
- final commercial terms published.

### Decision-required gates

These must be resolved, but `NOT_REQUIRED` is valid when the reviewed product scope genuinely does not require the capability:

- billing/subscription model;
- electronic-signature/QES strategy;
- ÚCL/LAA or other regulator-validation strategy;
- trademark/brand-protection strategy;
- marketing/regulatory claims.

`PENDING`, missing values and unknown values never clear a gate.

## Engineering boundary

`lib/commercial-readiness.ts` is the canonical server-side launch gate.

Future paid-plan, checkout, commercial-marketing or authority-approval features must call this boundary rather than infer readiness from the existence of pricing UI, environment variables, deployed routes or beta usage.

The public legal centre may display the effective release stage, but it must not expose the internal validation checklist or represent an environment flag as legal/regulatory approval.

## C2–C6 planned sequence

- **C2 — Commercial legal/consumer structure:** final Terms architecture, withdrawal/cancellation/refund and ADR surfaces after lawyer-reviewed policy decisions.
- **C3 — Billing:** provider and subscription model only after the commercial model is chosen; entitlement logic must remain product-agnostic across Logbook/Training.
- **C4 — Signatures & regulator validation:** determine whether current attestations are sufficient and whether advanced/QES or authority-specific workflows are actually required.
- **C5 — Brand & claims:** trademark decision, marketing claim registry and explicit authority-approval wording.
- **C6 — Commercial release audit:** technical regression, external evidence checklist and one deliberate transition from external-validation to commercial.

## Non-goals of C1

- choosing a payment provider;
- inventing prices or subscription tiers;
- claiming lawyer, ÚCL, LAA, EASA or trademark approval;
- treating a boolean/environment value as evidence of an external approval;
- publishing commercial terms before they have been externally reviewed.
