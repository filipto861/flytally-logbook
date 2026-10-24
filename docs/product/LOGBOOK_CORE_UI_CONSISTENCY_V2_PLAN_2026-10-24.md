# Flight Entry First — FlyTally Logbook UI/UX roadmap adjustment

**Date:** 2026-10-24 · **Status:** owner-approved PRIORITY, **source-level C0 discovery / visual acceptance NOT RUN**, Draft #404 (docs-only)
**Canonical verified base:** `filipto861/flytally-logbook` `main@e58c49d810cc53a25ca1ab553f9c3f720a4e6f6a`
**Production baseline:** Vercel `filipito/logbook` `dpl_DrHNSRTuXbuLbLdk38MJ9PpQjUnm` READY for `5e75b68c42a3a0697a2ff395e6c4eb4d35eb89bc`. Newer main is documentation/advisory Design Quality V2 only.

## Owner's FINAL priority for the UI/UX workstream

**P0 product emphasis: routine flight entry in the Logbook.** Start with `/flights/new` **Manual entry**, then verify consistency with editing a saved flight (`/flights/[id]`) and the contextual quick aircraft add. Pilots should enter a normal flight quickly and confidently, understand where required data belongs, distinguish draft from certification, recover from error, and never hunt for a control on iPad/mobile. Existing Apple-inspired FlyTally identity, date/time/role/evidence rules and pilot agency stay authoritative.

**P1 after flight-entry acceptance:** Flights list/detail navigation, Dashboard, Aircraft, Statistics, Settings and shared shell/component consistency. These are explicitly secondary, not equal first milestones.

