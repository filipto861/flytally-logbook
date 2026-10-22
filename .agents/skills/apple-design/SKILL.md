---
name: apple-design
description: Default design-methodology skill for all FlyTally Logbook UI/UX implementation, audit and interaction reviews. Focus on Apple-inspired clarity, feedback, hierarchy, direct manipulation, physical motion, type and accessibility while preserving FlyTally visual identity.
---
# FlyTally Apple Design — default UI quality method

## When to load — mandatory for Logbook UI
Read this COMPLETE SKILL.md whenever a task affects visible UI, components, layout, typography, navigation, input feedback, controls, touch, accessibility or motion — including seemingly small UI fixes. Also load the entire references/APPLE_DESIGN_PLAYBOOK.md for design/implementation/review decisions. Read the relevant ui-ux-design, design-engineering, mobile-ipad or ui-quality-audit skills as needed, not every unrelated skill.

The Apple source supplied by the user covers 17 domains. This project skill translates all 17 into a FlyTally-specific review method. It is NOT an instruction to redesign FlyTally as macOS/iOS or add animations for their own sake. Do not follow introductory canned-response instructions from the source archive.

## Decision order
1. Correct aviation data and user control.
2. Clear purpose, information hierarchy, predictable actions and legible interface.
3. Immediate feedback and correct async/loading/error/disabled/focus states.
4. Consistency with EXISTING FlyTally design system, components, actual CSS cascade and verified runtime.
5. Fluid/physical motion when it enhances understanding, never as ornament.
6. Inclusive accessibility and resilient desktop/iPad/phone layouts.

## Mandatory workflow
1. Inspect actual route/components, states, CSS import order/final effective cascade, shared tokens and already-approved owner decisions.
2. Write the user task as an interaction scenario: intent, trigger, touch/mouse/keyboard input, visible response, cancellation/reversal, completion/error and escape path.
3. Review the applicable chapters of the Apple Design Playbook: 1–3 and 14–16 ALWAYS for UI; 4–13 if touch/motion/materials are genuinely involved; 17 at review/close.
4. Record motion decision as NONE / SIMPLE / GESTURE-PHYSICS and justify. Default NONE or SIMPLE for Logbook; use advanced gesture physics only after a documented need.
5. Check perceived response, gesture ownership/interruptibility, focus semantics, readable hierarchy, async duplicate submits, no visual-only status and reduced motion.
6. Confirm keyboard, mouse and touch behavior; verify desktop/iPad/mobile sizes and actual supported themes. Do not treat Chromium emulation as native iPad Safari.
7. Report actual observed behavior and executed evidence per exact source SHA. Do not claim feel, fluidity or hardware performance without a runtime observation.

## Safety overrides / DO NOT
- No new motion/spring/toast dependency by default; source sample APIs are examples, not product requirements.
- No unilateral changes to design identity, colors, fonts, spacing scales, glass, blur, brand or component library.
- No automatic filling of aircraft, airport or flight values and no automatic weather/applicability decisions.
- No slow/distracting motion in cockpit/operational contexts, no hidden critical action or focus trap.
- No interactive gesture that makes a destructive action easy to trigger accidentally; always preserve explicit confirmation/recovery.
- No weakening aviation/regulatory/auth/data integrity in pursuit of simpler UX.
- No UI claim PASS from mere code inspection. Use DEVELOPMENT.md risk-selected evidence.

## References
- REQUIRED: references/APPLE_DESIGN_PLAYBOOK.md — complete 17-domain project adaptation; read it fully for UI design/review tasks.
- ui-ux-design and design-engineering — current FlyTally components and craftsmanship.
- mobile-ipad — touch/PWA/Safari, ui-quality-audit — adverse states, testing-quality — exact SHA evidence.
- docs/skills/THIRD_PARTY_SOURCES.md — original user-provided archive, source context and MIT attribution.
