# FlyTally Logbook — UI and design guide

Practical guide for anyone (human or AI agent) changing Logbook UI. It describes what the code does today. **Code is authoritative**: if this file and the CSS disagree, the computed style in a real browser wins, and this file should be corrected.

The FlyTally visual identity (logo, brand green/blue, accent gradient on brand marks, dark-first navy palette, Inter/system type) is owner-approved. Do not rebrand, add a UI kit, or add animation/toast/gesture libraries as part of routine UI work.

## 1. Design principles

FlyTally is a pilot's working instrument used at a desk, on an iPad in the cockpit or hangar, and on a phone. Decisions are made in this order:

1. **Correct aviation data and pilot control.** Never auto-fill or default aircraft, airports, roles, landings, times, GPS altitudes or certification/regulatory applicability. Missing or conflicting critical data is shown as missing; it is never replaced with a plausible value. A calculated value must look different from verified or certified evidence.
2. **Clear purpose and hierarchy.** Each screen answers "where am I, what can I do, what happens if I tap this, how do I get out". Show the common task first. Put rare options behind a predictable disclosure, not in a hidden gesture. Controls sit next to the content they affect.
3. **Immediate, honest feedback.** Every press gets visible feedback at once. Async work shows a pending state, blocks duplicate submits, and reports the real server result. Never show success before the server confirms it. Pending, saved, failed, disabled and warning must look different from each other, and must not rely on colour or motion alone.
4. **Consistency with the existing system.** Reuse the existing classes and components (section 5) before you invent a variant. Same-looking controls must behave the same.
5. **Motion only when it explains something.** The default is no motion or a short state transition (about 140 ms ease on colour, border, opacity or small transforms). Nothing decorative and nothing that loops: no parallax, entrance choreography, bounce or confetti. User-driven motion must be interruptible and reversible. Animate `transform`/`opacity`, never layout properties, and never use `transition: all`.
6. **Opaque, legible surfaces.** No glassmorphism or backdrop blur on content surfaces. A modal dims its backdrop. Contrast must hold over maps and photos.
7. **Reversible and explicit destructive actions.** Use a two-step confirmation, and block deletion when linked records exist. No swipe-to-delete and no gesture that can trigger destruction by accident.
8. **Typography for scanning.** Dense logbook data needs aligned tabular numerals, consistent abbreviations, enough line-height and no squeezed critical numbers. Layouts must reflow under zoom or large text instead of clipping.

## 2. Themes

- Themes are **light** and **dark**, with a **system** preference that resolves to one of the two. There is no night mode. Dark mode is its own token set, not an inversion. Aircraft photos and map tiles are never colour-inverted.
- `components/theme-bootstrap.tsx` is an inline script that sets `html[data-theme]`, `data-theme-preference` and `color-scheme` before paint. `components/theme-manager.tsx` re-applies it on preference or OS change and dispatches `flytally:themechange`. `components/theme-runtime.ts` exposes `useResolvedTheme()` and `mapThemePalette()`, which supply hex colours for Leaflet layers that cannot read CSS variables.
- Tokens resolve through three scopes in `app/v150-ui-system.css`: `html[data-theme=…]`, `.app-grid[data-appearance=…]` (the server-rendered preference on the protected shell), and `@media (prefers-color-scheme)` with `html:not([data-theme])`.
- New CSS should use tokens only, so that one rule works in both themes. Add an `html[data-theme="light"] …` override only when a token cannot express the difference.

## 3. Design tokens

