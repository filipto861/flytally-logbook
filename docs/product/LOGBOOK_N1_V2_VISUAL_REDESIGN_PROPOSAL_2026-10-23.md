# N1 V2 — FlyTally Logbook: visually substantial shell and navigation redesign

**Status:** N1 V2 theme-adaptive direction OWNER APPROVED (2026-10-23); N1 V2-1 isolated navigation candidate implemented on Draft PR #391. Browser, test, merge, deploy remain NOT RUN / NOT AUTHORIZED.  
**Date:** 2026-10-23  
**Owner feedback:** After successful local N1-A preview, owner submitted four desktop/light screenshots and said: "Změna je příliš malá, chci výrazně modernější design" (change too small; wants much more modern look). The preview is owner-observed only, not our browser-test PASS. No user screenshots, accounts or flight details may be committed.

**Repository baseline:** filipto861/flytally-logbook; canonical `main=c68e6a2758423ab862cf9b03f5623515d07433e4` reverified 2026-10-23; existing Draft PR #391 on `feat/logbook-n1a-modern-navigation-20261023` had V1. User explicitly rejects V1 visual magnitude (not existing functionality). Its CSS is a provisional candidate, NOT accepted final visual implementation.

## 1. Evidence-based diagnosis (owner screenshots, 1920x1080, desktop/light, routes Dashboard, Flights, flight detail, Statistics)

| Label | Evidence class | Observation | N1 V2 implication |
| --- | --- | --- | --- |
| N1-V2-01 | OBSERVED | Left nav takes a narrow vertical strip in the light UI; tiny FlyTally identity, bell and collapse control compete in the header | Redesign header and sidebar composition instead of only recoloring rows |
| N1-V2-02 | OBSERVED | Solid green Add flight is now visibly present; the remaining sidebar rows are visually similar to previous version | Keep brand accent; modernize the rail, navigation type scale, icon rhythm and active/hover treatment |
| N1-V2-03 | OBSERVED | Main content feels like broad pale canvas with many subtle border-only cards | Adjacent global shell/container framing is in scope; actual feature cards and statistics/flight domain views belong to later N2 |
| N1-V2-04 | OBSERVED | Header pattern repeated across four routes, with action located to the far right and large content width | Consider a unified restrained app topbar/page-header contract, preserve contextual actions and responsive behavior |
| N1-V2-05 | OBSERVED | Tab controls differ among Flights, flight detail and Statistics | Log as N3 future shared-tab improvement, not N1 component rewrite |
| N1-V2-06 | OBSERVED | Next dev overlay shows an issue count at lower left | Do not treat developer overlay as a production UI defect or expand scope into debugging |
| N1-V2-07 | UNVERIFIED | No user screenshots yet of actual V1 phone/iPad/dark-theme appearance | Do not claim cross-platform visual consistency or behavior |

## 2. Product goal — not a rebrand

A confidently **new visual silhouette** inspired by modern aviation tools and Apple-like craftsmanship: theme-matched navigation framing the operational workspace, a clear structural top bar, deliberate whitespace and stronger type/geometry. Keep existing FlyTally logo, colors, icon set, routes and content model. **No arbitrary new color palette, font, background illustration or dependency.** Glass/blur avoided; depth from opaque surfaces, subtle layer boundaries and functional elevation only.

### Preferred direction: Theme-adaptive rail + quiet workspace

**Desktop expanded rail:** target **248–260 px** only if measured layouts support it (source historically ~238, screenshot alone does not prove computed width). Light rail on light appearance, dark navy rail on dark appearance; distinguish the rail using existing semantic surface and border tokens. Add 16–20 px internal padding, a purposeful 60–64px brand zone, persistent accessible bell/collapse control placed without crowding, a substantial Add flight button, and 46–48px navigation rows with ~20px icon and readable ~14px text. Current links, order and groups unchanged. Active route uses a single slightly lighter rounded highlight plus a consistent 2–3px green indicator; non-active rows subdued but readable; hover/keyboard focus immediately evident. Group header quiet and well spaced rather than microtext. Preserve admin/signout at existing accessible locations. Collapsed rail remains ~74–80px and all controls retain accessible names.

