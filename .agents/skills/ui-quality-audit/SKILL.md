---
name: ui-quality-audit
description: Apply to adversarial FlyTally UI audits: realistic worst-case fixtures, accessibility/focus, empty/error states, responsive breakage, loading and animation regressions.
---
# UI Quality Audit

## Source basis
Adapted from Emil Kowalski break-ui, review-animations, improve-animations and animation-performance from user-provided skills-main.zip; see docs/skills/THIRD_PARTY_SOURCES.md.

## Design Quality V2 external review (2026-10-24)
For new UI, design critique or significant visual changes, read [External Design Quality V2](references/EXTERNAL_DESIGN_QUALITY_V2.md) in addition to this skill and required Apple Design material. It adapts Vercel interface guidelines, Hallmark audit/study, UI UX Pro Max, Kombai references and optional shadcn component research to current FlyTally identity. No auto-redesign or blind upstream installer. For advisory source check use `npm run audit:design`; its clean result is not browser/WCAG acceptance.

## Procedure
1. Freeze screenshot/DOM/CSS baseline and actual acceptance constraints before inspecting. A report must distinguish observed bug, source inference and unverified hypothesis.
2. Build synthetic, plausible worst-case data THROUGH the same component/API boundaries: long Unicode pilot names, narrow cards, long airfield names, many roles, no records, empty optional fields, zero/nonzero distinctions, large counts, truncated track labels and invalid inputs.
3. Never insert private data or make a debug worst-case toggle visible to production. Dev-only fixtures are fine where guarded.
4. Check both mouse/keyboard and touch for affordance, focus order, destructive confirmation, async pending/duplicate submit, error recovery, disabled states and meaningful accessible labels.
5. Check mobile 320/390, iPad 768/1024, desktop, themes, reduced-motion, and screen-reader semantics. Explicitly state which require native Safari/manual validation.
6. Issue a severity-ordered finding table: observed vs expected, exact location, evidence, proposed minimal fix, affected contract and necessary regression tests. Separate unrelated issues from task scope.
7. Re-test each actual fix and preserve baseline when an audit claim proves incorrect; don't delete existing CSS merely because a redundant declaration looks odd.

## Hard stops
No automatic redesign, no broad CSS cleanup, no fabricated screen evidence, no silent acceptance of untested UI. Respect current owner-frozen design and domain behaviors.

## Verification
DEVELOPMENT.md candidate policy and testing-quality skill. No PASS without executed evidence.