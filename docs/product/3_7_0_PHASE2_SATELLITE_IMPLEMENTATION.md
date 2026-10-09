# FlyTally 3.7.0 — Satellite Phase 2.1 opt-in implementation (unverified)

**Current status:** implementation draft in `feat/3.7.0-satellite-selector-trial`; no tests/build/production deployment performed yet. Branch is based on `main@7d47010e` with Phase 1 complete. Separate documentation PR #271 remains DRAFT and carries provider/account/permission/referrer evidence. This implementation does not supersede its external release gates.

## Frozen trial contract

- Opt-in **build-time** flag: `NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS=true`. **Absent or any other value = OFF**. This is a UI trial gate, not an Esri licence authorization, supplier access control or replacement for a server-side cost/security policy.
- Standard always selected initially; not persisted, automatically prefetched or selected from the last map. Satellite requests occur **only** after pressing Satellite on a specifically enabled authenticated map.
- Targeted authenticated surfaces: Map routes, Map GPS tracks, saved flight GPS player, GPS import review. Public flight replay receives `publicView=true` and **never** gets the control; Story card/PNG retains its existing independent legacy behavior and remains out of scope.
- One live base tile layer in `flytallyBasemap` pane. Satellite must have no standard dark filter; Standard recovers its existing filtered night appearance. Preserve map instance, viewport, GPS scrub/playback, route/airport markers, mobile map movement lock and all flight evidence.
- Single provider request channel reused: `/api/map-tile/{z}/{x}/{y}?style=satellite`. No new client key/URL, vendor request, openAIP or database model. No changes to existing endpoint's global public reachability, Story probe or token/referrer semantics in this draft.
- On `tileerror`, revert to visibly named Standard with a live-region status and disable further Satellite attempts until remount. An HTTP tile failure is not treated as successful Satellite. Leaflet's `load` event clears loading when current requested tile set completes; this is not a supplier-wide coverage guarantee.
- Attribution in trial is **provisional** and reuses the names from the existing Story source; actual imagery/labels/references provider attribution and source-specific credit obligations are **OPEN**. This trial **must not ship enabled** as licensing-approved production behavior based on provisional text.

## Concrete source changes

- `components/map-layer-controller.ts`: extend the existing map-local pane owner to a two-style atomic base swap; preserve Standard reuse and filter isolation; no map object recreation.
- `components/satellite-map-control.ts`: gated accessible selector and explicit loading/unavailable/Standard fallback; detached on unmount; no local storage.
- Four existing map consumers: call the shared control after existing responsive map initialization. Public player calls it only for `!publicView`.
- `app/globals.css`: scoped 44px touch controls, focus states, status and narrow-screen layout.
- `tests/v370-map-layers.test.ts`: characterize the trial flag and protected/public separation without replacing Phase 1 tests.
- `e2e/map-layers.spec.mjs`: enhance the existing registered logical tests with **fixture-only** satellite selection, dark-filter separation, error rollback, no public-share control; preserves original registered test titles and baseline.

## Test plan (NOT RUN until local user verification)

**Prerequisites:** clean repository checkout and dedicated localhost PostgreSQL browser fixture only; never production DB. Evaluate the repository's `verify:plan` risk registry and source/typecheck first.

1. Flag OFF: no new Satellite buttons or requests in the existing Phase 1 browser acceptance; map/Story/public share remain unchanged.
2. Flag ON: build with `NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS=true`; same registered map Playwright titles test selection, one basemap, viewport/pane identity, dark styling, fallback on simulated 502 and public share absence. Tile requests are intercepted with local SVG, **never** call the paid provider.
3. Typecheck, full risk-selected aggregate regression/build/PostgreSQL/browser and current map responsive checks. Include iPad landscape/portrait light/dark plus real Safari if available. Do not reuse an old SHA's PASS.
4. Review remaining gaps against Phase 2.0 provider rights, exact Esri source credits, token expiration, `https://*.vercel.app` referrer mismatch vs `fly-tally.com`, public proxy usage/cost abuse and existing Story export permissions before even considering production flag activation.

**Local verification evidence received 9 October 2026 (previous branch candidate `8983c410`, candidate ID `b5ac7c34722035e44641550b408a5df5a233c2a02ab8fdc00e5ad02c778aad2e`):** `npm.cmd run verify:iterate -- --base origin/main` with satellite UI flag ON returned `iteration_status=FAIL`, `source=FAIL` (232/233; only `tests/development-scope.test.ts` ownership inventory `388 !== 387`), `domain=PASS` (46/46), `typecheck=PASS`; `release_status=NOT EVALUATED`, aggregate/build/PostgreSQL/browser-risk `NOT RUN`. The failure was caused by the newly added `components/satellite-map-control.ts` increasing audited runtime files from 387 to 388 without module ownership metadata. **Fix staged after that run:** classify the file under `gps-tracks` and approved map browser path targets, change only registry `auditedTotal` to 388, add an explicit registry regression assertion. **The corrected feature-branch head has NOT yet been retested; no PASS is claimed.** Build, PostgreSQL, Playwright and provider API smoke also **NOT RUN**. No code in `flytally-training`, DB schema, backups, certified flights or production secrets changed. No merge/deploy authorization established.

## Independent review request

Review the actual code/PR read-only for Leaflet event ordering, failure fallback on a multi-tile viewport, reliance on CSS computed values, control focus/touch and duplicate render, public-view isolation, exact fixture test coverage, and the risk that UI-only gating is mistaken for provider authorization. Inspect the repo before requesting architecture changes. The provider/licence/cost gates remain independently open regardless of the review result.