**Shell and page header:** give the main workspace a clearly defined background and a consistent structural header region (typical 56–64px visual height subject to browser measurements). Improve relation among breadcrumb/eyebrow, route title, secondary description and contextual action. Design must not duplicate or inadvertently remove per-route actions. Do not inject generic new top-level route controls with new business logic. On very wide screens allow large tables to use available width: no global arbitrary max width that degrades Flights table.

**Light/dark:** keep semantic tokens for body/content; the sidebar, collapsed rail and mobile drawer follow the resolved app appearance (including system mode). Avoid dark-on-light permanent rails; ensure solid surfaces and good contrast for sunlight readability. Dark-mode body remains existing dark brand surfaces with clear layer separation. All compact text meets accessible contrast and supports browser zoom/forced colors. Never assume color alone conveys active state.

**Mobile/iPad:** same new navigation identity in a left overlay drawer (existing <=820px breakpoint) with stable top bar, 44px minimum touch controls, safe area and scroll. Coarse pointer iPad edge handle remains. Preserve escape, focus return, body scroll lock, route close and collapsed preference. Motion decision **SIMPLE**: at most a subtle, short, interruptible transform/opacity transition after observing behavior. If it makes drawer dismissal/focus fragile, motion **NONE**. No new motion library.

## 3. What will actually look different, versus minor N1-A

- V1: green CTA and small CSS changes. V2: **new overall two-zone composition** with premium theme-adaptive rail, airier typography and deliberate utility chrome.
- V1: conventional flat item list. V2: coherent nav hierarchy with clear task grouping and softer, more confident active state.
- V1: brand/bell/collapse crammed at top. V2: clearly composed header with usable affordances and no overlap.
- V1: separate sidebar and page heading styles. V2: matching global shell rhythm and page-header framing; feature contents not rewritten.

## 4. Strict rollout / approval gates

**N1-V2-0 DESIGN FREEZE (OWNER APPROVED):** Owner rejected the permanent dark rail in light mode, asked for theme-adaptive appearance, and accepted the revised direction. This approval authorizes a candidate, NOT merge/deploy. Existing Draft PR #391 remains unmerged, with V1 implementation still present; do not claim the new design is implemented.

**N1-V2-1 IMPLEMENTED CANDIDATE (NOT VISUALLY VERIFIED):** Scope-limited sidebar brand hierarchy and primary section label (`components/sidebar.tsx`); navigation spacing, increased row height, group hierarchy and collapsed/mobile treatment (`components/sidebar.module.css`); final effective navigation CSS overrides using resolved LIGHT/DARK semantic tokens (`app/ui-system.css`); source regression expectations (`tests/logbook-n1-navigation-style.test.ts`). Preserved all links, roles, notification count semantics, Escape/focus and collapse storage. No new dependencies.

**N1-V2-2:** Shared shell/page-header surface and spacing only, plus phone/iPad drawer alignment; files anticipated `components/app-shell.tsx` and localized CSS. Do not touch routes' business page components just to improve cards. Avoid global CSS overrides of unrelated page controls.

**N1-V2-3 OWNER PREVIEW FIRST:** View live local disposable-db fixture on the **exact candidate SHA** at desktop/light and dark, collapsed, mobile 320/390, iPad emulation and keyboard. Require owner visual acceptance before formal risk-selected tests and before merge/deploy requests. Do not run destructive PostgreSQL fixture on existing/prod DB.

**N1-V2-4 VERIFY:** typecheck, candidate-bound targeted source regressions, browser visual/interaction tests and build as selected by DEVELOPMENT.md. Native Safari is NOT RUN absent actual device. Only then discuss a separate, explicit merge/deploy approval.

**Future N2:** shared card/spacing/type hierarchy across pages and overall visuals (specific scope/approval required). **Future N3:** Flights/Statistics/Credentials tab architecture and visual consistency (no domain changes). Neither is silently folded into N1.

## 5. Scope, frozen decisions, and test plan

