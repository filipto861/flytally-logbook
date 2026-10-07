# 3.5.5 — iPad sidebar collapse-control alignment

**Status:** IMPLEMENTED · LOCAL GATE PASS · PRODUCTION VISUAL RECHECK PENDING  
**Owner:** Filip Točík  
**Date:** 7 October 2026  
**Repo:** `flytally-logbook`  
**Branch:** `fix/3.5.5-ipad-sidebar-handle`  
**Production baseline:** `3.5.4`

## Trigger

Production iPad review after 3.5.4 showed the persistent desktop-style sidebar correctly remains available at the iPad landscape breakpoint, but its collapse chevron is poorly placed.

The cause is presentation-only:
- `.sidebar-toggle` is absolutely positioned relative to the padded `.sidebar-brand`;
- the accessibility coarse-pointer rule increases its minimum inline/vertical target to 44 px;
- the historical `right:-27px; top:9px` placement was designed around the smaller mouse target;
- on iPad, the enlarged target therefore intrudes into the notification bell and sits vertically lower than the adjacent brand controls.

## Frozen contract

1. Preserve the existing sidebar expand/collapse action and `logbook-sidebar` persisted state.
2. Preserve the coarse-pointer minimum 44 px touch target.
3. On coarse-pointer layouts wider than the phone/mobile breakpoint:
   - render the collapse control as a dedicated sidebar-edge handle, visually separate from the brand/header controls;
   - center it vertically in the viewport so it does not compete with the notification bell or logo;
   - keep the handle centered on the current expanded/collapsed sidebar edge.
4. Keep fine-pointer desktop placement unchanged.
5. Keep the <=820 px mobile shell unchanged; it continues to use the hamburger control and hides the desktop collapse button.
6. Preserve notification behavior, sidebar navigation, routes and active-state semantics.
7. No DB, flight, certification, recency, sharing or record-persistence semantics change.

## Implementation

The first production placement kept the control near the brand row. Production iPad review showed that this still read as a misplaced header control, particularly in collapsed mode.

The corrective 3.5.5 implementation keeps the same control and behavior but changes only its coarse-pointer presentation:

```css
@media screen and (min-width:821px) and (pointer:coarse){
  .sidebar{--coarse-sidebar-width:238px}
  .sidebar.collapsed{--coarse-sidebar-width:74px}
  .sidebar-toggle{
    position:fixed;
    left:calc(var(--coarse-sidebar-width) - 22px);
    right:auto;
    top:50dvh;
    width:44px;
    height:44px;
    transform:translateY(-50%);
    border:1px solid var(--line);
    border-radius:999px;
    background:var(--panel);
  }
}
```

This makes the chevron a true edge handle: half inside and half outside the current sidebar edge, independent from the logo/bell layout.

## Acceptance criteria

- Expanded iPad sidebar: collapse chevron does not overlap or visually group with the notification bell.
- Collapsed iPad sidebar: expand chevron remains attached to the rail rather than floating among the top controls.
- Chevron is vertically centered as a persistent sidebar-edge handle.
- Collapse and expand both remain usable.
- Collapsed iPad sidebar still exposes the expand control.
- Phone/mobile layout continues to use the hamburger and does not expose the desktop chevron.
- Fine-pointer desktop behavior is unchanged.
- No horizontal page overflow is introduced.

## Verification

Final exact-head local gate on `a98d6071b380de56325d1230887dd0385f419f05`:
- targeted 3.5.5 / v3.0 accessibility / roadmap / versioning tests: **17/17 PASS**;
- TypeScript: **PASS**;
- full unit/regression suite: **1308/1308 PASS**;
- production build: **PASS**, including 41/41 static pages;
- PostgreSQL migration: **N/A**.

The only local warning is the existing Next.js notice about a parent `C:\Users\Filip Točík\package-lock.json` outside the repository; it does not affect the repository build.

The first production visual attempt was rejected because the control still looked misplaced in both expanded and collapsed states. The edge-handle correction above supersedes that placement. Production iPad visual acceptance remains required after the corrective deploy.