### Colour: `app/v150-ui-system.css` (the final colour layer)

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--bg` | `#07111f` | `#f4f7fb` | Page background |
| `--surface` (= `--panel`) | `#0e1b2d` | `#ffffff` | Cards, panels |
| `--surface-raised` (≈ `--panel2`) | `#13243a` | `#f8fafc` (`--panel2` `#eef3f8`) | Raised/secondary surfaces, secondary buttons |
| `--surface-muted` | `#0b1727` | `#f1f5f9` | Sidebar, chart/map backgrounds, disabled fields |
| `--surface-hover` / `--ui-hover` | `#172b43` | `#eaf1f7` | Hover surfaces |
| `--line` (= `--border`) / `--line-soft` / `--line-strong` | `#203650` / `#192d44` / `#36516f` | `#d5dee8` / `#e4eaf0` / `#b6c5d5` | Default border / quiet divider / interactive border |
| `--control-bg` / `--control-hover` / `--control-border` | `#0a1626` / `#12263c` / `#29415e` | `#ffffff` / `#f4f8fb` / `#c8d4e0` | Form controls |
| `--text` / `--text-soft` / `--muted` | `#edf5ff` / `#c7d6e7` / `#8ea3bb` | `#102033` / `#34485f` / `#66788d` | Primary / strong secondary / muted text |
| `--accent` / `--accent-strong` | `#34d399` / `#10b981` | `#0b946e` / `#087557` | Brand green: fills (`--accent`), small green text (`--accent-strong`) |
| `--accent-soft` / `--accent-contrast` | green 13% / `#03251b` | green 10% / `#ffffff` | Selected backgrounds / text on accent fill |
| `--accent2` / `--link` | `#38bdf8` / `#67d5fb` | `#087fb8` / `#066f9f` | Brand blue / text links |
| `--focus-color` / `--focus-ring` | `#5eead4` / teal halo | `#087fb8` / blue halo | Focus (see section 8) |
| `--{success,warning,danger,info}-{text,bg,border}` | tinted rgba | solid pastel | Status banners, badges, messages |
| `--shadow-soft` / `--shadow-raised` | black 16% / 24% | navy 7% / 12% | Card / dialog elevation |
| `--chart-primary`, `--chart-secondary`, `--chart-*-strong`, `--chart-cursor` | | | SVG charts: never hard-code chart colours |
| `--leaflet-control-bg`, `--leaflet-control-hover`, `--leaflet-popup-bg` | | | Map controls |

`:root` in the same file also holds `--light-*-hover` helper tokens that `theme.css` and `light-interactions.css` use for light-mode hover and selected states.

**Contrast rules (light theme).** `--accent` on white is 3.84:1, `--accent2` is 4.43:1, and `--muted` on `--bg` is 4.22:1, so none of them is acceptable for normal-size text. Use `--accent-strong` (5.69:1) for green text, `--link` (5.55:1) for links, and `--text-soft` for secondary text that sits directly on `--bg`. The accent colours stay fine for fills, borders, large text and icons. The brand gradient `linear-gradient(135deg,var(--accent2),var(--accent))` is reserved for brand marks such as `.brand-mark` and `.brand-symbol`.

### Spacing, geometry and state: `app/ui-system.css`

| Token | Value | Notes |
| --- | --- | --- |
| `--ui-space-1…10` | 4, 8, 12, 16, 20, 24, 32, 40 px (`-1,-2,-3,-4,-5,-6,-8,-10`) | Use for every structural gap and padding; 1–3 px optical nudges are fine |
| `--ui-card-gap` | 16 px | Gap between cards and inside grids |
| `--ui-section-gap` / `--ui-page-gap` | 24 px | Between page sections; `.ui-page-stack` drops to 20 px on phones |
| `--ui-card-padding` / `--ui-card-padding-mobile` | 22 px / 16 px | Panel padding |
| `--ui-control-min-height` / `--ui-touch-min-height` | 40 px / 44 px | Control height, touch target |
| `--ui-radius-control` / `--ui-radius-card` | 11 px / 17 px | Declared radii; see "Effective values" below. Pills and badges use 999 px |
| `--ui-loading-opacity` | .58 | Pending buttons |
| `--mobile-shell-height` | 64 px (≤ 820 px) | Height of the mobile top bar; used for `scroll-padding` and `scroll-margin` |

**Effective values today (measured in Chrome).** Several canonical rules sit inside `:where()`, which has zero specificity, so older literals in `app/globals.css` beat them:
- `.primary-button` renders as `#4bc9aa` with an 8 px radius in **both** themes, not as `--accent` / 11 px. `.primary-link` in a page header gets 11 px.
- Secondary, detail and danger buttons have a 7 px radius. Inputs have an 8 px radius, 38 px min-height and 11×12 px padding.
- Cards are 17 px when they are direct children of `.ui-page-stack` inside `.shell-workspace`, and 10 px when nested elsewhere. Panel `box-shadow` is `none !important` except for those direct children.
- Control transitions run at .16 s, not .14 s.

When you need a canonical value to win, give it real specificity, for example a component class. Then check the computed style in both themes.

### Typography (effective)

