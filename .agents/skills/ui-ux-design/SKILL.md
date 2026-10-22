---
name: ui-ux-design
description: Apply to FlyTally Logbook page consistency, navigation, forms, design-system reuse, content hierarchy, loading/error/empty/destructive states, and usability changes.
---
# UI / UX Design and Consistency

## When to load
Any modification to a page, component, form, design token, layout, navigation or interaction feedback.

## Procedure
1. Inspect the actual rendered page, relevant React components, CSS imports and FINAL effective cascade (including media queries and themes). Confirm that a reported issue actually exists.
2. Audit existing shared patterns before adding variants: typography, spacing, card geometry, button hierarchy, color tokens, alignment, affordances, focus and disabled states. Reuse established components.
3. Map interaction states: initial, hover/touch, focus-visible, pending, success, validation failure, empty, permission denied, disabled and destructive confirmation.
4. Every async action shows unmistakable feedback, prevents duplicate submission, and preserves a recoverable path. No raw errors, dead controls or hidden destructive side effects.
5. Favor simple cockpit-friendly tasks and readable information over motion or decoration. Keep labels literal, navigation predictable and calls to action visible without being misleading.
6. Never auto-prefill user-critical aviation data or auto-apply a choice to simplify a form without explicit product approval.
7. Validate relevant desktop, 320/390 mobile and 768/1024 iPad layouts, light/dark and any night mode actually present; distinguish emulator from native Safari/hardware.

## Coordination
Load design-engineering for motion/typography details, mobile-ipad for platform behavior, ui-quality-audit for adversarial cases. Domain correctness stays governed by flight-integrity and aviation-regulatory.

## Hard stops
Do not replace branding/tokens, introduce a new library, or overhaul unrelated CSS as a shortcut. No styling fix based solely on an overridden declaration; verify actual computed behavior first.

## References and verification
ARCHITECTURE.md, DEVELOPMENT.md, present app CSS/components, ongoing U0/U1/U2 UX PRs; run scope-selected source, browser and accessibility checks. Report screenshots/manual checks as NOT RUN if unavailable.