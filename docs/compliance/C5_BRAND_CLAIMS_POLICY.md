# v2.9 C5 — Brand & public claims policy

Status: technical foundation complete; external brand/trademark and claims evidence pending.  
Policy version: `2026-09-18-c5-v1`.

## Purpose

C5 prevents FlyTally product wording from drifting into unsupported legal, trademark, manufacturer or aviation-authority claims.

The canonical runtime policy is `lib/brand-claims.ts`. The public status surface is `/legal/brand-claims`.

## Current brand status

- Product/service brand in use: **FlyTally**.
- No registered-trademark status is claimed.
- The `®` symbol is not allowed by the current policy.
- Trademark registration/clearance status is recorded as **UNVERIFIED** until scope-specific external evidence is obtained.
- A normal web search is not treated as a trademark clearance search and cannot establish availability, registration or freedom to use.

## Public wording currently allowed

Subject to the stated scope:

- **Digital pilot logbook**
- **Electronic pilot logbook**
- **Source-backed aircraft training**
- **Source-backed training and reference aid**
- **FCL.050-style logbook records**
- **FCL.050-style record and export workflow**

These phrases describe product functionality or engineering structure. They do not imply competent-authority, manufacturer or operator approval.

## Claims requiring external evidence

Do not publish a positive claim that FlyTally is:

- EASA approved/certified/endorsed/official;
- ÚCL/Czech CAA approved/certified/endorsed/official;
- LAA ČR approved/certified/endorsed/official;
- manufacturer-approved or operator-approved;
- an official authority logbook;
- guaranteed or fully regulator-compliant;
- an advanced or qualified electronic-signature product;
- a registered trademark, or entitled to use `®`.

If an external approval is later obtained, the evidence must identify the exact approving body, product/version, territory, use case, limitations and effective date. The public claim must not exceed that scope.

## Technical controls

C5 adds:

- an explicit public claim registry;
- automated checks for high-risk positive wording on public entry surfaces;
- a public brand/claims status page;
- an exact policy-version gate;
- a code-level external-evidence gate.

`BRAND_CLAIMS_EXTERNAL_EVIDENCE_VERSION` intentionally remains null. Therefore environment flags such as `COMMERCIAL_TRADEMARK_STATUS` or `COMMERCIAL_MARKETING_CLAIMS_STATUS` cannot by themselves open commercial mode.

## External work still required

Before C5 can be externally cleared:

1. decide the trademark/brand-protection strategy and relevant territories/classes;
2. perform a proper trademark clearance/registration review using the appropriate official registers and, where needed, professional advice;
3. review the intended public marketing/regulatory claims against the actual product and external validation evidence;
4. record the exact reviewed policy/version and evidence scope;
5. only then set the matching external-evidence version in code.

No absence of a search-engine result is treated as proof that the mark is available or unregistered.
