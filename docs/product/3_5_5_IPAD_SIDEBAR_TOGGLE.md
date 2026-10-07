# 3.5.5 — iPad sidebar collapse-control alignment

**Status:** IMPLEMENTED · LOCAL GATE PASS · PRODUCTION VISUAL RECHECK PENDING  
**Owner:** Filip Točík  
**Date:** 7 October 2026  
**Repo:** `flytally-logbook`  
**Branch:** `fix/3.5.5-ipad-sidebar-toggle`  
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
   - move the collapse target rightward into the sidebar rail/gutter;
   - do not overlap the notification bell;
   - vertically center the collapse target on the brand row.
4. Keep fine-pointer desktop placement unchanged.
5. Keep the <=820 px mobile shell unchanged; it continues to use the hamburger control and hides the desktop collapse button.
6. Preserve notification behavior, sidebar navigation, routes and active-state semantics.
7. No DB, flight, certification, recency, sharing or record-persistence semantics change.

## Implementation

`app/ui-system.css` is the final application CSS layer and applies one narrow override:

```css
@media screen and (min-width:821px) and (pointer:coarse){
  .sidebar-toggle{
    right:-44px;
    top:50%;
    transform:translateY(-50%);
  }
}
```

The `-44px` offset accounts for the sidebar brand living inside the padded sidebar: the 44 px coarse target moves out of the brand content area and into the edge/gutter instead of covering the bell.

## Acceptance criteria

- Expanded iPad sidebar: collapse chevron does not overlap the notification bell.
- Chevron is vertically aligned with the brand-row controls.
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

Production iPad visual acceptance remains required after deploy.
