# Independent Review Handoff — Flight Entry Follow-up E1

Please perform a read-only independent review. Do not implement.

Repository: `filipto861/flytally-logbook`
Baseline: `main@ee6b1d215d803aab3e4d2af12b41d61ddea06fee`
Design: `docs/product/FLIGHT_ENTRY_FOLLOWUP_E1_DESIGN.md`

## Requested product changes

1. Aircraft profile should optionally define the normal SP/MP value.
2. GPS import should stop writing `Task = GPS import`, and historical labels should be cleaned safely.
3. GPS should suggest Day/Night landing counts automatically when actual event time/location supports deterministic civil-twilight classification.
4. Intelligent `Continue from …` assistance must not break Route field alignment.

## Draft architecture

### Operation
- additive nullable `aircraft.default_operation_type` = SP / MP / NULL;
- default only, never aircraft authority;
- no historical/profile backfill;
- New Manual/GPS preselect it;
- per-flight override remains available;
- Edit/SNAPSHOT uses stored flight value;
- NULL means explicit flight choice, not current generic SP fallback.

### Task
- remove GPS Task field/default;
- new GPS imports persist empty Task;
- `task` is in certification payload v1–v8, so raw certified-row cleanup is prohibited;
- draft exact-value cleanup may be possible only after account-scoped census + backup + explicit approval.

### Day/Night
- SERA Article 2(97): night = end evening civil twilight to beginning morning civil twilight; civil twilight threshold is solar centre -6 degrees;
- no daily external database needed for GPS because track provides event UTC + coordinates and airport catalogue provides coordinates as fallback/reference;
- classify every detected T&G/final landing event;
- suggestion only, pilot review remains explicit;
- missing source data => unavailable/manual;
- no overwrite after user edits;
- initial scope GPS-only.

### Route UX
- move continuation/return-leg suggestion out of individual Departure/Arrival labels;
- render one dedicated full-width assistance row below aligned route fields;
- explicit action remains required.

## Critical repository evidence

- Manual currently defaults Operation to SP even without profile evidence.
- GPS intentionally requires explicit Operation/Engine and resets them on aircraft selection.
- aircraft profile already owns default Role/billing but no operation default.
- `task` is included in `flightCertificationPayload()` remarks for certification v1 onward.
- certified corrections preserve the previous certified snapshot before reopening the row.
- GPS review already has exact detected T&G and landing event indices/timestamps/coordinates.
- airport catalogue contains lat/lon/country.

## Please challenge

1. Is nullable profile SP/MP the correct model, or should operation remain entirely per-flight?
2. Is removing the current generic Manual SP fallback safe and consistent with fail-closed rules?
3. Which aircraft share/import/backup paths must carry the new default?
4. Is any direct cleanup of certified `task='GPS import'` defensible? If not, confirm the correction/re-certification boundary.
5. Is solar-altitude < -6° the correct pure classification boundary for the intended EASA/SERA suggestion?
6. Should event coordinate or arrival-aerodrome coordinate be primary for final landing?
7. Are there polar/twilight/no-solution edge cases or numerical-boundary concerns that require an explicit UNKNOWN band?
8. Is the route-assistance full-width row the lowest-risk alignment fix?
9. Identify any certification, recency, sharing, historical-snapshot or accessibility regression risk omitted from the draft.

Return:
- APPROVE / APPROVE WITH CHANGES / REJECT;
- findings ordered by severity;
- exact contract/test changes;
- no code implementation.
