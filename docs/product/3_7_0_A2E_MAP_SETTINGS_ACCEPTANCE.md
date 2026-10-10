# FlyTally 3.7.0 — A2E unified Map settings UX

**Owner decision:** replace two independent on-map Leaflet bars (`Standard / Satellite` and `Aviation`) with one compact **Map settings** button in the same top-right map corner. This is a client presentation task only; preserve all A2D source, server, flag and flight-evidence boundaries.

**Status (10 October 2026):** implemented on `feat/3.7.0-a2e-unified-map-settings`; verification **NOT RUN** pending owner-local execution. Not merged, not deployed. `main` production Aviation ON remains the existing baseline, not part of this branch.

## UI contract and acceptance criteria

1. One 44px-minimum control labeled **Map settings** with stacked-layers icon. Initially closed; `aria-expanded=false`, stable `aria-controls` and a named panel region. The menu has a `Map settings` title, `Base map` subsection with **Standard / Satellite** mutually exclusive pressed buttons, and `Overlays` subsection with independent **Aviation** pressed button. A succinct visible warning disclaims coverage/currentness and describes Aviation as reference-only. All output text stays English to match current app.
2. **Standard** remains the default on every map mount, no auto-restore or persistence, no map recreation/viewport changes. Changing Standard/Satellite does not toggle Aviation. Toggling Aviation does not change basemap, GPS records or styles. Existing attribution only follows mounted layers.
3. Existing error guards are unchanged: Satellite error returns to Standard and disables repeat requests until remount; Aviation fails closed, detaches on tile error, disables repeat until remount; Aviation hides when zoom > 14, does not auto-return. Server still checks canonical XYZ/session/exact-true provider gates/secret and bounded PNG, without secret in client.
4. Panel remains usable on desktop, touch mobile and iPad landscape/portrait, light/dark and system themes; press Escape to close and return keyboard focus to trigger; click/tap outside closes, trigger toggles. Panel interaction must not pan/zoom the map or swallow interactive flight route clicks when the menu is closed. `role=status` retains existing loading/error announcements; disabled states visible. Reduced motion supported.
5. The same per-map mount/cleanup contract applies to **route overview**, **GPS tracks**, **private saved flight playback** and **GPS import review**. Public/shared replay and Instagram Story stay without the menu; even with both client flags true, only the four authenticated views are enabled.
6. Flag semantics do not change: Satellite OFF means no Satellite service/button; Aviation OFF means no Aviation service/button; both OFF = no Map settings control. Server guards and no-retry behavior remain authoritative. No new Vercel variables, migrations, licences, approved-EFB claims, feature persistence or Training change.

## Test plan and evidence boundary

- Source contracts: `tests/v370-map-layers.test.ts` and `tests/v370-airspaces-map-ui.test.ts`; new composition/lifecycle/keyboard/CSS contract checks in existing module-owned test.
- Browser: `e2e/map-layers.spec.mjs` in isolated authenticated browser fixtures. Verify menu closed by default, explicit open, Escape focus return, outside-click close; retain Standard/Satellite selection and error fallback, Aviation simulated PNG, off+attribution, provider-503 fail closed, theme/pane/route click continuity and public-share exclusion. Exercise desktop and mobile Chromium independently.
- Owner-local stage: `npm.cmd run verify:plan -- --base origin/main`, `npm.cmd run verify:iterate -- --base origin/main --rerun`, then two full `npm.cmd run verify:release:risk -- --base origin/main --rerun` gates (Aviation client ON and OFF, Satellite ON in both), each with fresh build and separate brand-new verified-empty disposable localhost PostgreSQL browser fixture. Do not reuse earlier candidate evidence. Check candidate ID and no retries/skips.
- Real responsive acceptance (owner): screenshots or interactive check on desktop dark/light and physical iPad landscape/portrait, including Standard/Satellite change, Aviation ON/OFF, map pan/zoom, overlay/readability. The selected openAIP raster remains **reference only**; currentness/airspace activation are not guaranteed. CI and real iPad not proven by local Chromium.
- **Current evidence:** implementation diff and authored tests only. TypeScript **NOT RUN**, Node **NOT RUN**, Build **NOT RUN**, Playwright **NOT RUN**, DB integration/scale **N/A until planner**, Deployment **NOT RUN**, Production untouched. Keep PR Draft until local evidence and review, then explicit owner merge decision.

## DO NOT

Do not turn off the already deployed Aviation feature while implementing UI; do not adjust production Vercel secrets or feature flags, do not alter basemap data/token proxy or global Leaflet panes, no unsourced map validity assertions and no automatic overlay enablement.
