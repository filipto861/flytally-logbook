# 3.4.0 — Flight Entry UI matrix

**Status:** Phase 1 frozen  
**Date:** 5 October 2026  
**Basis:** current `FlightForm`, `KmlImportForm`, flight-detail review/certification page and independent-review reconciliation.

This matrix controls what may be removed from default view. It does not change persistence authority by itself.

| Surface | Decision | Default presentation | Safety / authority rule |
| --- | --- | --- | --- |
| Entry source mode | KEEP | One Manual/GPS choice at New Flight level | Never silently switch source |
| GPS uploaded file/source | KEEP | Visible | Source/provenance cue |
| GPS quality warning | KEEP | Visible when present | Cannot be hidden by progressive disclosure |
| GPS split editor | CONDITIONAL | Hidden for one clean flight; shown for multi-flight/manual split/ambiguity | Split remains explicit and editable |
| GPS map/profile | COLLAPSE | `Review GPS track` | Auto-open when GPS evidence needs review |
| Aircraft registration/type | KEEP | Compact Flight context summary | Part of certified identity |
| Regulatory category / evidence basis | KEEP | Compact Flight context summary | Must remain visible even when context controls collapse |
| Role | KEEP | Compact context + flight detail | Certification/function-time authority |
| Operation / Engine | CONDITIONAL | Compact context; controls open when required/missing | Never infer missing required value |
| Billing / cost share | COLLAPSE | Secondary context/cost detail | No regulatory authority |
| Additional crew | COLLAPSE / CONDITIONAL | Closed unless required/populated/problematic | Required DUAL/SPIC/PICUS/Safety Pilot evidence auto-opens |
| Date / route | KEEP | Flight details | Certification fingerprint inputs |
| Off-block / Takeoff / Landing / On-block | KEEP | Flight details | UTC evidence; remain editable before certification |
| Landings Day/Night / category movement evidence | KEEP / CONDITIONAL | Relevant fields only | Missing ≠ zero; category capability contract controls visibility |
| Night time | CONDITIONAL | Visible where applicable; otherwise truthful summary | GPS/SERA remains advisory |
| IFR time | CONDITIONAL | Visible where applicable; otherwise truthful summary | Always pilot-entered |
| Touch-and-go detection | CONDITIONAL | Concise cue when detected | Editable landing count; no extra generic acknowledgement |
| Training purpose | COLLAPSE | Optional details | Shared UI/server applicability; ULL regulatory filtering preserved |
| Task / exercise | COLLAPSE | Optional details | Free-text descriptive detail |
| Professional context | COLLAPSE | Optional details | Existing applicability contract |
| Notes | COLLAPSE / concise affordance | Optional unless populated | Preserve text exactly |
| Generic “I reviewed this flight” | REMOVE-DUPLICATE | Removed in Phase 5 | Server gate removed in same change; warning-specific acknowledgement only where justified |
| Pre-certification summary | KEEP | Adjacent to Save & certify | Shows materially sealed evidence + blockers |
| Save draft | KEEP | Secondary/default submit | Enter/default intent never certifies |
| Save & certify | KEEP | Explicit primary action for eligible single flight | Reuses persisted-row certification authority |
| Multi-flight Save & certify | NOT APPLICABLE in 3.4.0 | Draft-only batch save | Existing atomic draft creation retained |
| Post-save second certification click | REMOVE-DUPLICATE for successful single-flight Save & certify | Direct to certified detail | Draft fallback still opens editable review when certification fails |

## Warning acknowledgement contract

A targeted acknowledgement is permitted only for a **non-blocking GPS-quality warning** that the pilot can validly accept after visual review.

No extra acknowledgement is added for:
- detected touch-and-go events;
- SERA cases that already fall back to manual/unavailable;
- invalid aircraft/profile configuration;
- an explicit manual split/edit.

Those conditions are either directly edited, blocked, or fail closed.

## Pre-certification blocker mapping

- Aircraft/profile/regulatory context → open Flight context.
- Required crew evidence → open Role/Crew detail.
- Missing/invalid route/time/movement evidence → focus Flight details.
- Non-blocking GPS-quality warning without acknowledgement → open Review GPS track.
- Certification compliance blocker → name the exact affected evidence; never return a raw server error.
