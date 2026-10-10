# FlyTally 3.7.0 — A2F high-zoom Aviation and compact Map settings

## Defect and source analysis

The owner reported that aviation overlays disappear when zooming in and asked to eliminate redundant Map settings explanations. On `main`, `components/airspace-map-control.ts` capped the Leaflet layer to z14, rejected initial selection at z>14, and on `zoomend` deselected/detached Aviation above z14. This was an application-side protection, not evidence that the provider cannot supply higher detail. The independent authenticated route still rejects z>14, a conservative FlyTally upstream request limit.

## Frozen design and contracts

1. **Compact map controls:** Show only **Standard**, **Satellite** and **Aviation overlay** inside the popover. Remove its repeated heading, Base map / Overlays headers, and duplicate reference note. Keep trigger `Map settings`, accessible named region/groups/pressed states and 44px touch targets, Escape/outside pointer dismissal and focus return. Keep meaningful `Loading aviation reference…` and `Aviation unavailable…` status when appropriate. Real source attribution with `Coverage/status unverified` remains visible on the map while Aviation is active.
2. **High zoom:** Keep the explicitly activated Aviation layer selected across zoom/pan up to existing basemap z18. Use `L.tileLayer` with `maxNativeZoom:14, maxZoom:18`, using enlarged z14 tiles for display at z15–18. Preserve Standard/Satellite choice and the route/pointer-events pane. Do not infer provider capability or high-resolution content from upscaling. Show Aviation when first selected at z15–18.
3. **Safety/API:** Do NOT change server `MAX_REQUEST_ZOOM=14` or the pinned upstream provider path, headers, auth/session, secret, exact-true gates, PNG, timeout, rate-limit and fail-closed rules. Any genuine `tileerror` still deselects/disables and detaches until remount; attribution goes away when layer is detached. No extra z15+ provider requests.
4. **Scope:** Four authenticated Leaflet maps; public Story/replay unaffected. No persistence, initial auto-enable, aircraft data, DB/migration, Training, Vercel environment or user preferences change.

## Verification and acceptance (CURRENTLY NOT RUN)

- Source: `tests/v370-airspaces-map-ui.test.ts` confirms client `maxNativeZoom=14`, display max=18, no `zoomend` auto-deselection, independent server cap and unchanged failure policies; `tests/v370-map-layers.test.ts` guards lean panel plus ARIA/lifecycle.
- Browser: `e2e/map-layers.spec.mjs` uses synthetic PNG and existing authenticated fixture, turns Aviation ON, zooms to map max (18), verifies selected state, tiles and attribution stay, checks every requested aviation tile XYZ z<=14, switches OFF/ON again at high zoom and asserts correct behavior. Existing satellite swaps and provider-503 fail closed still covered.
- Owner-local exact commit: `test:target`, `verify:plan`, `verify:iterate`, then `verify:release:risk -- --base origin/main --rerun` with client Aviation ON and OFF on independent fresh builds and fresh verified-empty dedicated localhost PostgreSQL18 databases, Satellite ON both, server provider/key unset in mocks. Evaluate full Node, TypeScript, build, postgres and Chromium desktop/mobile per planner; record candidate, no skips/retries. **Do not reuse PR #295 evidence** for this new source/test commit.
- Only after PASS, obtain owner approval before merge/deploy. After deployment, request real signed-in high-zoom screenshot and iPad/Safari portrait and landscape check; confirm map attribution/readability; no claim that openAIP is an operational chart.

**Status 10 October 2026:** implementation/test/docs commit on `fix/3.7.0-a2f-aviation-high-zoom-map-menu`, tests **NOT RUN**, PR not merged, production unchanged. Existing A2E (#295) is already MERGED/READY; documentation PRs #294 and #296 are Draft and need reconciliation before merge.
