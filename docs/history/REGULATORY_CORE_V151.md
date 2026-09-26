# FlyTally v1.51.x — Regulatory correctness core

Baseline reviewed against the EASA Aircrew rule set used during development on 31 August 2026. This document describes the **final v1.51.4 implementation carried forward by v1.52**, not the intermediate v1.51.0 behavior.

## Implemented boundaries

- **FCL.050** remains the logbook record layer. Certified flight revisions and signed verification evidence are not silently mutated by the recency engine.
- **FCL.060(b)** passenger currency uses certified EASA pilot-flying movement evidence. ULL / Annex-I experience is not imported automatically into this 90-day passenger-currency rule.
- Modern structured EASA records use explicit take-off, approach and landing counters. An explicit zero remains authoritative.
- Certified EASA records created before the v1.35.3 structured-movement migration can use the bounded legacy compatibility path. Legacy status is determined from record-creation provenance relative to the migration boundary, not from whether the record was edited later.
- **FCL.140.A** uses certified aeroplane/TMG experience in the rolling two-year window. Part-FCL DUAL and supervised-SOLO experience is accepted only with current instructor-signed evidence for the certified revision.
- Eligible certified ordinary **ULL / Annex-I aeroplane PIC experience is automatically treated as SEP experience** for the FCL.140.A experience route. Native ULL starts/landings are used; movement counts are not manufactured from flight hours.
- An internal class override remains available for an atypical Annex-I mapping such as a genuine TMG, but ordinary ULL→SEP credit no longer depends on a user-entered basis/reference or valid-from field and the override is not exposed in the normal Aircraft UI.
- ULL flights do **not** automatically satisfy the mandatory FI/CRI refresher element of FCL.140.A.
- **FCL.740.A(b)(1)(ii)** experience planning requires the applicable flight time/PIC experience, 12 take-offs, 12 landings and the refresher/exemption element. Eligible ULL PIC experience can support the experience route, but ULL does not replace the FI/CRI refresher requirement.
- FlyTally may show a readiness/planning state but never changes a saved rating validity automatically.
- Aeroplane **IR(A)** detection is exact enough to reject instructor certificates such as **IRI(A)**.
- Recency **Evidence detail uses the same eligibility logic as the calculation**. A valid flight that does not contribute to a requirement is not shown as a confirmed contributor to that requirement.

## Product principle

The regulatory engine may downgrade confidence when evidence is incomplete, but it must not invent evidence merely to produce a green status. `LIMITED DATA` is preferred to a false `CURRENT`.

Legacy compatibility is therefore intentionally narrow: it exists to preserve trustworthy historical records across schema evolution, not to weaken the structured-evidence model for new flights.

## Scope note

FlyTally is an electronic logbook and planning/evidence aid. These implementation notes do not constitute authority approval and do not override the pilot's licence, applicable regulation, competent-authority interpretation or underlying source records.
