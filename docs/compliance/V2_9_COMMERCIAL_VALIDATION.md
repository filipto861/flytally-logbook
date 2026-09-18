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

Requesting `commercial` is not sufficient. The effective stage becomes commercial only after every required gate is explicitly cleared **and** the exact commercial legal bundle committed in code is the same version that was externally reviewed and explicitly published.

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

## C2 — Commercial legal / consumer publication structure

C2 is technically implemented as a versioned, fail-closed publication boundary.

The required bundle contains five artifacts:

- Commercial Terms;
- Pricing & billing disclosure;
- Cancellation & refunds;
- Withdrawal rights;
- Dispute resolution / ADR.

The public `/legal/commercial` page exposes only the fact that these documents are not yet effective and describes the required document set. It does not expose the internal validation ledger or invent the missing legal substance.

Publication requires an exact version chain:

1. `COMMERCIAL_LEGAL_BUNDLE_VERSION` — the intended candidate;
2. the commercial content version actually committed in code;
3. `COMMERCIAL_LEGAL_REVIEWED_VERSION` — the exact version externally reviewed;
4. `COMMERCIAL_LEGAL_PUBLISHED_VERSION` — the exact version deliberately released.

All four must match. C2 intentionally leaves the committed commercial content version empty because lawyer-reviewed content does not yet exist. Therefore commercial mode remains blocked even if somebody incorrectly fills only environment variables.

The current Private beta terms remain the only effective Terms until that exact reviewed bundle is committed and published.

## C3 — Billing & entitlements foundation

C3 separates **access entitlement** from **payment processing**.

The canonical entitlement authority is FlyTally Logbook. It owns a durable PostgreSQL ledger whose grant sources are deliberately provider-neutral:

- `billing`;
- `organization`;
- `manual`.

Each durable grant is bound to the account, entitlement key, stable external reference, validity window and revocation state. A future Stripe, Paddle or other adapter may write billing grants, but provider identifiers do not enter Training or the entitlement contract itself.

Current private-beta and external-validation users receive `logbook.access` and `training.access` from the release-stage policy. Administrators retain operational access independently. Once the effective stage becomes commercial, an ordinary user receives no automatic beta grant and therefore requires a durable entitlement.

Cross-product identity moves from `ft1` to `ft2`. The short-lived signed assertion carries entitlement version 1 plus the resolved grants. Training validates the snapshot, requires active `training.access`, and persists the snapshot into its own signed session. Time-bounded grants remain time-bounded inside Training.

Settings exposes the current Access & billing state to the user. C3 does not collect payment data and does not invent pricing, plan names, renewal cadence, trial length or checkout behavior. `commercial-billing-runtime` remains an explicit code blocker, so the commercial launch gate cannot open until a real provider integration implements checkout, entitlement lifecycle synchronization and customer self-service.

### C3 still externally/business dependent

The technical entitlement foundation is complete. The following remain intentionally undecided until the commercial model is chosen:

- payment provider;
- actual subscription plans and prices;
- tax/VAT/payment configuration;
- checkout and customer-portal UX;
- webhook/provider adapter implementation;
- exact mapping from purchased products to entitlement grants.

## C4–C6 planned sequence

- **C4 — Signatures & regulator validation:** determine whether current attestations are sufficient and whether advanced/QES or authority-specific workflows are actually required.
- **C5 — Brand & claims:** trademark decision, marketing claim registry and explicit authority-approval wording.
- **C6 — Commercial release audit:** technical regression, external evidence checklist and one deliberate transition from external-validation to commercial.

## Non-goals of C1/C2/C3

- choosing a payment provider;
- inventing prices or subscription tiers;
- claiming lawyer, ÚCL, LAA, EASA or trademark approval;
- treating a boolean/environment value as evidence of an external approval;
- publishing commercial terms before they have been externally reviewed.