- Font stack: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`, set in `app/globals.css`. Inter is not bundled, so most devices render the native system font.
- H1 is about 31 px on desktop, weight 790, letter-spacing about −0.04em. On phones (≤ 600 px) it is `clamp(1.65rem, 8vw, 2.05rem)`. H2 uses tighter tracking (−0.015em). Tighten tracking only on large text, never on small text.
- `.eyebrow`, metric labels and similar kickers use **ui-monospace**, uppercase, about .64–.72rem, weight 760–800, wide tracking. `.page-lead` is about .82rem with a 68ch max width.
- Labels are .76rem, weight 690. Hints (`.field-hint`, `label>small`) are .65rem. Inputs are .76rem on desktop and are forced to **16 px** at ≤ 820 px or on coarse pointers, which prevents iOS zoom.
- Table headers are about .62rem uppercase with wide tracking. Table cells are about .84rem.
- `font-variant-numeric: tabular-nums` applies to headings, `strong`, metrics and these utility classes: `.numeric-cell`, `.numeric-table`, `.time-pair`, `.pagination`, `.page-number-list`, `.track-stats`, `.rate-history-row`, plus the numeric flight-list columns. Use the utility classes for any new numeric column, and keep them off prose.

### Icons

Use `components/nav-icon.tsx` (`<NavIcon name="…"/>`): 24×24 viewBox, `stroke="currentColor"`, stroke width 1.8, round caps and joins, `aria-hidden`, rendered at 19–20 px (`.nav-icon`). Available names: dashboard, statistics, flights, simulator, add, map, connections, actions, notifications, credentials, settings, database, data, admin, signout, manage, more, sidebar-expand/collapse, close, play, pause, check, warning. Add a new icon here in the same style. Do not use emoji or Unicode glyphs (✈ ✓ ⚠ ▶ ×) as functional icons, and drop a ✓/⚠ prefix when the text already says it. The aircraft map marker is shared via `components/aircraft-marker.ts`. An icon-only button needs an `aria-label`.

## 4. Page layout

- The protected shell is `components/app-shell.tsx`: `.app-grid[data-appearance]`, then the skip link, then `Sidebar`, then `<main id="main-content" class="content" tabIndex={-1}>`, then `.shell-workspace`. `PwaClient` (offline banner) and the push onboarding prompt render after `main`.
- A protected route wraps its content in `<div className="ui-page-stack">`. That container owns the vertical rhythm, so do not add route-level margins.
- Each page opens with `<header className="page-header">`, containing an eyebrow, an `h1`, a `p.page-lead.muted`, and the primary action(s) on the right. On phones the actions stack at full width. The legacy `.page-heading` is not used for new work.
- Within a page, use `.panel` (bordered surface) with a `.section-heading` (title plus inline status/action). Card grids are `.metric-grid` / `.metric`. Tables are `.table-panel > .table-scroll > table`; `.table-scroll` scrolls horizontally inside the card and never widens the page.
- Prefer dense lists and tables over stacked decorative cards when the content is tabular. Do not nest card chrome inside card chrome.
- Public and auth pages use `.login-shell` / `.login-card`, `.page-shell` and the legal layout classes (`.legal-page-shell`, `.legal-page-shell-wide`, `.legal-section-stack`, `.legal-footer-slot`). `app/error.tsx` and `app/not-found.tsx` are the branded fallbacks. They never show exception text.

## 5. Components and class conventions

**Buttons and links.** Use a `<button>` for actions and an `<a>`/`Link` for navigation, even when the link is styled as a control.
- `.primary-button` / `.primary-link`: the one main action in a region.
- `.secondary-button` / `.secondary-link`: neutral actions.
- `.detail-button`: compact contextual action. `.ghost-button`: low emphasis, for example in the sidebar.
- `.danger-button` / `.delete-button` / `.icon-danger`: destructive actions.
- Disabled state is the `disabled` attribute (or `aria-disabled="true"`), which gives `opacity .5` and `cursor: not-allowed`. Never leave a dead control without explaining why.

**Destructive confirmation.** Follow `components/delete-flight-button.tsx`: the first click reveals an inline **Cancel** button plus a confirming `PendingActionButton` (`danger-button`, e.g. "Deleting…"). Certified records use a dialog (`void-certified-flight-button.tsx`).

**Status and messages.** These come from v150 tokens and are inline. The app has no toasts.
- `.form-error`, `.error-banner`, `.danger-notice`: danger.
- `.form-success`, `.connection-success`, `.saved-next-flight`: success.
- `.connection-notice`, `.chart-warning`, `.credentials-attention`: warning.
- `.info-banner`, `.restore-note`: info.
- Badges: `.status-on`, `.status-off`, `.status-warning`.
- Field-level messages: `.field-message-error`.

**Empty states.** There are exactly two. Use compact `.empty-state` for an empty list, table or subsection. Use `.flight-empty-state` (icon circle, title, text, call to action) for a whole empty workspace. Do not create a third.

**Disclosure.** Use native `<details>`/`<summary>` (`details.panel`, `.entry-section`, `.credential-create`). The summary shows a short state, such as "Needs attention", when collapsed content has problems.

**Tabs and segmented controls.** `.segment-control`, `.period-control` and `.scope-links` are URL-driven. Real ARIA tabs (`flight-detail-workspace.tsx`) use `role=tablist/tab/tabpanel`, a roving `tabIndex`, and ←/→/Home/End.

**Modals.** Reference implementations are `aircraft-manager.tsx`, `aircraft-photo-editor.tsx` and `flight-entry-workspace.tsx`. Each uses `role="dialog"`, `aria-modal="true"` and `aria-labelledby`. On open it focuses the close button. Tab and Shift+Tab are trapped inside, Escape closes, and focus returns to the opener. Mouse-down on the backdrop closes the modal. The modal uses a portal where needed, `max-height` in `dvh`, padding from `env(safe-area-inset-*)`, and a sticky header on phones. There is no shared hook yet, so copy the pattern exactly.

**Maps and charts.** Leaflet controls use `--leaflet-*` tokens, and the map settings use one anchored popover (`.flytally-map-settings-*`). SVG charts use the `.chart-*` classes and `--chart-*` tokens. Every chart needs a text or table equivalent and explicit zero, empty and missing states.

## 6. Forms, pending state and feedback

- **Labels.** Wrap the control: `<label>Text<input …/></label>`. Use the correct input types: `date` and `time` (ISO values), `email`, and `number` with a decimal `step` for money. Logbook durations are **H:MM text**, never decimal hours.
- **Required cue.** Only in forms that mix optional and required fields, put `<span className="field-hint" aria-hidden="true">Required</span>` inside the label text. Native `required` remains the source of validation and accessibility.
- **Validation timing.** Show no errors before the user interacts. Native validation runs on submit. After a failed submit, show an inline message next to the section plus one form-level `.form-error` with `role="alert"`. Success messages use `role="status"`. High-value flight forms keep their review/blocker panel (`.entry-save-blockers`, `.entry-blocker-link`).
- **Pending contract.** Every server-action submit uses `components/pending-action-button.tsx`, which must sit inside the `<form action={…}>`. It reads `useFormStatus` and, while pending, sets `disabled`, `aria-busy` and `data-loading="true"`, and swaps in `pendingLabel`. Use an action-specific label with an ellipsis character: "Saving…", "Removing…", "Requesting…". CSS in `ui-system.css` adds a spinner via `::after` and dims the button to `--ui-loading-opacity`. `form[aria-busy="true"]` dims its submit buttons the same way. Wrap the label in `PendingActionLabel` (`current` plus a hidden `reserve` label) so the width stays the same during the swap.
- **Unsaved changes.** Flight entry and edit forms use `use-unsaved-form-guard.ts` (`markDirty`, `beginSubmit`), which warns on unload and on in-app link clicks.
- **No silent automation.** Suggestions such as airport detection or GPS candidates require an explicit pilot choice. Ambiguous GPS values go to pilot review.

## 7. Data display conventions

Use the helpers in `lib/display-format.ts`, not ad-hoc `toLocaleString`:
- `formatDateOnly("YYYY-MM-DD")` gives `DD/MM/YYYY` with no timezone conversion. Form and storage values stay ISO.
- `formatUtcTime` and `formatUtcDateTime` handle flight timeline and evidence times (off-block, takeoff, landing, on-block, GPS samples) and always append ` UTC`.
- `formatLocalDateTime(value, timeZone)` handles non-flight metadata, using the **viewer's own** `user_settings.timezone` (fallback `Europe/Prague`), never the timezone of the pilot being viewed.
- Durations are `H:MM` (`formatDuration` in `lib/data/dashboard.ts`; `formatEasaDuration` for FCL.050).

Other conventions:
- UI language is English, with `en-GB` number grouping.
- Routes are written `DEP → ARR`. A missing value is an em dash `—`.
- In-app GPS shows altitude in ft (metres only as secondary text), distance in km and speed in km/h. The social Story artifact uses knots.
- Login and join say "Email", settings says "Account email", and "Pilot email" is used only when searching for another pilot. Copy is operational and literal, not marketing.

## 8. Accessibility rules

- **Focus.** The effective ring is a 2 px solid outline in `var(--accent2)`, offset 2 px, plus the `var(--focus-ring)` halo (from `globals.css` and `v150-ui-system.css`). Never write `outline: none` on an interactive element. A custom ring must be at least as visible, use `--focus-color` or `--accent2`, and keep a 2 px offset. Focused elements inside sticky chrome need a `scroll-margin`, which the flight form and modals already set.
- **Keyboard.** Every action must be reachable and operable by keyboard in a logical order. Only real buttons and links get click handlers, never a `div`/`span` with `onClick`. Escape closes dialogs and menus, and focus returns to the opener. The skip link `.skip-link` → `#main-content` is in the shell, and the mobile nav drawer traps focus and closes on Escape.
- **Contrast.** Normal text must reach WCAG AA (4.5:1) in both themes. Follow the token rules in section 3 and never stack `opacity` on `--muted` text.
- **Touch targets.** At least 44 px tall on coarse pointers and at ≤ 820 px. Icon-only controls must also be at least 44 px **wide** (`v300-u6-acceptance.css` lists `.mobile-toggle`, `.sidebar-toggle`, `.modal-close`, `.aircraft-crop-close`, `.play-button` and the notification bell; add new icon buttons there). Checkboxes and radios are at least 20 px.
- **Live regions.** Errors use `role="alert"` and async success or progress uses `role="status"`. The offline banner uses `role="status" aria-live="polite"`. Status must never be carried by colour or a hover-only badge alone.
- **Reduced motion.** A global `prefers-reduced-motion: reduce` rule collapses all transitions and animations to .01 ms (`globals.css`, `v1342-ui-polish.css`). New motion still needs a static alternative that keeps the state feedback. Because of the global rule, the pending spinner freezes, so the pending label text must carry the state on its own.
- **Forced colors.** `forced-colors: active` rules give buttons a `ButtonText` border and mark the active nav item with `Highlight`. Keep custom controls visible in that mode.
- **Zoom.** Never disable pinch zoom (the viewport is `width=device-width, initial-scale=1, viewport-fit=cover`). Layouts must reflow at 200% zoom.

