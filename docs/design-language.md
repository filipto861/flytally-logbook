# FlyTally design language

Status: extracted from the current production code on `main` at `6f871779af27a6380bd0b77d3969bffcb84e9d7a`.

This document records the design language that already exists. It is descriptive, not a redesign brief. The approved FlyTally identity is frozen: colors, logo, typography direction and overall product feel remain the source of truth.

## Source precedence

The root layout imports `app/globals.css`, theme/product layers and versioned compatibility layers, then imports `app/ui-system.css` last. Effective styling therefore comes from both cascade order and selector specificity.

The current canonical sources are:

| Concern | Canonical source |
| --- | --- |
| Brand / semantic color tokens | `app/v150-ui-system.css` |
| Spacing, geometry and async interaction contract | `app/ui-system.css` |
| Global focus / reduced-motion fallback | `app/v150-ui-system.css`, `app/v1342-ui-polish.css` |
| Mobile safe-area / zoom / touch hardening | `app/v300-u6-acceptance.css` |
| Navigation icon language | `components/nav-icon.tsx` |
| Light-mode compatibility overrides | `app/theme.css`, `app/light-interactions.css` |
| Legacy component styling | `app/globals.css` and versioned CSS files |

Older tokens in `app/v1342-ui-polish.css` such as 7 px control radius and 9 px panel radius are not the final geometry because `app/ui-system.css` is loaded later and establishes the current 11 px / 17 px contract for canonical controls and cards.

## Color system

### Dark

| Token | Value | Use |
| --- | --- | --- |
| --bg | #07111f | App background |
| --panel / --surface | #0e1b2d | Main cards and panels |
| --panel2 / --surface-raised | #13243a | Raised controls and secondary surfaces |
| --surface-muted | #0b1727 | Muted surface |
| --surface-hover | #172b43 | Hover surface |
| --line / --border | #203650 | Default borders |
| --line-soft | #192d44 | Quiet dividers |
| --line-strong | #36516f | Strong interactive border |
| --text | #edf5ff | Primary text |
| --text-soft | #c7d6e7 | Secondary text with strong contrast |
| --muted | #8ea3bb | Muted text |
| --accent | #34d399 | Primary brand green |
| --accent-strong | #10b981 | Strong primary green |
| --accent2 | #38bdf8 | Brand blue |
| --link | #67d5fb | Text-link blue |
| --focus-color | #5eead4 | Keyboard focus outline |
| --success-text | #86efac | Success text |
| --warning-text | #fbbf24 | Warning text |
| --danger-text | #fda4af | Destructive/error text |
| --info-text | #7dd3fc | Informational text |

Dark soft shadow is `0 10px 30px rgba(0,0,0,.16)`; raised shadow is `0 18px 48px rgba(0,0,0,.24)`.

### Light

| Token | Value | Use |
| --- | --- | --- |
| --bg | #f4f7fb | App background |
| --panel / --surface | #ffffff | Main cards and panels |
| --panel2 | #eef3f8 | Secondary panel |
| --surface-raised | #f8fafc | Raised control / quiet card |
| --surface-muted | #f1f5f9 | Muted surface |
| --surface-hover | #eaf1f7 | General hover surface |
| --line / --border | #d5dee8 | Default borders |
| --line-soft | #e4eaf0 | Quiet dividers |
| --line-strong | #b6c5d5 | Strong interactive border |
| --text | #102033 | Primary text |
| --text-soft | #34485f | Strong secondary text |
| --muted | #66788d | Muted text on light surfaces |
| --accent | #0b946e | Primary brand green |
| --accent-strong | #087557 | Strong green / accessible small text |
| --accent2 | #087fb8 | Brand blue |
| --link | #066f9f | Accessible text-link blue |
| --focus-color | #087fb8 | Keyboard focus outline |
| --success-text | #087557 | Success text |
| --warning-text | #9a5b00 | Warning text |
| --danger-text | #b4233a | Destructive/error text |
| --info-text | #066f9f | Informational text |

Light soft shadow is `0 10px 30px rgba(15,35,55,.07)`; raised shadow is `0 18px 48px rgba(15,35,55,.12)`.

The approved accent gradient `linear-gradient(135deg,var(--accent2),var(--accent))` is used for brand marks. It is part of the existing identity and is not a generic decorative gradient.

## Typography

The current stack is:

`Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

No bundled Inter font is present, so systems without Inter use the native UI font.

Current recurring hierarchy:

| Role | Existing pattern |
| --- | --- |
| Page H1 | clamp(1.8rem, 3vw, 2.5rem), letter-spacing -0.04em |
| H2 | Native size with letter-spacing -0.02em; component layers set sizes when needed |
| Eyebrow / kicker | ~0.72rem, weight 800, uppercase/letter-spaced |
| Form label | ~0.86rem, weight 700 |
| Table header | ~0.72rem, uppercase, letter-spacing 0.08em |
| Table body | ~0.90rem |
| Operational supporting text | mostly 0.62rem–0.78rem |
| Large metric | 1.3rem–2rem depending hierarchy |
| Hero metric | clamp(3rem, 6vw, 5.2rem) |

Numeric totals already use tabular figures in important metric selectors. This is not yet universal for timestamps, pagination and dense numeric table data.

## Spacing

The current canonical scale in `app/ui-system.css` is:

| Token | Value |
| --- | ---: |
| --ui-space-1 | 4 px |
| --ui-space-2 | 8 px |
| --ui-space-3 | 12 px |
| --ui-space-4 | 16 px |
| --ui-space-5 | 20 px |
| --ui-space-6 | 24 px |
| --ui-space-8 | 32 px |
| --ui-space-10 | 40 px |

Layout contracts:

- Card gap: 16 px.
- Section/page gap: 24 px.
- Card padding token: 22 px.
- Mobile card padding token: 16 px.
- Default control minimum height: 40 px.
- Touch minimum height: 44 px.
- `.ui-page-stack` owns the vertical rhythm for current high-frequency routes.

Legacy CSS still contains 5, 6, 7, 9, 10, 14, 15, 18, 22, 25, 28 and 30 px one-off gaps/margins. Some are legitimate micro-layout values, but repeated structural spacing outside the canonical scale is a deviation.

## Radius, borders and elevation

Canonical geometry:

- Controls: 11 px radius.
- Cards/panels: 17 px radius.
- Status pills/badges: 999 px.
- Borders: 1 px `var(--line)`; stronger interactive borders use `var(--line-strong)`.
- Focus outline: 2 px `var(--focus-color)`, offset 2 px, plus `var(--focus-ring)`.
- Soft card elevation: `var(--shadow-soft)`.
- Dialog/raised elevation: `var(--shadow-raised)`.

Existing exceptions include 18–24 px modal/auth/public-view radii and several bespoke shadows. They should be treated as deviations unless the surface is intentionally modal/raised.

## Motion

The current canonical interaction transition is `0.14s ease` for background, border, color, opacity and small transforms.

The loading spinner is 0.7 s linear. Reduced-motion is already globally protected in `app/v1342-ui-polish.css`: all transitions and animations collapse to 0.01 ms and scroll behavior becomes automatic.

A few older components still use 0.15 s, 0.16 s, 0.22 s, 0.25 s or 0.08 s timings.

## Icons

Canonical navigation icons are custom inline SVGs in `components/nav-icon.tsx`:

- 24 × 24 viewBox.
- Rendered at ~19–20 px.
- `fill="none"`.
- `stroke="currentColor"`.
- Stroke width 1.8.
- Round line caps and joins.
- Decorative SVGs use `aria-hidden="true"`.

The repo still contains Unicode / emoji glyphs used as functional icons (bell, aircraft, warning/check marks, play/pause, plus, close and chevrons). These are deviations from the SVG icon language.

## Components

### Buttons

Canonical families:

- `.primary-button` / `.primary-link`: main action, brand accent fill.
- `.secondary-button` / control-like `.secondary-link`: neutral action.
- `.danger-button` / `.delete-button` / `.icon-danger`: destructive action.
- `.detail-button`: compact contextual action.
- `.ghost-button`: low-emphasis navigation/action.

Async server actions should use `PendingActionButton` or the same contract manually:

- disabled while pending,
- `aria-busy`,
- `data-loading="true"`,
- visible pending label,
- duplicate submissions blocked.

### Inputs

Inputs, selects and textareas share:

- 1 px control border,
- 11 px effective control radius where canonical rules apply,
- 40 px minimum control height,
- 44 px touch target expectation,
- focus ring from the semantic focus tokens,
- 16 px font size on narrow mobile screens to prevent iOS zoom.

### Panels and records

The base card language is a bordered surface with 17 px effective radius. Dense record lists and tables are preferred over stacking decorative cards when the content is inherently tabular.

### Tabs / segmented controls

Segmented controls use a bordered container with a subtle active surface. Flight-detail tabs use semantic `role="tablist"`, `role="tab"` and `role="tabpanel"`.

### Modals

The best existing modal pattern is the aircraft manager / quick-aircraft dialog:

- `role="dialog"` + `aria-modal="true"`,
- labelled title,
- Escape closes,
- focus is trapped,
- opener focus is restored,
- safe-area-aware mobile layout.

### Toast/status feedback

The app mostly uses inline `.form-success`, `.form-error`, status badges and notification cards rather than floating toasts.

## States

Existing state language:

- Loading: pending label + spinner + reduced opacity.
- Disabled: not-allowed cursor and reduced opacity.
- Error: danger semantic text/surface.
- Success: success semantic text/surface.
- Warning: warning semantic text/surface.
- Empty: both compact `.empty-state` and larger guided/flight empty states exist.
- Offline: the PWA is intentionally online-only; no explicit offline UI state currently exists.
- Focus: global focus-visible outline and shadow.
- Hover: semantic surface/border changes on pointer-capable devices.

## Forms

- Labels are nested directly around controls.
- Native `required` is widely used.
- Most validation is native + server-action validation.
- High-value flight forms also expose inline review/missing-field state.
- Error messages should use `role="alert"`; successful asynchronous feedback should use `role="status"`.
- Numeric flight durations use H:MM text entry where applicable rather than decimal hours.
- Date/time controls use native `type="date"` and `type="time"`.
- Email controls use `type="email"`.
- Decimal money inputs use `type="number"` and decimal steps.

There is no single visual required-field marker yet.

## Data display

Intended/current conventions:

- UI language: English.
- Date display: day-first / `en-GB` when formatted.
- Date form values and storage-facing date strings: ISO `YYYY-MM-DD`.
- Flight timeline fields (off-block, takeoff, landing, on-block): UTC and labelled as UTC.
- FCL.050 print flight times: UTC.
- User-facing non-flight timestamps: intended to follow the user's screen time-zone preference; current code is not fully consistent.
- Duration: H:MM, e.g. `1:30`, never decimal hours for logbook time.
- Numbers/costs: `en-GB` grouping where formatted.
- Route separator: `DEP → ARR`.
- Missing value: em dash `—`.
- GPS distance: km in the app.
- GPS altitude: ft is the dominant current player convention; one legacy profile also shows metres.
- GPS speed: km/h in the in-app player; the social Story artifact uses knots.

Currency behavior is business-rule adjacent and is not redefined by this design document.

## Navigation and page headers

Protected high-frequency routes use:

- `.ui-page-stack` as the route container,
- `.page-header` for title + primary actions,
- eyebrow → H1 → concise muted lead,
- action group on the right desktop / full-width stacked actions on mobile.

Primary navigation is the persistent sidebar; mobile converts it to an overlay with focus management.

## Mobile / PWA

- Mobile-first hardening uses safe-area insets.
- Content protects against horizontal overflow.
- Form controls are forced to 16 px font size at narrow widths.
- Coarse-pointer controls are expected to reach at least 44 px.
- Modal height uses `dvh`.
- The service worker is intentionally online-only and exists for installability / push; it does not cache logbook navigation or API data.

## Dark mode

Dark mode is a first-class token set, not a color inversion. Surfaces, borders, controls, charts and Leaflet UI all have explicit semantic values. Theme choice supports light, dark and system preference.

User-uploaded aircraft photos and map imagery are not color-inverted.

## Accessibility baseline

Already present:

- skip-to-content link,
- global focus-visible ring,
- mobile navigation focus trap and Escape handling,
- main aircraft modal focus trap,
- 44 px coarse-pointer height baseline,
- safe-area handling,
- iOS input zoom prevention,
- reduced-motion fallback,
- forced-colors fallback,
- labelled navigation and many form controls,
- ARIA live/alert/status usage in newer workflows.

The audit documents remaining gaps without changing the visual identity.

## Current self-deviations

The current code deviates from its own design language in five recurring ways:

1. Legacy/versioned CSS still hard-codes values that now have semantic tokens.
2. Structural spacing outside the 4/8/12/16/20/24/32/40 scale remains in older workspaces.
3. Several older server-action forms do not use the shared pending contract.
4. Unicode/emoji functional icons coexist with the canonical SVG icon set.
5. Date/time formatting, full-page empty/error states and a few public/auth surfaces have not fully converged on the current component patterns.

These are consistency issues, not a request to rebrand FlyTally.