**DO:** retain canonical link order/URLs, active Flights semantics including FSTD, Admin role, notification count semantics, all controls and accessible routes; preserve original FlyTally colors, logo and icon source; use existing semantic tokens; at least 44px touch controls; keyboard focus/escape/reduced motion; 320/390/768/1024/desktop and light/dark; check real final CSS cascade. Keep visual work reversible and small-batch.

**DO NOT:** change aircraft/flights/recency logic, public sharing, search/filter behavior, stats formulas, GPS, auth/permissions, DB/migrations/flags, production deploy, Training, unrelated Draft PRs, CSS cleanup unrelated to shell, new design component library, global glass or gratuitous springs. Do not run destructive fixtures outside physically verified disposable localhost database. Preserve owner's two unrelated untracked ZIPs from earlier local status output.

**CURRENT EVIDENCE:** owner desktop LIGHT screenshots of N1-A observed; GitHub source, CSS cascade and required skills read. N1 V2-1 candidate CSS/markup committed to Draft PR #391. Static in-memory checks 22/22 PASS (source only, NOT a test runner). Node targeted tests, TypeScript, build, authenticated Playwright, computed browser CSS, real preview/native Safari **NOT RUN**; database/flags/production deployment untouched. No owner visual acceptance of V2 yet.

**ONE NEXT STEP:** Owner pulls Draft PR #391 candidate and previews N1 V2-1 locally with existing guarded disposable DB launcher in light/dark (expanded/collapsed, mobile drawer). Gather visual feedback BEFORE N1 V2-2 or release tests. No merge/deploy.


## 6. N1 V2-2 implementation candidate — 2026-10-23

**Owner direction:** Following positive desktop/light+dark N1 V2-1 screenshots, owner asked to continue into common workspace/page-header modernization. **Scope remains the Logbook shell; owner has not approved actual V2-2 appearance, merge or deploy.**

**Changed runtime code (candidate only):**
- `components/app-shell.tsx`: add `shell-workspace` CSS scope to the existing protected `{children}` wrapper; Sidebar, theme manager, PWA, notification onboarding and legal footer unchanged.
- `app/ui-system.css`: final-cascade CSS limited to `.app-grid .shell-workspace > .ui-page-stack > .page-header` and `.app-grid .shell-workspace > .page-header`. Give existing first-level page mastheads an opaque semantic surface, standard 17px radius, restrained border/elevation, consistent eyebrow/H1/lead copy, and non-shrinking existing header action. No route component or business logic edits.
- `tests/logbook-n1-v2-shell.test.ts`: source guard for the shell scope, theme tokens, reduced scope, the preserved contextual links and the flight detail narrow layout.

**Design method:** current merged Apple Design V2 full 17-domain playbook + UI/UX Design, Design Engineering, Mobile/iPad, UI Quality Audit and Testing Quality. Motion policy **NONE** (static layout styling). Retain all existing semantic colors and approved light/dark adaptation, no new components, overlays or dependencies.

**Navigation/action constraints:** Existing header action links such as Add flight, Back to dashboard and flight detail navigation are left untouched; no extra global actions added. No changes to filters, tabs, cards, flight records, statistics, auth, DB, backup, maps, Training, notifications or accessibility event logic.

**Responsive preview matrix:** Desktop expanded/collapsed in Light and Dark; mobile at 320 and 390px with top bar and menu; iPad 768/1024px touch emulation; long title/description, in-header controls and header with no button; keyboard focus/zoom and print. Confirm no horizontal scroll, duplicate action or clipping. **Browser and native Safari NOT RUN yet**, no PASS from source checks.

**Evidence:** 22/22 in-memory GitHub source assertions PASS at staging point (source-only). Node targeted tests, typecheck, build, browser/computed CSS and native Safari NOT RUN. User's earlier positive screenshots cover N1 V2-1 only, not this implementation.

**ONE NEXT STEP:** owner refreshes local clean checkout to exact current branch HEAD and previews N1 V2-2 using the pre-existing guarded local disposable PostgreSQL launcher; sends Light and Dark screenshots of Dashboard and one long-title/with-action screen. Only after visual acceptance proceed with candidate-bound risk planner/targeted tests. No merge/deploy.