## 9. Responsive, iPad, touch and PWA

| Breakpoint | Behaviour |
| --- | --- |
| > 820 px | Desktop shell: sticky left sidebar (218 px, collapsible, from `sidebar-adaptive-v42.css`), content max width about 1760 px |
| ≥ 821 px and `pointer: coarse` | iPad landscape and iPad Pro portrait: desktop sidebar plus a round 44 px edge handle `.sidebar-toggle` at mid-height |
| ≤ 820 px | **Mobile shell**: the sidebar becomes a 64 px sticky top bar with an overlay nav drawer (`min(340px, 88vw)`), 16 px inputs, 44 px controls, safe-area padding. Includes iPad portrait at 768/810/820 |
| ≤ 760 / 700 px | Grids collapse. The Flights table becomes phone scan cards (≤ 700). Page-header actions stack |
| ≤ 600 px | Single-column forms, full-width page-header action. Measured content padding at 390 px is `84px 12px 24px` (the top includes the shell bar) |
| ≤ 360 px | Smallest-phone fixes: sticky save bar becomes static, blockers stack |

Further rules:
- Use capability queries for input behaviour: hover styles go inside `@media (hover:hover) and (pointer:fine)`, and touch sizing goes inside `@media (pointer:coarse)`. Never sniff the user agent.
- Prefer the existing breakpoints (820, 700, 600, 360, and 1100/1180 for wide-grid reflow) over new ones.
- Containment: grid and flex children get `min-inline-size: 0` (`v156-mobile-hardening.css`), `body` uses `overflow-x: clip` at ≤ 820 px, and wide content scrolls inside `.table-scroll`. Never hide overflow globally to mask a layout bug.
- Use `dvh` for viewport-tall surfaces and `env(safe-area-inset-*)` for fixed or sticky elements. Fixed bottom actions must not cover the primary action or the iOS keyboard. On coarse pointers the flight form's sticky save bar is intentionally static.
- Test at 320 or 360, 390, 768, 820 or 834, 1024, and 1280 or 1440 px, in both themes. Chromium touch emulation does not prove iOS Safari behaviour; say so when a change was not tested on real hardware.
- PWA: `app/manifest.ts` (standalone, start `/dashboard`, shortcuts "Add flight" and "Flights"). `public/sw.js` is **intentionally online-only**: it handles install, push and notification clicks and has no fetch caching, so do not add offline caching or queued mutations. `components/pwa-client.tsx` registers the worker and shows the offline banner `.connection-status-banner`. Install and push controls live in `install-app-control.tsx` and `push-notification-*.tsx`. `@media (display-mode: standalone)` adds safe-area padding.
- Print: FCL.050 output has its own `@media print` rules (A4 landscape) and `app/(protected)/print/print.module.css`. Do not change print dimensions as part of screen UI work.

