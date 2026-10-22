# Apple Design for FlyTally Logbook — detailed reference

**Provenance and limitations.** This playbook is a project-specific adaptation of the user-provided Emil Kowalski skills-main.zip, skills/apple-design/SKILL.md (17 numbered chapters, 290 source lines, MIT; see docs/skills/THIRD_PARTY_SOURCES.md). Source refers to selected Apple WWDC design material; these ideas are design guidance, not an Apple certification or a verified spec for the application. Original example numbers and algorithms are illustrative, not mandatory FlyTally values.

**Operating principle.** The best interaction is predictable, immediately responsive and easy to reverse. Safety and clarity precede delight; the cockpit/iPad user must never wait for decorative motion or mistake visual polish for verified flight data.

## 1. Response — remove perceived latency
- A user should perceive press/touch feedback immediately; keep the committed action on activation/release as appropriate, not on pointer-down when drag-to-cancel must remain possible.
- Long-running server actions display pending state, prevent duplicate submission and show completion/error. Never fabricate success before server acknowledgement.
- During direct manipulation, update position continuously, not only when pointer is released.
- Audit unnecessarily delayed input, artificial timeouts and CSS transitions that make controls feel unresponsive. Native focus/keyboard cues remain.

## 2. Direct manipulation — 1:1 tracking
- A dragged item stays under the finger and honors the exact grip offset; no jump to center when captured.
- For custom gestures, prefer pointer events, setPointerCapture where supported and short time-stamped position history.
- Avoid new gesture code for standard scrolling or input selection: first prove browser/native behavior insufficient.
- Confirm drag state does not overwrite a field, cancel a pending save or obscure aircraft-critical facts.

## 3. Interruptibility and reversible actions
- User-driven motion should stop/reverse cleanly on new input, starting from its ACTUAL currently rendered position, not an out-of-date target transform.
- Preserve velocity on reversal where a true physical gesture exists; do not create sudden position jumps or lock navigation to finish an animation.
- Distinguish animating from committing: allow cancellation of a sheet/drag without invoking an irreversible action.
- In form submissions, disabling a duplicate submit is allowed for data integrity; this differs from arbitrarily blocking navigation during a decorative transition.

## 4. Behavior and spring motion
- Consider springs only for tangible dragged/sheet objects, not every popup, tooltip or page.
- Critical damping / no overshoot is usually more appropriate for operational UI than bounce; optional spring damping ratio around 1 (illustration, NOT a package API constant) can serve as a design starting point.
- Momentum-driven flick may permit gentle undershoot/overshoot only when it improves physical continuity. Do not add motion library without owner-approved engineering justification.
- Review whether simpler existing CSS or native scroll works better than a custom physics implementation.

## 5. Velocity handoff
- On gesture release, continue from observed pointer velocity rather than abruptly resetting to zero before settling.
- Record pointer positions/timestamps; protect against noisy events, insufficient samples and excessive velocity.
- Some libraries expect absolute pixel/second velocity; others expect a normalized value (velocity / remaining distance). Use only the actual verified API contract; avoid division by zero at target.
- Not applicable to a standard button, database save or ordinary form navigation.

## 6. Momentum projection
- A flick can choose snap target based on projected travel direction/velocity, not release position alone.
- Reference model from source: projectedDelta = (velocityPxPerS / 1000) * decay / (1 - decay), source illustrative decay ~0.998. Check dimensional units, clamps and accessibility; do not impose this parameter on FlyTally globally.
- Always bound target to permitted snap points and allow immediate interruption. Do not use momentum for destructive controls or forms with uncommitted data.

## 7. Spatial consistency
- Panels/sheets generally enter and leave along the same path. A popover originates near its triggering control rather than appearing from an unrelated region.
- Preserve positional relationships across route/modal state and app navigation. Reversible transitions should not jump or shift content.
- Maintain focus return to the opener and correct accessibility semantics independent of visual exit animation.
- Avoid sticky/fixed chrome overlapping the primary action on narrow screens.

## 8. Gesture direction hints
- Intermediate movement should communicate where an object is headed, especially during controlled drag.
- If a swipe has no effect at a boundary, signal it gently rather than implying an actionable target exists.
- Skip directional hint animations for ordinary static action bars and data tables.

## 9. Rubber-banding at bounds
- Gradually resist pull beyond an edge instead of abruptly freezing when a bespoke drag surface warrants it.
- Source illustrative progressive resistance: (overshoot * dimension * constant) / (dimension + constant * abs(overshoot)), with constant ~0.55. Clamp on release; protect denominator and reduced-motion mode.
- Never rubber-band a control that represents a regulatory threshold, record deletion, or a physical aircraft limitation.

## 10. Gesture recognition
- Tap feedback on press; commit after a valid activation. Provide a cancelable pointer excursion so dragging away doesn't accidentally submit.
- Apply a small movement dead zone/hysteresis before calling something a drag; source example around 10 px is not a global setting.
- Respect horizontal/vertical scroll conflicts, native touch gestures, trackpad, keyboard and assistive inputs.
- Avoid double-tap delays on primary actions unless genuinely required; support visible alternatives to hidden gestures.

