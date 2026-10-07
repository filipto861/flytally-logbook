# 3.5.2 — Always-on GPS/SERA Night suggestions

**Status:** ACTIVE  
**Owner:** Filip Točík  
**Date:** 7 October 2026  
**Repo:** `flytally-logbook`  
**Branch:** `fix/3.5.2-always-on-night-suggestions`  
**Production baseline:** `3.5.1`

## Trigger

The account-level **Night definition** preference is no longer desired. Automatic GPS/SERA Night suggestions should be a product behavior, not an opt-in user preference.

## Current implementation

Before 3.5.2:

- Settings exposes **Night definition** with `MANUAL` and `SERA`;
- `user_settings.preferences_json.night_definition` gates GPS Day/Night landing suggestions and GPS Night-time suggestions;
- the New flight page reads that preference and passes it into the GPS import form;
- the civil-twilight algorithms themselves already fail closed when evidence is missing, ambiguous or unsupported;
- suggested values remain editable and manual edits are sticky.

## Frozen contract

1. Remove **Night definition** from Settings.
2. GPS imports always attempt the existing SERA-based suggestions when the selected flight context supports them.
3. Do not broaden applicability:
   - Day/Night landing suggestion only when canonical source requirements use `DAY_NIGHT`;
   - Night-time suggestion only when canonical source requirements expose Night/IFR review.
4. Keep the existing SERA model unchanged:
   - geometric Sun-centre altitude = -6°;
   - ±0.5° confidence guard;
   - explicit UTC/offset evidence requirements;
   - existing sparse-gap and track-integrity fail-closed behavior.
5. Automatic values remain advisory and pilot-editable.
6. Manual Day/Night and Night-time edits remain sticky.
7. If the GPS evidence is unavailable or ambiguous, do not invent a value; manual entry remains available.
8. IFR remains manual.
9. Existing persisted `night_definition` keys are legacy compatibility data only. Runtime ignores them. No migration or bulk rewrite is required.
10. No DB schema change, certification payload change or historical flight rewrite.

## Implementation scope

Expected runtime changes:

- `app/(protected)/profile/page.tsx`
  - remove Night definition control and related normalization;
- `app/(protected)/profile/actions.ts`
  - stop actively persisting/updating the Night-definition preference from Settings;
- `app/(protected)/flights/new/page.tsx`
  - stop reading account Night-definition preference;
- `components/kml-import-form.tsx`
  - remove the NightDefinition prop;
  - gate SERA suggestions only by canonical flight-context applicability;
- compatibility helper code may remain if other historical consumers still require it, but must not control active flight-entry behavior.

## Acceptance criteria

- no Night-definition selector is visible in Settings;
- an account with legacy `night_definition=MANUAL` gets the same GPS/SERA suggestions as an account with legacy `SERA`;
- Day/Night and Night-time suggestions remain context-applicable only;
- 3.4.1 unavailable reason/diagnostic behavior is unchanged;
- pilot-edited values are never overwritten by recomputation;
- no inferred Night time from a NIGHT landing;
- no change to IFR behavior;
- no schema/certification/history change.

## Verification

Required before merge:

- targeted 3.5.2 source/behavior tests;
- existing 3.4.1 Night-time reliability tests;
- existing GPS Day/Night suggestion tests;
- Settings regression;
- TypeScript;
- full unit/regression suite;
- production build;
- DB/PostgreSQL migration: N/A.

## Do not

- make unavailable evidence look like zero;
- relax the civil-twilight or track-quality guards;
- auto-convert IFR;
- add aircraft-specific heuristics;
- migrate or rewrite historical flights;
- silently change certification payload semantics.