## 10. Checklist for a UI change

1. Find the rules that actually win: check the import order in `app/layout.tsx`, specificity and `!important`, and confirm the computed style in a browser in **both** themes.
2. Reuse an existing class, component or token. Add new rules to the stylesheet that already owns that surface, or to `app/ui-system.css` for shared patterns. **Do not create another versioned CSS file.**
3. Cover every state: default, hover (fine pointer only), focus-visible, pending, success, error, empty, disabled and destructive confirmation.
4. Check keyboard, touch and mouse, the widths listed in section 9, and reduced motion.
5. Many tests in `tests/` regex-match CSS source and `layout.tsx` import order. Run the matching files with `npm run test:target -- tests/<file>.test.ts`, or run everything with `npm test`. Update the assertions deliberately when you move a rule. Browser checks go through `npm run test:browser`.

## 11. Known structural debt (input for CSS consolidation)

All figures below were measured on this checkout. "Effective" values come from headless Chrome computed styles over the stylesheets concatenated in import order. That is not the live app, so re-verify any value you rely on.

- **47 global stylesheets.** `app/layout.tsx` imports 46 files from `app/` plus `leaflet/dist/leaflet.css`, about 429 KB of app CSS. `globals.css` is 160 KB and is itself 13 concatenated historical files (`/* Source: app/v082.css */` … `v121.css`) with later version sections appended. `ui-system.css` is 78 KB. Next come 30 version-named files (`v1342-…` through `v301-…`) and 8 unversioned feature files. CSS modules are separate: `components/sidebar.module.css`, which both the sidebar and the notification bell use, plus `notifications.module.css` and `print.module.css`.
- **Load order does not match the intended layering.** The order is `globals → leaflet → theme → dashboard-customization → light-interactions → v1342 → v135…v162 → v150 (mid-list) → v250 → v300-* → v301 → v300-u6 → dashboard-editorial → ui-system → flight-detail-f3 → flights-balanced-glassless → sidebar-adaptive-v3 → sidebar-adaptive-v42`. The "final" colour layer (`v150`) is loaded in the middle, and `ui-system.css` is followed by four later files.
- **Zero-specificity canonical rules lose.** `v150-ui-system.css` (20 `:where()`) and `ui-system.css` (33 `:where()`) define the token contract with zero specificity. Element and class selectors in `globals.css`, especially its `@media screen { … }` "v1.13 aviation workspace" block, therefore override them. Consequences:
  - The primary button is hard-coded to `#4bc9aa` with an 8 px radius in both themes.
  - Controls have 7–8 px radii instead of 11 px, and nested panels have 10 px instead of 17 px.
  - `box-shadow: none !important` on panels cancels `--shadow-soft`.
  - Transitions run at .16 s, and the focus outline uses `--accent2` instead of `--focus-color`.
  - Dark inputs use the literal `#07131b` instead of `--control-bg`.
  - **Light theme bugs:** `.form-error` renders `#fda4af` on `--danger-bg` (about 1.7:1) because `globals.css` `.form-error{color:#fda4af}` beats `:where(.form-error)`. `.field-message-error{color:#f59e0b!important}` (`v158-flight-entry-polish.css`) is about 2.15:1 on white.
