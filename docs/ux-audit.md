# FlyTally UI / UX consistency audit

Status: Phase 1 audit complete against `main` at `6f871779af27a6380bd0b77d3969bffcb84e9d7a`.

Scope: all current protected routes, public/auth/legal routes, shared UI components, global/versioned CSS, PWA shell, light/dark theme behavior and the existing UI acceptance tests. This audit intentionally does not change business logic, calculations, API contracts, database schema, auth or data handling.

Severity summary: **0 critical · 21 major · 14 minor**.

Phase 1 was approved in full on 2026-09-19. Phase 2 implementation is proceeding in the approved review batches; this document remains the source audit for finding scope.

## Findings

| ID | Severity | File / line | Inconsistency | Exact fix |
| --- | --- | --- | --- | --- |
| UX-001 | major | `app/layout.tsx:3-40`; `app/theme.css:4-250`; `app/light-interactions.css:2-89` | The effective UI system is split across a canonical token layer plus high-specificity light-mode hard-coded overrides. The same semantic surface/hover/border exists under multiple literal values, so cascade specificity rather than the design system often decides the result. | Keep the current import order and appearance, but make `app/v150-ui-system.css` the semantic color source and `app/ui-system.css` the geometry/state source. Replace exact recurring literals with existing tokens: `#fff → var(--surface)`, `#f8fafc → var(--surface-raised)`, `#d5dee8 → var(--line)`, `#e4eaf0 → var(--line-soft)`, `#102033 → var(--text)`, `#66788d → var(--muted)`, `#087fb8 → var(--accent2)`. Where an existing visible value such as `#eef4f8` has no correctly named general token, create one token with that exact value rather than changing the color. |
| UX-002 | major | `app/globals.css:26-52`; `app/ui-system.css:1-17,75-105` | High-frequency core layout still contains legacy structural spacing that conflicts with the declared scale: 14, 18, 22, 25, 28 and 30 px recur beside the 16/20/24/32 px contract. | Move structural rhythm to existing tokens. Concrete replacements: page-header 28 px → `var(--ui-section-gap)` (24 px); metric-grid gap 14 px → `var(--ui-card-gap)` (16 px); common 22 px section margins → 24 px; form-grid gap 18 px → 16 px; flight-form gap 22 px → 24 px; panel padding should use `--ui-card-padding:22px` instead of isolated 26 px. Preserve 1–3 px optical/internal adjustments only where they are not structural spacing. |
| UX-003 | major | `app/v160-adaptive-pilot-workspace.css:1-2`; `app/v250-recency-workspace.css:1-4` | Recency/compliance surfaces implement a second design scale: raw 10/11/12/13/15 px typography, 18/22 px gaps, 18 px card radii and bespoke shadows. | Keep the appearance hierarchy but converge values: radius 18 px → `var(--ui-radius-card)` (17 px); structural gap 18 px → 16 px; 22 px section gap → 24 px where it separates blocks; replace raw type pixels with exact rem equivalents (10=.625rem, 11=.6875rem, 12=.75rem, 13=.8125rem, 15=.9375rem); use `var(--shadow-soft)` for ordinary cards and no extra shadow on list rows. |
| UX-004 | minor | `app/v138-dashboard-insights.css:2`; `app/v146-credentials.css:2,9,14,23,26`; `app/v300-push.css:9,12-16` | Smaller legacy modules still use 7/9/10/14/15/18 px structural gaps/padding instead of the shared scale. | Normalize repeated structural values to the nearest existing token according to role: 15→16, 14→16 for card padding or 12 for compact control padding, 9→8, 18→16/20 depending whether it is card or section separation. Do not change 1–3 px optical offsets. |
| UX-005 | minor | `app/globals.css:23,46,52`; `app/v138-dashboard-insights.css:2`; `app/v146-credentials.css:9`; `app/v300-aircraft-sharing.css:22` | Interaction motion uses 80, 150, 160, 220 and 250 ms in addition to the canonical 140 ms. | Use 140 ms ease for UI hover/open/chevron/sidebar transitions. Keep only continuous playback/position animation linear where required. The global reduced-motion rule in `v1342-ui-polish.css` already remains the fallback. |
| UX-006 | major | `app/v150-ui-system.css:13-17`; examples in `app/globals.css:12,37-46` | Light-theme small text can miss WCAG AA. `--accent #0b946e` on white is ~3.84:1; `--accent2 #087fb8` on white is ~4.43:1; `--muted #66788d` directly on `--bg #f4f7fb` is ~4.22:1. | Do not alter brand fills. For normal-size text use existing stronger tokens: green text `var(--accent-strong) #087557` (~5.69:1 on white), blue text links `var(--link) #066f9f` (~5.55:1), and secondary text directly on page background `var(--text-soft) #34485f`. Accent colors remain available for fills, borders, large text and decorative state. |
| UX-007 | major | `components/app-shell.tsx:20-24`; `components/legal-footer.tsx:14-15` | Footer/legal text uses `var(--muted)` plus opacity .72. This compounds the already marginal light-background contrast and makes legal/help links unnecessarily faint. | Use `color:var(--text-soft)` and `opacity:1`. Preserve the same font sizes, alignment and link underline so the visual identity does not change beyond required legibility. |
| UX-008 | major | `components/track-profile.tsx:6` | The legacy GPS profile hard-codes chart colors (#38bdf8, #34d399, #f8fafc), while the current player uses theme-aware chart tokens. This makes the same chart family behave differently between themes. | Replace hard-coded SVG colors with `var(--chart-primary)`, `var(--chart-secondary)` and `var(--chart-cursor)`; keep current stroke widths and geometry unchanged. |
| UX-009 | major | `components/push-notification-controls.tsx:21`; `components/flight-entry-workspace.tsx:35,38,42`; `components/gps-import-review-player.tsx:32,45`; `components/flight-track-player.tsx:33`; `components/backup-validator.tsx:14`; `components/monthly-chart.tsx:42` | Functional UI mixes the canonical SVG icon language with emoji/Unicode icons (🔔, ✈, ✓, ⚠, ▶, ❚❚, ＋, ×). Rendering varies by OS and contributes to a generic/AI-generated look. | Use the existing `NavIcon` contract (24×24 viewBox, currentColor, stroke 1.8, round caps/joins). Reuse existing `notifications`, `flights` and `add` icons where applicable; move close/play/pause/check/warning to the same SVG component contract. Remove ✓/⚠ glyphs entirely where the adjacent text already communicates success/warning. |
| UX-010 | major | `components/gps-import-review-player.tsx:32`; `components/flight-track-player.tsx:12` | The same aircraft-on-map concept has two implementations: an OS-dependent ✈ marker in GPS import and a custom aircraft SVG in the flight player. | Extract/reuse the existing aircraft marker SVG from `flight-track-player.tsx` for both maps. Keep 34×34 rendered size, current rotation behavior and existing marker anchor. |
| UX-011 | major | `app/(protected)/flights/[id]/page.tsx:90,92`; `app/(protected)/credentials/legacy-page.tsx:58-72`; `components/aircraft-qualifications-section.tsx:63-67`; `components/recency-panel.tsx:21,24-25`; `components/spl-recency-panel.tsx:19`; `components/helicopter-recency-panel.tsx:19`; `components/balloon-recency-panel.tsx:16` | Several older server mutations still use ordinary buttons, while newer workflows use the shared duplicate-submit/loading contract. Users can get no visual acknowledgement and can resubmit. | Replace mutation submit buttons with `PendingActionButton` using action-specific labels: Saving…, Archiving…, Removing…, Requesting…, Cancelling…, Adding…. This is UI/state only; server actions and payloads remain unchanged. |
| UX-012 | minor | `components/airport-detection-control.tsx:19`; `components/backup-center.tsx:18`; `components/flight-trash.tsx:13`; `components/track-manager.tsx:16` | Some asynchronous error/success messages are visible but are not announced to assistive technology. | Add `role="alert"` to error messages and `role="status"` to success messages, matching the newer flight/auth forms. No copy or styling change. |
| UX-013 | major | `components/aircraft-photo-editor.tsx:129-141` | The cover-photo editor declares an ARIA modal but does not trap focus, close on Escape, focus the close control on open, or restore the opener. The aircraft manager and quick-aircraft modal already implement the correct behavior. | Reuse the existing modal-focus pattern: store opener ref; focus close button on open; trap Tab/Shift+Tab inside the dialog; close on Escape; restore opener focus after close. No layout/style changes. |
| UX-014 | major | `components/flight-detail-workspace.tsx:18-22` | Flight detail uses ARIA tabs but lacks the keyboard behavior expected for a tablist. All tabs remain in the normal tab order and Left/Right/Home/End do nothing. | Implement roving `tabIndex` (active=0, inactive=-1) and Left/Right/Home/End focus/selection. Keep the same three tabs, layout and styling. |
| UX-015 | major | Global form pattern in `app/globals.css:16-18`; examples `components/flight-form.tsx:68-88`, `app/(protected)/database/page.tsx:44-49` | Required controls rely on native validation but have no consistent visible required cue. Forms that mix optional and mandatory fields force pilots to discover requirements only at submit time. | Use the existing `.field-hint` visual language and add the literal text `Required` beside labels for required controls in mixed forms. Do not add a new color or icon. Native `required` remains the accessibility/validation source. |
| UX-016 | minor | `components/flight-form.tsx:86,101-104`; `components/kml-import-form.tsx:145-169`; legacy forms above | Validation timing varies: flight workflows expose pre-save missing state, while older forms provide only native/server feedback. | Standardize behavior: no errors before interaction; native validation on submit; after a failed submit, show inline error next to the relevant section and keep a single form-level `role="alert"`. Preserve the richer flight review panel where it already exists. |
| UX-017 | major | `components/flight-track-player.tsx:33`; compare `components/gps-import-review-player.tsx:45` | The saved-flight GPS player formats sample timestamps in the runtime local zone, while GPS import explicitly displays UTC and flight timeline data is defined as UTC. | Format player timestamps with `timeZone:"UTC"` and append ` UTC`, exactly matching GPS import. Keep 24-hour `en-GB` HH:MM:SS. |
| UX-018 | major | `components/flight-audit-panel.tsx:4`; `app/(protected)/notifications/page.tsx:27`; `app/(protected)/profile/page.tsx:73`; `components/aircraft-qualifications-section.tsx:64` | Non-flight timestamps are formatted with a mixture of hard-coded Europe/Prague and bare `toLocaleString("en-GB")`, despite Settings stating that screen dates use the user's selected time zone. | Add one presentation-only formatter `formatLocalDateTime(value, timeZone)` using `en-GB`, 24-hour time and the existing preference. Pass the already stored timezone into affected presentation components. Keep certified/flight timeline evidence on the separate UTC formatter. No storage/schema change. |
| UX-019 | major | `app/(protected)/dashboard/page.tsx:50`; `app/(protected)/statistics/page.tsx:67,72`; `components/recency-panel.tsx:22`; compare `app/(protected)/flights/page.tsx:73` | Date-only values appear as both raw ISO YYYY-MM-DD and formatted en-GB dates on adjacent product surfaces. | Use a single date-only display helper that parses YYYY-MM-DD without timezone conversion and renders `en-GB` day-first. Keep native date inputs/storage values ISO. |
| UX-020 | minor | `components/track-profile.tsx:6`; `components/flight-track-player.tsx:33`; `components/gps-import-review-player.tsx:45` | GPS analysis shows altitude primarily in metres in one profile and feet in the current player/import review. | Use feet as the primary in-app aviation altitude unit, matching the current player/import review. If metres remain useful, show them as secondary text after feet, not as the primary metric. Keep in-app speed at km/h; the social Story artifact may remain knots. |
| UX-021 | minor | `app/v1342-ui-polish.css:14`; `app/(protected)/flights/page.tsx:70,73`; `app/(protected)/statistics/page.tsx:67,72` | Tabular figures are enabled for headline metrics but not consistently for dense timestamps, pagination, costs and numeric table columns. | Extend `font-variant-numeric:tabular-nums` to `.time-pair`, `.pagination`, `.page-number-list`, `.track-stats`, `.rate-history-row` and numeric table-cell utility/columns. Do not apply it to prose. |
| UX-022 | major | `app/(protected)/admin/page.tsx:20-28`; `app/(protected)/connections/logbook/[id]/page.tsx:19-21`; `app/(protected)/flights/[id]/share/page.tsx:19-38` | Several protected secondary routes bypass `.ui-page-stack`, so vertical rhythm and responsive action behavior differ from the current core routes. | Wrap protected route content in `<div className="ui-page-stack">` and let the container own section spacing. Remove only now-redundant route-level margins; do not alter content hierarchy. |
| UX-023 | minor | `app/(protected)/flights/[id]/share/page.tsx:19,28`; canonical protected header in `app/(protected)/flights/page.tsx:35` | The protected Share route uses legacy `.page-heading` while the rest of the protected product uses `.page-header`. | Use `.page-header` for both certified and uncertified Share states; keep the same eyebrow, H1, lead and Back to flight action. |
| UX-024 | major | `app/v300-u6-acceptance.css:31-38`; `components/sidebar.module.css:28-35` | Coarse-pointer hardening guarantees 44 px height but not 44 px width. Icon-only mobile controls such as the 40 px menu button can remain narrower than the requested 44×44 target. | In the coarse-pointer rule add `min-inline-size:44px` for icon-only buttons/links: `.mobile-toggle`, `.sidebar-toggle` when visible, `.modal-close`, `.aircraft-crop-close`, `.play-button` and the notification bell. Preserve larger existing widths. |
| UX-025 | major | `public/sw.js:55-56`; `components/pwa-client.tsx:19-59` | FlyTally is intentionally online-only but has no explicit offline state. When connectivity disappears, users get request failures instead of a clear trust-preserving explanation. | Keep the service worker online-only. Add a non-blocking connection banner driven by `navigator.onLine` + `online/offline` events with the exact copy: `You're offline. FlyTally needs a connection to load or save logbook data.` Reuse existing PWA/status surface tokens; remove it automatically when back online. |
| UX-026 | major | Root shell `app/layout.tsx:1-75`; missing `app/not-found.tsx` and `app/error.tsx` | 404/runtime error states fall back to framework-default presentation and therefore do not meet the same FlyTally standard as login/legal/main app. | Add branded error and not-found routes using existing `.page-shell`, `.panel`, typography and primary/secondary button classes. No new visual style. Error copy should be short and specific; provide Retry/Back to dashboard or Sign in as context permits. |
| UX-027 | minor | `app/globals.css:9-10`; `app/v150-ui-system.css:44` | Auth card retains a 24 px radius and `backdrop-filter:blur(18px)` from the old glass treatment even though the later theme layer makes the card opaque. This is residual styling outside the canonical card geometry. | Keep the current opaque auth surface/shadow from v150; remove `backdrop-filter`; set login-card radius to `var(--ui-radius-card)` (17 px). Do not change logo, colors, layout width or typography. |
| UX-028 | minor | `app/legal/page.tsx:15-24`; `app/legal/[document]/page.tsx:11-13`; `app/legal/commercial/page.tsx:12-41`; `app/legal/regulatory/page.tsx:17-50`; `components/legal-footer.tsx:14-15` | Legal/public information pages repeatedly use inline margins, gaps, max-widths and font sizes, bypassing the existing page/panel rhythm. | Move the exact repeated layout into shared existing-style classes. Use max-width 900/960 px as currently shown, section gap 24 px, card gap 16 px, and the canonical panel/control tokens. Remove inline `marginTop:18px`, `gap:14/18px`, `paddingBottom:12/14px` in favor of the 16/24 px rhythm. |
| UX-029 | major | `app/v300-push.css:2,21,27` | Push onboarding is the clearest remaining generic glassmorphism surface: transparent mixed background, 18 px backdrop blur and bespoke 22×58 shadow. It does not match normal FlyTally raised panels. | Use `background:var(--surface)`, `border:1px solid var(--line)`, `border-radius:var(--ui-radius-card)` (17 px), `box-shadow:var(--shadow-raised)`; remove `backdrop-filter`. Keep placement, content and behavior unchanged. |
| UX-030 | minor | `app/v300-aircraft-sharing.css:3-4` | Aircraft cards with a photo receive a bespoke shadow while cards without a photo do not, creating a visual hierarchy based solely on image presence. | Remove the `.aircraft-card.with-photo` shadow override and let all aircraft cards use the same canonical card elevation/border. Photo presence must not change card height/elevation contract. |
| UX-031 | minor | `app/globals.css:46` and `:1114-1118`; `app/v300-u31-aircraft-airports.css` empty-state rules | Empty states exist as plain `.empty-state`, `.flight-empty-state`, `.guided-empty-state` and U31-specific variants with different icon sizes, padding and framing. | Keep exactly two existing patterns: compact `.empty-state` for table/list emptiness and full `.flight-empty-state` for a whole workspace/panel. Map guided/U31 variants onto one of those patterns; do not introduce a third visual. |
| UX-032 | minor | `app/login/login-form.tsx:20-24`; `app/join/join-form.tsx:5`; `app/(protected)/profile/page.tsx:40` | Email terminology varies between `E-mail`, `Email`, `Account email` and `Pilot email`. | Use `Email` for sign-in/join, `Account email` in account settings and `Pilot email` only where the field specifically searches another pilot. Change login `E-mail` → `Email`. |
| UX-033 | minor | `app/(protected)/dashboard/page.tsx:56` | Dashboard lead contains decorative generic phrasing: `your all-time flying snapshot and the next places to go`. It is less instrument-like than the rest of the product. | Replace with operational copy: `Your all-time flying totals. Historical periods, trends and detailed breakdowns are in Statistics.` Keep heading and layout unchanged. |
| UX-034 | major | `app/globals.css:1351` | Aircraft catalog result buttons have a more specific `:focus` rule that sets `outline:none`, cancelling the canonical visible focus outline defined by the shared UI system. | Remove the focus-specific outline cancellation and let the canonical focus contract from `app/v150-ui-system.css` apply unchanged. No other focus styling changes. |
| UX-035 | minor | `app/v301-public-flight-viewer.css:11` | The public-flight theme toggle uses a one-off `accent2` focus outline with a 1 px offset instead of the canonical focus color/ring geometry. | Use the canonical focus color and a 2 px outline offset, matching `app/v150-ui-system.css`. No other focus styling changes. |
| UX-036 | minor | `components/track-profile.tsx:6` | Legacy `TrackProfile` still renders functional play/pause controls as the text glyphs `▶` / `❚❚` and the button has no accessible name. The component currently has no runtime caller, but this conflicts with the established SVG icon and accessible icon-button contract if it is reused. | Replace the glyphs with the existing `<NavIcon name={playing?"pause":"play"}/>` and add `aria-label={playing?"Pause track":"Play track"}`, matching `FlightTrackPlayer` and `GpsImportReviewPlayer`. Keep playback behavior, sizing and layout unchanged. |
| UX-037 | minor | `app/(protected)/actions/page.tsx:15`; `app/(protected)/admin/page.tsx:22,24,27`; `components/backup-center.tsx:20`; `components/backup-restore.tsx:20`; `components/flight-trash.tsx:14` | Several non-flight metadata timestamps still use bare `toLocaleString("en-GB")`, so their output follows the runtime locale/timezone instead of the signed-in viewer's selected screen timezone. | Render these metadata timestamps with the existing `formatLocalDateTime` contract and the signed-in viewer's `user_settings.timezone`. Reuse an existing settings read where available or one `getUserTimezone(userId)` read per page load; pass timezone into client/components as a prop. Keep existing missing-value placeholders unchanged. |
| UX-038 | minor | `components/flight-trash.tsx:14`; `components/aircraft-manager.tsx:62,100`; `components/dashboard-details.tsx:26`; `lib/data/dashboard.ts:35`; `app/(protected)/connections/aircraft/[id]/page.tsx:47` | Several date-only values still render raw ISO text or use Date locale conversion even though Batch 7 established one timezone-free date-only presentation contract. | Render display-only `YYYY-MM-DD` values through `formatDateOnly`. For the 12-month Dashboard period label, format the already-calculated ISO start/end values only; do not change period boundaries or calculations. |
| UX-039 | minor | `components/backup-center.tsx:18`; `components/backup-restore.tsx:17,20,22,26`; `components/flight-trash.tsx:13` | Backup and trash success/validation text still uses a leading `✓` glyph even where the adjacent text and status styling already communicate the same meaning. | Apply the UX-009 rule: remove redundant `✓` prefixes where the adjacent text already carries the status. Keep a glyph only if it is the sole carrier of meaning. Do not change backup/trash behavior or status semantics. |

## Category coverage

The findings above cover the requested audit dimensions:

- Spacing: UX-002, UX-003, UX-004.
- Typography / tabular figures: UX-003, UX-021.
- Color / contrast / dark mode: UX-001, UX-006, UX-007, UX-008.
- Radius / borders / shadows: UX-003, UX-027, UX-029, UX-030.
- Icons: UX-009, UX-010.
- Components / states / loading / empty: UX-011, UX-012, UX-025, UX-026, UX-031.
- Forms / validation / required fields / keyboards: UX-015, UX-016; existing field types/input modes are generally appropriate.
- Data display / UTC / local / units / durations: UX-017 through UX-021. H:MM duration is already the correct product convention.
- Navigation / page headers: UX-022, UX-023.
- Mobile / safe areas / keyboard overlap / touch: existing U6 hardening is strong; remaining target-width gap is UX-024.
- Accessibility: UX-006, UX-007, UX-012, UX-013, UX-014, UX-024, UX-026, UX-034, UX-035.
- Microcopy: UX-032, UX-033.
- Motion: UX-005. Global reduced-motion support already exists and is good.
- Login / legal / error: UX-026, UX-027, UX-028.
- AI-look cleanup: UX-009, UX-027, UX-029, UX-030, UX-033.

## Existing behavior that should not be changed in Phase 2

- Brand colors, brand-mark gradient, logo and approved overall light/dark identity.
- Flight-time calculations, totals, recency logic and FCL/BFCL/SFCL logic.
- H:MM logbook duration format.
- UTC semantics for flight timeline / FCL.050 evidence.
- Database schema, API contracts, auth, entitlements, sharing/privacy rules and backup behavior.
- Online-only service-worker policy unless separately approved.
- Print-layout dimensions that exist specifically for FCL.050 output.
- Currency business rules. The UI currently exposes a currency setting while several cost surfaces are explicitly CZK; resolving that is business-rule adjacent and is therefore intentionally not included as a Phase 2 UI-only change.

## Approved Phase 2 batching

1. **Tokens and geometry** — UX-001, UX-002, UX-003, UX-004, UX-005, UX-021.
2. **Color, contrast and charts** — UX-006, UX-007, UX-008.
3. **Icon system** — UX-009, UX-010.
4. **Component states and loading** — UX-011, UX-012, UX-030, UX-031.
5. **Accessibility and touch targets** — UX-013, UX-014, UX-024, UX-034, UX-035.
6. **Forms** — UX-015, UX-016.
7. **Display formatting** — UX-017, UX-018, UX-019, UX-020.
8. **Routes, headers and legal layout** — UX-022, UX-023, UX-028.
9. **Surfaces and error pages** — UX-026, UX-027, UX-029.
10. **Microcopy** — UX-032, UX-033.
11. **Offline state** — UX-025.

Each implementation PR must list the exact finding IDs it closes, visual verification screens and risks. Verification is performed by repository CI and the Vercel preview; local verification must never be claimed when the execution runtime cannot run it.


## Batch 4 empty-state implementation inventory

Batch 4 maps every empty-state variant onto exactly two existing visual patterns:
- compact `.empty-state` for list/table/subsection emptiness;
- full `.flight-empty-state` for a whole workspace/panel empty state.

No mapping removes content or a call-to-action. The complete per-instance inventory is recorded in PR #140 before UI implementation.


## Batch 6 form inventory gate

Batch 6 implements UX-015 and UX-016 only after a complete source-form inventory is recorded in PR #142. The PR table classifies every source `<form>` pattern as required-only, optional-only/action-only, or mixed before any runtime form code is changed.

Implementation safeguards:
- `Required` is rendered only for native-required controls inside mixed forms, using the existing `.field-hint` language and `aria-hidden="true"`.
- Label text and the cue share one inline label-text wrapper so narrow layouts do not gain a new grid row.
- A source comparison against `main` confirms that no native `required` attribute or conditional requirement changed.
- UX-016 changes only existing error presentation/announcement; validation, actions, payloads, redirects, calculations and the flight review panel remain unchanged.


## Batch 7 display-formatting addendum

The approved Batch 7 call-site review extends the same finding classes to these previously ambiguous presentation surfaces:
- UX-017 also covers the legacy `components/track-profile.tsx` GPS sample time and `components/track-manager.tsx` `startUtc` display. Both are UTC timeline/evidence presentation and use a literal ` UTC` suffix.
- UX-019 also covers `components/aircraft-qualifications-section.tsx` date-only displays for `completed_on`, `first_date` and `last_date`. Form values and stored ISO values remain unchanged.

These additions are presentation-only. They do not change stored values, sorting, filtering, URLs, form values, flight calculations, GPS inference or certified/FCL.050 evidence formatting.


### Batch 7 UX-018 timezone-read exception

The approved UX-018 implementation may read the signed-in viewer's `user_settings.timezone` for presentation only:
- Notifications adds one parallel `getUserTimezone(userId)` read beside the existing notification query.
- Settings → Account adds one parallel `getUserTimezone(userId)` read beside the existing account/session queries; Settings → General continues to reuse its existing `user_settings` row.
- Credentials already reads `user_settings`, so that existing SELECT also returns `timezone` and passes it to `AircraftQualificationsSection`; no extra query is added for Aircraft Training.
- `FlightAuditPanel` now requires a `timeZone` prop and performs no data access. It currently has no runtime caller after flight-detail Change history was removed, so Batch 7 does not reintroduce a query or the removed panel.

The timezone is always derived from the signed-in session user's ID. Viewing another pilot's shared data must therefore use the viewer's own screen-timezone preference, never the viewed pilot's timezone. Missing, null, invalid or failed timezone reads fall back to `Europe/Prague`. No auth/session shape, stored setting, schema or write path changes.

## Batch 7b display-leftovers addendum

Batch 7b closes UX-036 through UX-039 as presentation-only follow-up work:
- Actions adds one parallel `getUserTimezone(userId)` read beside the existing pending-actions read.
- Administration adds one `getUserTimezone(session.userId)` entry to its existing `Promise.all`.
- Print & data starts one `getUserTimezone(userId)` promise per page load and passes the result through `DataHub` to Backup Center, file restore and Deleted flights. The presentation components perform no database access.
- Every timezone is the signed-in viewer's own `user_settings.timezone`; no route parameter, viewed pilot or backup owner selects it.
- Missing, null, invalid or failed timezone reads retain the Batch 7 `Europe/Prague` fallback.
- Date-only cleanup uses `formatDateOnly` only. The Dashboard 12-month period boundary calculation remains unchanged.
- Redundant leading check glyphs are removed from backup/trash success and validation copy where the adjacent text already carries the meaning.
- Dormant `TrackProfile` adopts the existing `NavIcon` play/pause contract and accessible name without changing playback behavior.

No stored value, sorting, filtering, URL, form value, calculation, certified UTC evidence, FCL.050 print output or social Story behavior changes in Batch 7b.


### Batch 8 UX-028 leftover addendum

The Batch 8 source sweep found two public legal routes with the same inline-layout pattern that were not named in the original UX-028 row:
- `app/legal/brand-claims/page.tsx` keeps its existing 960 px public width via `.legal-page-shell-wide`; the claim-registry section now uses the shared 24 px section rhythm and 16 px list-item rhythm while retaining the existing bottom-border look.
- `app/legal/release-status/page.tsx` keeps its existing 900 px public width via `.legal-page-shell`.

The same sweep also found the repeated `marginTop:"18px"` wrapper around the compact legal footer on `app/login/page.tsx` and `app/join/page.tsx`. Because this is the same public/legal inline-spacing class of issue, both now use `.legal-footer-slot` with the canonical 16 px card gap. `app/reset-password` has no equivalent inline legal/footer layout to migrate.

These are layout-only changes. Legal/regulatory wording, headings, links, ordering, authentication behavior and public content remain unchanged.
