---
name: flight-integrity
description: Apply to flight record creation, editing, quick add, audit history, shared flights, GPS imports, roster/role data, profile facts and persistent flight correctness in FlyTally Logbook.
---
# Flight Data Integrity

## When to load
Any change to canonical flight input, normalization, persistence, derivations, finalized flights, role assignment, flight sharing, import or public flight views.

## Procedure
1. Inspect current code and schema for Create, Edit and Quick Add, plus server endpoints/services, validators, affected tests and any relevant ROADMAP decision. Do not assume an older source contract is still active.
2. Map each input's representation: omitted (preserve), explicit null (clear), supplied value (set), invalid (reject). Distinguish unknown from zero; do not convert unknown into false or 0.
3. Ensure every flight-entry surface observes the same canonical invariants, timezone/duration rules, aircraft/type prerequisites and mutually exclusive combinations. Validate again on the server, not just in the client.
4. Guard authorization and ownership; protect finalized records through append-only/auditable correction rather than silent rewrite.
5. Treat a shared flight as one event with independent participant evidence; never silently promote another participant's claims to regulatory credit.
6. Reconcile imported GPS/track data with user-entered values explicitly. Never auto-apply unverified inferred pilot role, aircraft, airport or flight time.
7. Enumerate valid/invalid/partial input, concurrent edits, empty values, zero, duplicates, timezone boundary and backward-compatibility cases.

## Hard stops
No synthetic compliant flight evidence, no forced inference of regulatory credit, no auto-prefill of last aircraft/airport without owner approval, no destructive production data action, no exposed private flight/GPS data.

## References and verification
Read ARCHITECTURE.md, DEVELOPMENT.md, related lib/app validators and tests; follow affected release risk plan. Run targeted parser/domain tests and auth/DB/browser evidence if selected. Record exact SHA and gates: PASS, FAIL, PARTIAL, NOT RUN or N/A.