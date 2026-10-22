---
name: mobile-ipad
description: Apply to FlyTally Logbook PWA/mobile/iPad layout, touch, keyboard, Safari, viewport, safe areas, scrolling, gesture affordances and multi-input device behavior.
---
# Mobile and iPad Experience

## Source basis
Adapted from Emil Kowalski mobile-native and apple-design in the user-provided skills-main.zip; see docs/skills/THIRD_PARTY_SOURCES.md.

## Procedure
1. Determine actual page purpose, input types and responsive CSS, not only a desktop screenshot. Identify which behaviors vary by viewport versus capabilities (hover/pointer).
2. Test narrow mobile 320/390, iPad 768/1024 and relevant desktop widths, portrait/landscape if task demands, and each supported light/dark/night theme.
3. Ensure scrolling and touch targets work with finger and pointer/trackpad; capability media queries beat user-agent sniffing. Never disable zoom; keep interactive fields readable.
4. Check safe-area insets, dynamic viewport units, iOS keyboard overlays, sticky headers, fixed actions, modal/sheet scroll, horizontal overflow, tap highlights and sticky hover behavior.
5. Keep important actions exposed and affordant, preserve focus/keyboard traversal and meaningful loading feedback, and prevent accidental destructive gesture outcomes.
6. If behavior is iOS-specific, test on real Safari hardware when available; otherwise mark native behavior NOT RUN and document what Chrome emulation cannot prove.
7. Compare screenshots with existing FlyTally UI baseline; do not redesign other screens as side effect.

## Hard stops
No device sniffing as a primary strategy, no blanket overflow suppression hiding important content, no disabled pinch zoom, no optional autopopulation of flight data.

## Verification
Use ui-ux-design and ui-quality-audit for screen review; testing-quality and DEVELOPMENT.md for exact-candidate browser gate and native/manual evidence distinctions.