- **The specificity race is the escape hatch.** Later layers win with long selectors (`.app-grid .shell-workspace > .ui-page-stack > …`) and `!important`: 168 uses across app CSS (55 in `globals`, 43 in `ui-system`), plus many in `sidebar.module.css`.
- **Duplicate and conflicting tokens.**
  - `v1342-ui-polish.css` declares `--ui-radius-control:7px`, `--ui-radius-panel:9px`, `--ui-control-min:38px`, `--ui-touch-min:44px` and `--ui-hover`.
  - `ui-system.css` redeclares `--ui-radius-control:11px` and adds the parallel `--ui-radius-card`, `--ui-control-min-height` and `--ui-touch-min-height`. Inputs still use the 38 px `--ui-control-min`.
  - `globals.css` declares the palette twice (base `:root`, then the screen block with `--bg:#071018`, `--accent:#4fd1b1`, `--shadow-*: none`) before `v150` replaces it.
  - Aliases overlap: `--panel`/`--surface`, `--panel2`/`--surface-raised`, `--line`/`--border`.
  - The dark background differs by context: `#071018` in `layout.tsx` `themeColor` and `--flytally-chrome` (`v136-mobile.css`), but `#07111f` in `v150`, `manifest.ts` and the standalone rule.
  - `v150` repeats the full light token block three times and the dark block twice, once per theme scope.
