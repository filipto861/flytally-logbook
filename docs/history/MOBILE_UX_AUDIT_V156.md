# FlyTally v1.56.0 — Mobile Layout Audit & Responsive Hardening

## Goal

Audit every primary navigation destination for the same class of responsive defects reported on iPhone in **Add flight**: native controls or child layouts extending outside their card/grid, desktop minimum widths leaking into mobile, or intentionally wide content widening the whole page instead of scrolling inside its own container.

This release is layout-only. It does **not** change flight semantics, FCL.050/FCL.060 logic, recency, aircraft identity, certification, revision hashes, signatures, shared-flight ownership, billing, GPS evidence, print/export semantics or backup/restore behavior.

## Root cause found

The v1.55 Flight essentials grid already uses `minmax(0,1fr)`, `min-width:0` and equal-width controls. The iPhone screenshot nevertheless showed `date` and `time` controls extending beyond the right edge of the card.

The remaining problem is WebKit native-control intrinsic sizing. Safari can retain an intrinsic inline size for date/time controls even when their CSS width is `100%`. FlyTally already had a proven local workaround in the GPS-review form (`appearance:none` plus logical inline sizing); v1.56 promotes that behavior into a final application-wide responsive layer and adds reusable shrink/containment rules.

The fix deliberately does **not** hide horizontal overflow on `body`. Wide tables and tab bars retain explicit internal scrolling where that is the correct interaction.

## Primary navigation audit

| Menu destination | Source/layout review | v1.56 result |
| --- | --- | --- |
| **Dashboard** | 12-column widget grid already uses `minmax(0,1fr)` and mobile widgets span the full grid. Period selector intentionally scrolls horizontally. | No page-specific rewrite. Added final card/grid containment so long widget content cannot widen the page. |
| **Flights** | Mobile flight rows already become responsive cards and the table wrapper is removed intentionally at the mobile breakpoint. Advanced filters contain native `From`/`To` date fields. | Native date controls now use the common WebKit sizing fix. Filter/card children inherit shrink containment; active-filter chips continue intentional internal horizontal scrolling. |
| **FSTD sessions** | New/edit session forms contain native date controls; record table is intentionally wrapped in `.table-scroll`. | Date controls are fixed globally. Forms can shrink to their container; the record table keeps internal horizontal scrolling rather than widening the page. |
| **Add flight** | v1.55 correctly pairs desktop fields and collapses them to one column. iOS native Date/Off-block/On-block/Takeoff/Landing controls were the reproduced overflow defect. | Date/time controls get `appearance:none`, `inline-size:100%`, `min-inline-size:0` and `max-inline-size:100%` on mobile/coarse pointers. All essentials stay inside the card. |
| **Map** | Map filters use responsive grid rules; maps are already contained by `.map-panel`; GPS track table uses `.table-scroll`; mode/scope controls are intentional horizontal scrollers. | Added final containment to map/filter children without clipping or shrinking the actual map/table data. |
| **Notifications** | Notification cards already switch to vertical layout on narrow screens. Long notification text and action groups are the principal intrinsic-width risk. | Text/card children may shrink and wrap; actions remain inside the card. |
| **Connections** | Connection lists and editor forms already have mobile collapse rules. Pilot identity strings, relationship controls and action groups can contain long account data. | Added shrink/wrap containment while preserving checkbox sizing and existing stacked mobile actions. |
| **Licences** | Licence tabs intentionally scroll horizontally. Licence/rating/document editors contain several native validity/recency date fields. | Tabs remain an internal scroller. All native date fields now use the common WebKit fix; credential editor/grid children are constrained to the card. |
| **Settings** | Settings navigation intentionally scrolls horizontally; profile/security grids already stack on mobile. Form controls and long device/user-agent strings are the remaining overflow risks. | Common form containment applies; long session/device content may wrap; the existing mobile sticky-save behavior is preserved. |
| **Aircraft & airports** | Aircraft forms use responsive `minmax(0,1fr)` grids; custom-airport editor and catalogue tables have mobile/scroll handling. Numeric coordinate inputs and aircraft picker fields share generic control primitives. | Common control/card containment applies. Tables keep internal scrolling; no catalogue or aircraft-data behavior is changed. |
| **Print & data** | Hub tabs intentionally scroll horizontally. Print/export forms contain native `From`/`To` date controls; backup/restore are card/forms. | Date controls use the common fix; hub tabs remain an intentional scroller; export/restore form children cannot widen the workspace. |
| **Administration** | Admin tables are already inside `.table-scroll`; account/invite editors use shared form primitives. | Shared containment protects editors and long account values; tables remain horizontally scrollable where required. |

## Navigation shell

The mobile sidebar already closes on route change, locks body scrolling while open, and uses an overlay/backdrop. v1.56 does not alter navigation behavior. The audit adds no global `overflow-x:hidden` workaround, so a future genuine overflow regression remains observable instead of being silently clipped.

## Shared responsive contract added in v1.56

1. Main content, panels, common grids, cards and editor containers may shrink to `min-inline-size:0` and may not exceed their parent inline size.
2. Normal text/select/textarea controls may not exceed their form/grid container. Checkbox, radio, range, file and hidden inputs are explicitly excluded from full-control sizing rules.
3. On mobile/coarse-pointer devices, native date/time/datetime-local/month controls use the WebKit-safe logical sizing contract already proven in GPS review.
4. Horizontal navigation strips and table wrappers are capped to the viewport/content width and keep internal scrolling.
5. Long pilot/account/status strings wrap instead of establishing a wider intrinsic card width.

## Release gates

Before production merge:

- v1.56 responsive regression contract passes;
- complete TypeScript regression suite passes;
- PostgreSQL acceptance passes;
- Next.js production build passes;
- clean Vercel preview is READY after any temporary validation tooling is removed;
- production deployment is checked for runtime errors.
