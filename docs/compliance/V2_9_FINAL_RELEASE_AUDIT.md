# v2.9 C6 — Final commercial release audit

Audit version: `2026-09-18-c6-v1`  
Technical status: **IMPLEMENTED**  
Current commercial-launch verdict: **BLOCKED**

This is the canonical engineering audit for the v2.9 Commercial & External Validation track. It distinguishes completion of the technical release controls from actual authorization to launch commercially.

## Current result

The FlyTally v2.9 technical foundation C1–C6 is implemented.

Commercial launch is intentionally **not cleared**. The current code contains hard fail-closed blockers that cannot be bypassed by setting environment variables:

- C2: the lawyer-reviewed commercial legal content version is still null;
- C3: a real payment-provider runtime, checkout, lifecycle synchronization and customer self-service are not implemented;
- C4: the regulatory external-evidence version is still null;
- C5: the brand/claims external-evidence version is still null;
- C6: the final commercial-release external-evidence version is still null.

The C1 external-validation ledger may also contain unresolved operator, legal, privacy, source-rights, support, commercial-policy, signature/regulatory, trademark or marketing-review decisions. Environment values record decisions but are not evidence by themselves.

## Canonical audit model

`lib/commercial-release-audit.ts` aggregates six sections:

1. C1 — Commercial launch contract & external validation ledger
2. C2 — Commercial legal & consumer publication
3. C3 — Billing & entitlement runtime
4. C4 — Signature & regulatory validation
5. C5 — Brand & public claims
6. C6 — Final commercial release audit

Each section has two independent concepts:

- **foundation = IMPLEMENTED** — the technical release control exists;
- **releaseReady** — the real launch requirement is actually satisfied.

The audit verdict is:

- `BLOCKED` — one or more release gates remain unresolved;
- `READY_FOR_TRANSITION` — every release gate is clear, but the service is still in `external-validation`;
- `CLEARED` — every release gate is clear and the deliberately deployed stage is `commercial`.

## Deliberate two-step commercial transition

FlyTally must not jump from an incompletely validated beta directly into commercial operation.

The intended release sequence is:

1. keep `FLYTALLY_LAUNCH_STAGE=private-beta` or `external-validation`;
2. obtain and record the required external legal, processor, source-rights, operational, regulatory and brand/claims evidence;
3. implement the chosen commercial billing runtime and reviewed legal content;
4. commit exact C2/C4/C5/C6 evidence/content versions into code;
5. set the matching reviewed environment decision/version values;
6. deploy while still in `external-validation`;
7. verify the canonical C6 audit reports `READY_FOR_TRANSITION`;
8. run the full CI/release gate and production readiness checks;
9. make a separate deliberate deployment changing only the launch stage to `commercial`;
10. verify the audit reports `CLEARED` and production observability is clean.

A release must not proceed if the audit is `BLOCKED`.

## Production build guard

`next.config.ts` invokes `assertCommercialProductionBuildSafe(process.env)`.

If a production build requests `FLYTALLY_LAUNCH_STAGE=commercial` while the canonical launch gate is not clear, the build throws and fails before deployment. Private-beta and external-validation builds remain allowed.

This means an accidental Vercel environment change to `commercial` cannot silently bypass C1–C6.

## Visibility

- Public: `/legal/release-status` shows only the high-level release state and never exposes the internal validation ledger.
- Administrator: the Logbook Administration page shows the detailed C1–C6 sections and blocker IDs.

## Training boundary

FlyTally Training does not own a second commercial-launch state. Its deployment, content governance, source provenance and readiness remain independently testable, while the shared commercial release decision is canonical in Logbook.

## C6 conclusion

C6 is technically complete.

v2.9 engineering work is therefore complete, but this document is **not** a statement that FlyTally is commercially, legally, regulatorily or trademark cleared. Until the external evidence and commercial runtime requirements above are actually completed, the correct production state remains private beta / external validation.
