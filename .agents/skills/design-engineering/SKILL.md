---
name: design-engineering
description: Apply to FlyTally Logbook visual craft, feedback, typography, motion, transitions, focus and component interaction quality, adapting Emil Kowalski and Apple web design principles.
---
# FlyTally Design Engineering

## Source basis
Adapted from user-provided Emil Kowalski skills-main.zip: emil-design-eng, apple-design, animate, animation-performance and review-animations. Attribution/licence: docs/skills/THIRD_PARTY_SOURCES.md. This is NOT a license to import example libraries or override repo design.

## Procedure
1. Inspect the real final computed cascade, shared tokens, components and design language before suggesting change. Define intended hierarchy and why an existing component cannot solve it.
2. Decide whether motion adds value at all. Prefer instant response on interaction; animate only state changes that communicate causality, orientation or feedback.
3. Keep motion subtle, short, reversible and interruptible where user-controlled. Avoid long waits, gratuitous entrance animation, fake loading and repeated attention capture.
4. Animate compositor-friendly transform/opacity when possible; avoid transition: all, repeated layout thrashing and unnecessary JS effects. Use current on-screen state for gesture continuity.
5. Maintain anchored/spatially coherent transitions; focused elements and modal focus return must remain predictable. Respect prefers-reduced-motion, keyboard accessibility and contrast.
6. Review type sizes, tracking/line-height, target affordances, spacing rhythm, visual density and hover/pressed/disabled/focus states across desktop, iPad and phone.
7. Provide before/after rationale and a browser verification matrix. If rendering or hardware isn't accessible, do not claim the animation feels right in runtime.

## Hard stops
No blanket backdrop blur, heavy glass effects, new dependency or spring library by default. No distracting cockpit movement or loss of legibility. Do not change approved brand direction while doing interaction polish.

## References
Load ui-ux-design as parent, mobile-ipad for touch, ui-quality-audit for edge cases. Compare to current CSS and runtime rather than copy-pasting parameters from upstream tutorials.