## 11. Frame-level quality
- Favor compositor-friendly transform/opacity and bounded will-change; avoid animated layout/reflow, large constant blur and main-thread work per frame.
- Observe real frame-by-frame playback under representative data load; FPS number alone does not prove visual quality.
- Screen-wide parallax, moving hero backgrounds and perpetual bounces are inappropriate in dense logbook and cockpit views.
- Measure on hardware where possible; otherwise native/device perf is NOT RUN.

## 12. Materials, depth and hierarchy
- Layering must support hierarchy, not imitate iOS glass indiscriminately. Opaque surfaces are often safer for cockpit contrast.
- If translucency has an explicit functional benefit, ensure contrast under busy maps/images, test reduced transparency, and avoid stacked glass-on-glass surfaces.
- Modals dim/backdrop to focus; non-blocking sheets should not misleadingly imply blocked interaction.
- Review visual thickness, shadows, edge separation and state-specific legibility in light/dark; never change frozen FlyTally brand tokens without approval.

## 13. Multimodal feedback
- Feedback should align with the action that caused it. Meaningful feedback includes status, completion, warning and error.
- Sound/vibration are OPTIONAL, never the sole confirmation, and must be platform-supported, consent-aware and non-disruptive.
- Do not introduce browser vibration/sound libraries to simulate native haptics. Screen-reader announcement and visible status remain the baseline.
- In flight/cockpit contexts, quiet clarity usually beats sensory effects.

## 14. Reduced motion, transparency and accessible interaction
- Respect prefers-reduced-motion: reduce; replace gesture-linked nonessential large motion with static/short fades while retaining state feedback.
- Respect contrast/transparency preferences where supported; fall back to solid readable surfaces.
- Keyboard order, visible focus, escape behavior, target sizes, legible labels and announcement semantics MUST survive motion variants.
- Avoid timed traps, rapid flashes, low-frequency loops, involuntary scrolling and status conveyed only through motion.
- Responsive visual tests alone cannot prove VoiceOver/Safari; record manual/native evidence separately.

## 15. Typography
- Hierarchy comes from size, weight, leading, tracking and spacing together, not just larger headings.
- Large display text typically tolerates tighter tracking, small text needs increased clarity; do not apply one letter-spacing to all scales.
- Dense flight tables prioritize scanability, aligned numeric values, coherent abbreviations and adequate line-height; never squeeze critical numbers for style.
- Support user text size changes, zoom and localization; layouts must flex rather than clip. Existing FlyTally font and tokens remain canonical.

## 16. Eight design foundations
1. Purpose: decide what the user is trying to accomplish; remove controls that do not support it.
2. Agency: clear, reversible user choices; no silent prefill, auto-apply or hidden irreversible actions.
3. Responsibility: protect privacy, aviation evidence and errors; respect authorization and missing-data state.
4. Familiarity: same looking controls behave the same; consistent open/close, navigation and form patterns.
5. Flexibility: keyboard/pointer/touch, desktop/iPad/mobile, themes, text size, accessibility and localization.
6. Simplicity (not merely minimalism): prioritize the common task; expose necessary context and put rare advanced options at a predictable level.
7. Craft: deliberate spacing, typography, timing, precise alignment, readable contrast, appropriate iconography and polished loading/focus/error details.
8. Delight: arises from reliability, confidence and useful fluidity; never fake success or add confetti to mask latency.

Practical audit prompts:
- Wayfinding: Where am I? Where can I go? What happens if I tap this? How do I exit?
- Mapping: Is every control adjacent to the content it affects?
- Feedback: Can users tell pending / saved / failed / disabled / warning apart?
- Trust: Does the UI distinguish a calculated value from verified aviation evidence?

## 17. Process and acceptance
- Reconstruct existing behavior + frozen design before proposing change; prototype only where approved and useful, not as a prerequisite to every fix.
- Evaluate interactions with the actual layout and representative synthetic worst-case data, not isolated screenshot glamour.
- Review small motion frame-by-frame; test start/stop/reversal and fast repeated interaction.
- Verify desktop, narrow mobile, iPad, light/dark/night actually supported and reduced motion. Distinguish native Safari from Chromium touch emulation.
- Output: scenario, motion decision NONE/SIMPLE/GESTURE-PHYSICS, before/after behavior, edge cases, exact-SHA tests and remaining NOT RUN areas.

## FlyTally decision examples
| Scenario | Apple principles to apply | Preferred default |
| --- | --- | --- |
| New Flight Save | 1, 3, 14, 16 | Immediate pending state, duplicate-save lock, visible server result; no decorative animation |
| Aircraft deletion | 3, 7, 14, 16 | Explicit confirm, block when flight-linked, persistent announcement, predictable focus |
| Mobile filter tabs | 1, 7, 10, 15, 16 | Easy-to-scan tabs, keyboard/touch consistency; no overflow clipping |
| Map layer selector | 7, 11, 12, 14 | Anchored popover; good contrast over imagery and keyboard close |
| Custom draggable sheet (only if approved) | 2–10, 14 | Capture/grab offset, hysteresis, interruptible physics, bounded snap, reduced-motion alternative |

## Source ownership
Methodology adapted from original archive by Emil Kowalski (MIT). The original source may include examples using libraries not installed in FlyTally and instructions about how an assistant should initially respond; neither governs this project. See docs/skills/THIRD_PARTY_SOURCES.md for attribution and complete license notice. Do not present unverified examples as measured or approved aviation behavior.