**Deferred:** GPS-specific N3-M3 multi-part editor and other GPS UX; separate read/parse feedback [Draft #403](https://github.com/filipto861/flytally-logbook/pull/403) stays **paused**, unmerged and undeployed. Older UI Drafts #377–#380 remain unrelated; branches #378/#379/#380 diverged from current main by approximately 235 intervening main commits, so their source and tests are only historical inputs to a fresh-main audit.

Earlier in this same Draft #404 the proposed C0 scope put five general pages ahead of Manual New Flight. This explicit owner clarification **supersedes that ordering**. Do not interpret it as an approval for rewriting form semantics, merging, deployment, SQL or a broad visual redesign.

## Verified current Manual entry source flow (source reconstruction, not a live render)

- `app/(protected)/flights/new/page.tsx` supplies profile options, current stored configuration/defaults, connections and calendar time-zone resolution; `FlightEntryWorkspace` defaults to Manual and mounts mode-specific panels while preserving state. A separate modal offers **Add aircraft** when needed. This is a quick *aircraft* add, not a separate Quick Add flight system.
- `components/flight-form.tsx` is **shared New/Edit**; `editing=Boolean(initial.id)`. It shows the top non-certifying `EntryReviewSummary` only for New, then **Flight basics** (date, registration, role and conditional instructor/PIC), **Route & UTC times** (departure, arrival, off-block/takeoff/landing/on-block and derived BLOCK/AIR), applicable **Flight experience**, **Additional crew**, **Aircraft context**, **Optional details**, and **Review & finish** plus the two explicit save actions. Source has multiple conditional branches — not all labels appear simultaneously.
- `missing[]` comes from existing domain-informed form state; `focusMissing()` opens applicable disclosures and focuses an existing field. Existing `PendingActionButton` renders separate **Save draft** and **Save & certify flight**. Current runtime/server-side validation remains authoritative. The Edit layout has its own differences, so any New-only style must be scoped via `data-entry-flow="new"`.
- Final effective styling is layered by `app/layout.tsx` and `app/ui-system.css` last. Current canonical spacing, surface and focus contracts in `docs/design-language.md`; actual rendered CSS must be measured before proposing a selector-level fix.
- **CODE-INFERRED audit targets, NOT confirmed visual bugs:** multiple overview/completion summaries could create excess vertical reading; help text may be small; conditional fields may be hard to locate for non-PIC roles; sticky/footer actions or open disclosures could impair touch/keyboard orientation. Prior U0 owner-local screenshots measured 10.4px Required and 11.2px contextual copy on older SHA, but these numbers must be rechecked on current main. The historical M2 after-state had some expanded screenshot height increase and no reported horizontal root overflow; that is not a current performance or accessibility PASS.

## New ordered, bounded milestones

| Milestone | Scope and product result | Acceptance and hard limits |
| --- | --- | --- |
| **F0 — Manual New Flight usability baseline (NOW)** | Read-only, source-to-actual-render audit for the main everyday scenario. Cover no aircraft, aircraft selected/PIC, DUAL missing instructor, Safety Pilot missing Actual PIC, mandatory profile failure, optional sections, invalid date/required fields, incomplete UTC times, draft/certify actions, pending/success/error. | Synthetic data only through approved isolation. 1440 desktop, 1024 desktop/tablet, 768 iPad emulation, 390/320 phone; light/dark, 200% zoom, reduced motion; capture actual computed CSS, screenshots, focus/touch reachability, blocked/empty/dense states. Native Safari/VoiceOver separate NOT RUN without hardware. Document observed/code-inferred/unverified findings and rank severity. **No runtime edits in F0.** |
| **F1 — One clear Manual flight entry path** | Based on F0, improve only observed hierarchy, unnecessary explanation/repetition, section rhythm and essential-field legibility. Explicitly surface the next field to fix with precise focus without creating new validators or a multi-page wizard. Preserve intentional optional detail access. | Scope New-only if shared component would affect Edit. Use existing `EntryReviewSummary`, field hints and tokens. No auto-filled last aircraft/airport, inferred crew/landing/time, silent role/default changes, new component framework or changing conditions for draft/certify. Motion `NONE` by default. |
| **F2 — Edit + return flow regression** | Confirm the same `FlightForm` remains coherent on Flight Detail correction/Edit, unsaved navigation, invalid/save success and role/certification states. Fix only independently reproduced issues, consulting legacy Draft #378 without blindly merging it. | Preserve finalized/certified audit and correction semantics, same flight model, server auth and explicit data patches. Keyboard/touch focus/restore, escape, tabs and save re-entrancy tests. |
| **F3 — Classic UI convergence** | Only after entry priority acceptance, improve Dashboard, Flights, Aircraft photo/placeholder, Statistics, Settings and navigation in small separate batches. | Existing brand/tokens and actual effective cascade; spacing/card/typography/navigation consistency, iPad/mobile and accessibility. No blanket CSS cleanup. |
| **F4 — Release acceptance and governance** | Exact candidate scoped risk planner, source/Node, TS, build, protected isolated PostgreSQL/browser; visual before/after and documentation. | F0 is not release PASS. No remote/prod destructive tests, DB migration, flags, merge or Vercel deployment without separate explicit authorization. |

## Technical / UX safety contract

Full `apple-design` skill and its 17-part `APPLE_DESIGN_PLAYBOOK`, `ui-ux-design`, `design-engineering`, `mobile-ipad`, `ui-quality-audit`, Design Quality V2 guide, `flight-integrity` and `testing-quality` govern. Preserve saved-flight truth, date/UTC semantics, certificate audit, role/crew applicability and the difference between UNKNOWN and zero. Computed BLOCK/AIR is not permission to infer missing endpoints. No new library, theme/brand change, broad motion, cosmetic sticky footer without measured need, third-party installer, Training touch, GPS multi-part implementation or production database operation.

## Evidence and current limitations

- Current main and prior PR status verified via GitHub; product and CSS inspected **as source**. Source-informed initial priority/findings above are **CODE-INFERRED**, not observed defects in today's browser.
- Prior U0 110 screenshot/metrics and N3-D0 100 screenshot dataset are **historical owner-local Chromium evidence**. The M2 Manual design is present in current main, but no fresh F0 snapshot has been captured for exact current SHA.
- Node/TypeScript/build/risk planner, protected PostgreSQL, actual Chrome/Playwright, iPad Safari, accessibility/performance audit on this docs-only planning branch: **NOT RUN / not claimed**. Docs-only artifact changes do not require flight integration tests; future runtime changes will.

**ONE NEXT STEP:** execute a read-only, synthetic, owner-local exact-main **F0 Manual New Flight visual/computed-style/interaction audit**, including Edit no-regression baseline, using a physically verified disposable local PostgreSQL fixture. Review its measured findings before choosing a **small F1 implementation**; separate owner approval required for merge/deploy.
