# FlyTally v1.51 — Regulatory correctness core

Baseline: EASA Aircrew rules current at 31 August 2026.

## Implemented legal boundaries
- **FCL.050** remains the logbook record layer. Certified flight revisions and signed verification evidence are not silently mutated by the recency engine.
- **FCL.060(b)** is evaluated only from structured take-off, approach and landing evidence explicitly recorded as pilot flying. ULL / Annex-I credit is not used for this 90-day passenger-currency rule.
- **FCL.140.A** uses certified aeroplane/TMG experience in the rolling two-year window. DUAL and supervised-SOLO experience is accepted only when the current certified revision has instructor-signed evidence.
- **FCL.035(a)(4)** credit for Annex-I / Article 2(8) aeroplanes is opt-in per aircraft, never inferred from `ULL`. The aircraft profile stores target SEP/TMG class, a human-readable basis/reference and a valid-from date. Eligible Czech ULL PIC hours and native ULL start/landing counts may contribute when the aircraft is explicitly qualified in its profile. ULL flights do not satisfy the mandatory FI/CRI refresher element.
- The FCL.035(a)(4) implementation is deliberately conservative: eligible ULL **hours** and the native ULL **start/landing counters** may contribute to FCL.140.A and FCL.740.A. FlyTally does not manufacture movement counts from flight time.
- **FCL.740.A(b)(1)(ii)** requires 12 h, 6 h PIC, 12 take-offs, 12 landings and the refresher/exemption element. FlyTally may show READY but never changes the recorded rating expiry automatically.
- Aeroplane **IR(A)** detection is exact enough to reject instructor certificates such as **IRI(A)**.

## Product principle
The regulatory engine may downgrade confidence when evidence is incomplete, but it must not manufacture missing evidence to produce a green status. `LIMITED DATA` is preferred to a false `CURRENT`.