- **Theme by override, not by token.** 1,077 hex literals remain (604 in `globals.css`, 175 in `v150`, mostly token definitions, and 118 in `theme.css`). Dark styling relies on literals in `globals.css`. Light styling is patched by 329 `html[data-theme="light"]` selectors across 19 files (222 in `theme.css`, 29 in `light-interactions.css`, others in feature files). The `.app-grid[data-appearance]` and `html:has(.app-grid[data-appearance])` scopes add a parallel mechanism.
- **The same concern is spread across many files.** Each item below is defined in several files:
  - `.primary-button`: 15 files. `.secondary-button`: 13. Form `input` rules: 16.
  - `.sidebar`: 9 global files plus `sidebar.module.css`. `sidebar-adaptive-v3.css` and `sidebar-adaptive-v42.css` both restyle the desktop sidebar at ≥ 821 px, and v4.2 exists to "resolve V3/legacy cascade".
  - `.page-header` and `.panel`: 8–9 files each.
  - The 44 px touch minimum: `globals.css` (1.23 mobile ergonomics, with 44/46/48/50 px variants), `v1342` (≤ 820), `ui-system` (`pointer:coarse`), `v300-u6-acceptance` (≤ 820 or coarse) and `flight-detail-f3`.
  - The reduced-motion kill switch: twice (`globals.css` v1.13 and `v1342`), plus 6 file-local blocks.
- **Breakpoint sprawl.** There are 33 distinct width values. The main ones are 820 (31 uses), 700 (32), 600 (32), 760 (20), 520 (10), 1100 (9), 900 (8) and 360 (5). One-offs include 350, 380, 430, 460, 480, 560, 610, 620, 650, 720, 780, 800, 850, 980, 1000, 1150, 1180, 1200, 1280, 1400, 1499 and 1500. 760 and 700 overlap the role of 820 and 600.
- **Dead or overridden declarations.** Example: the early `.login-card` rule (24 px radius, backdrop blur) is overridden later in the same file. Older tokens such as `--ui-radius-panel` are used only twice. Off-scale structural spacing (14, 15, 18, 22, 26, 28, 30 px) remains in older sections.
- **History in the names.** Class prefixes `u31-`, `u33-`, `d1v11-`, `flight-f3-` and file names encode release or batch history rather than components.
- **Component-level gaps.** The modal focus trap is copied by hand in four components (`aircraft-manager`, `aircraft-photo-editor`, `flight-entry-workspace`, and the mobile nav in `sidebar.tsx`) with no shared hook. The `void-certified-flight-button.tsx` dialog has `aria-modal` but no Escape handling and no focus trap. There are still 25 inline `style={{…}}` blocks in TSX, for example the shell footer in `app-shell.tsx`.
- **Tests lock the cascade.** 72 test files in `tests/` read CSS source and regex-match exact declarations, and 51 read `app/layout.tsx`, some asserting import order. Any consolidation must migrate these tests in the same change.

Suggested consolidation direction (to decide later):
1. One token file: colour per theme scope, plus spacing, radius and motion.
2. One base/reset layer that replaces the `globals.css` legacy blocks.
3. A component layer.
4. Per-feature files named by surface, not by version.
5. Use `@layer` instead of `:where()` and `!important` so that order and specificity are explicit.
6. Snapshot computed styles of key screens, in both themes and at several widths, before and after the change.
