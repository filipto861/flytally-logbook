# FlyTally Logbook — M2A independent source audit of Satellite R1/R2 drafts

**Date:** 10 October 2026  
**Audit type:** read-only GitHub source/PR/branch comparison + read-only official Esri documentation.  
**Canonical baseline:** `main@a6bed4c687306c887deb85270d601d3323c188d3` (docs PR #302).  
**Product version:** `3.6.0`; partial 3.7.0 map features already merged/deployed; **full 3.7.0 release remains OPEN**.  
**In scope:** PRs #273, #278, #279 and #281; logbook only. Training, database, release, code and provider credentials untouched.  
**Evidence boundary:** Current source files, immutable PR head refs, PR-scoped patches and GitHub three-dot `main...head` compare metadata were retrieved directly. No local checkout, dynamic tests, real-provider HTTP, credentials, physical iPad, deployment or new code was executed. Previous test results reported in PR descriptions are **historical owner-local reports**, not independently rerun.

## 1. Exact comparison anchors

| PR | Head SHA | `main...head` compare | Distinct PR purpose |
| --- | --- | --- | --- |
| [#273](https://github.com/filipto861/flytally-logbook/pull/273) | `a29d4e4f0fe091e449d4df10fd0bdd39d289767a` | diverged: **51 ahead / 19 behind**, 18 files relative to main | R2 Story PNG tile/export fail-closed |
| [#278](https://github.com/filipto861/flytally-logbook/pull/278) | `8d8e45b83e9a6fea8806e49d2af3f4468f9f5087` | diverged: **136 ahead / 19 behind**, 23 files | R2D.1 Satellite server-only upstream disable |
| [#279](https://github.com/filipto861/flytally-logbook/pull/279) | `096b86d8800ac763f2d74bbcba5cb54f978b0984` | diverged: **509 ahead / 19 behind**, 70 files | R2D.2 isolated bounded transport, raster, admission, lifecycle and research |
| [#281](https://github.com/filipto861/flytally-logbook/pull/281) | `25fe505dedaaa521b20b5f3579cf9dcb4dc66451` | diverged: **12 ahead / 18 behind**, 4 files | S1 Esri tile geometry and provider-architecture review |

**Important:** PR #273/#278/#279 are stacked on older R1/R2 bases, so the three-dot compare reflects shared historic ancestry, not a ready-to-merge isolated patch. Inspect the **PR-base patch** to understand its scoped change and current `main` separately. A GitHub compare `ahead` count is not a uniqueness or deployment claim. #281 itself is documentation-only.

## 2. PR #273 — Story PNG fail-closed: **UNIQUE CURRENT GAP; RECOMMEND SMALL PORT**

**Current `main` evidence:** [`components/flight-story-card.tsx`](../../components/flight-story-card.tsx) defines `embedMapTiles` which fetches each `image[data-map-tile]`; on failed fetch it executes `catch { image.remove() }` and still serializes the remaining SVG. A missing tile URL returns without failure; the function does not compare returned `X-FlyTally-Map-Style` to the requested style or require an image MIME. Its `save` path has `try/finally` but no user-facing export error state or catch. Failure can therefore yield **apparently completed partial imagery** or a rejected export with unclear feedback. This is a **source-established failure mode**, not a claimed live production incident.

**PR #273 head evidence:** [Historical source at exact SHA](https://github.com/filipto861/flytally-logbook/blob/a29d4e4f0fe091e449d4df10fd0bdd39d289767a/components/flight-story-card.tsx) rejects missing URL, !HTTP OK, wrong/missing style header or non-image MIME and aborts the entire PNG instead of removing tiles. The PR adds explicit export error feedback, `busy` guard / disabled style controls, URL cleanup and source/Chromium mock assertions. The image check is **MIME-based only**, not proof of authentic decodable PNG/JPEG bytes; real browser decode and supplier/export rights remain separate.

**Classification:** Independent useful unmerged runtime fix. **Do not merge #273** or its parent #272 into current main. Propose `fix/3.7.0-story-export-fail-closed` based on current main, with smallest Story-only patch and source/browser tests. Preserve the current public/private Map API, Story UI intents, attribution and no new provider rights. Confirm failure is visible and no damaged PNG is saved; Standard success, Satellite success/expired login/503/502, network failure, wrong style, wrong MIME, and missing tile all need acceptance. The caller's user-facing choice to retry should remain explicit; no hidden fallback that misrepresents imagery.

**Prior PR evidence:** #273 describes earlier exact-SHA local ON/OFF tests including 1,451/1,451 Node, PostgreSQL 100/100 and Chromium desktop/mobile 11/11. **Not rerun** for current main or any forward port.

## 3. PR #278 — Satellite kill switch: **UNIQUE OPERATIONAL CONTROL; REVIEW THEN MINIMAL PORT**

**Current `main` evidence:** [`app/api/map-tile/[z]/[x]/[y]/route.ts`](../../app/api/map-tile/%5Bz%5D/%5Bx%5D/%5By%5D/route.ts) validates tile coordinates and strict `style` first. For Satellite it then checks live `getSession()` before reading `ARCGIS_ACCESS_TOKEN`, returns 401 private/no-store to anonymous callers, and returns 503/no-store when required token missing. It calls `satelliteTile` and returns successful Satellite SVG private/no-store. Public Standard remains independent. **No** `FLYTALLY_SATELLITE_UPSTREAM_DISABLED` condition exists in current main.

**PR #278 head evidence:** [Old API route](https://github.com/filipto861/flytally-logbook/blob/8d8e45b83e9a6fea8806e49d2af3f4468f9f5087/app/api/map-tile/%5Bz%5D/%5Bx%5D/%5By%5D/route.ts) adds exact-true server-only `FLYTALLY_SATELLITE_UPSTREAM_DISABLED === "true"` **after** session and missing-token checks, **before** Satellite provider/Data Cache. It returns 503, `no-store`, unavailable style, not an image. It leaves Standard outside the conditional. The older branch also includes a separate provider-helper refactor, HTTP fixture and tests inherited from #275/#276; those are **not** necessary for a minimum kill-switch port.

**Classification:** Independent potentially valuable operational safeguard with low conceptual blast radius **if** ported surgically; not proof that the old whole branch is safe. Recommend short owner/operations decision and tiny current-main implementation/test proposal. Preserve ordering: malformed 400 → anonymous 401 → missing token 503 → explicit server disable 503 → permitted provider; Standard always unchanged, no cache bypass, no token leak. Document Vercel env deployment semantics: changing server env on an already-built instance is **not guaranteed** to be an instant global kill; need explicit rollout/rollback and verification. Consider whether an existing Vercel/server kill mechanism truly meets the same control before introducing another one.

**Prior PR evidence:** #278 reports local ON/OFF/HTTP regression verification on earlier `895d8ca...`, not on its docs-only final head and not on current main. No current release claim.

## 4. PR #279 — bounded provider transport/admission: **VALUABLE ISOLATED RESEARCH; INTEGRATION BLOCKED**

**Current main provider source:** Same map API [route](../../app/api/map-tile/%5Bz%5D/%5Bx%5D/%5By%5D/route.ts) embeds Esri base imagery + preferred labels (or fallback) into an SVG. `satelliteTile` uses concurrent `fetch` with `next: { revalidate: 7 days }`, and `imageDataUrl` loads `response.arrayBuffer()` without a source-backed payload ceiling; MIME check is `image/*` prefix. No explicit abort/deadline/request.signal binding, admission policy or decoded memory budget was seen in this route. That is a **resource-control design gap**, not an independently established incident.

**PR #279 code evidence (exact SHA):**

- [`lib/satellite-bounded-fetch.ts`](https://github.com/filipto861/flytally-logbook/blob/096b86d8800ac763f2d74bbcba5cb54f978b0984/lib/satellite-bounded-fetch.ts): injectable transport with mandatory caller `maxBytes` and `timeoutMs`, explicit transport failures and encoded-body bound. Not used by production provider.
- [`lib/satellite-raster-validation.ts`](https://github.com/filipto861/flytally-logbook/blob/096b86d8800ac763f2d74bbcba5cb54f978b0984/lib/satellite-raster-validation.ts): PNG/JPEG structural checks only; expressly **not** proof of full decoded image validity.
- [`lib/satellite-svg-envelope.ts`](https://github.com/filipto861/flytally-logbook/blob/096b86d8800ac763f2d74bbcba5cb54f978b0984/lib/satellite-svg-envelope.ts): bounds compressed byte count/pixel counts/projected RGBA/SVG bytes; no proven process RSS or decoder safety.
- [`lib/satellite-admission-gate.ts`](https://github.com/filipto861/flytally-logbook/blob/096b86d8800ac763f2d74bbcba5cb54f978b0984/lib/satellite-admission-gate.ts): process-local capacity ledger with irreversible `quarantine()` for uncertain upstream settlement; **not** deployment-wide, global concurrency or memory safety.
- [`lib/satellite-tile-transport.ts`](https://github.com/filipto861/flytally-logbook/blob/096b86d8800ac763f2d74bbcba5cb54f978b0984/lib/satellite-tile-transport.ts) and associated helpers: one-deadline base+preferred-label+fallback coordination. Still **not** live-provider-wired.
- [`lib/satellite-provider-tiling.ts`](https://github.com/filipto861/flytally-logbook/blob/096b86d8800ac763f2d74bbcba5cb54f978b0984/lib/satellite-provider-tiling.ts): offline provider tileInfo compatibility checks. Outputs a **candidate** result, not a provider-proven footprint.
- The #279 `app/api/map-tile` imports the old `lib/satellite-map-provider.ts`; it **does not import** the bounded-fetch/raster/admission/transport modules. The same historical route contains `export const dynamic = "force-dynamic"`, unlike current main's deliberate avoidance of that directive on the shared Standard route. **Do not blindly port this regression-prone stack.**
- Tests and detailed source/acceptance decisions exist in #279 and `docs/product/3_7_0_SATELLITE_R2D2_BOUNDED_IO_DESIGN.md` on that branch; these documents describe missing production budgets, valid-raster fixtures and real-provider/platform evidence.

**Classification:** Useful research and isolated tests, **blocked for runtime integration**. The owner-local 69/69 targeted + typecheck reported for exact prior code SHA `7baefdf7...` is not end-to-end/provider/Next production evidence and not a test of #279's later docs-only head. Recommend independent security/resource architecture design first, with source-backed or explicitly observed byte/time/decoded memory limits and supplier rights before any integration. No invented defaults; missing policy must return unavailable, not silently run unbounded. Plan small modules/PRs, not a historical 509-commit merge.

## 5. PR #281 — tile-grid and geometry evidence: **RETAIN RESEARCH, NOT DEPLOYABLE SPEC**

[PR #281's S1 decision document](https://github.com/filipto861/flytally-logbook/blob/25fe505dedaaa521b20b5f3579cf9dcb4dc66451/docs/product/3_7_0_S1_SATELLITE_ARCHITECTURE_DECISION.md) correctly **withdraws** the earlier assumption that 512px static labels automatically require zoom `z±1` relative to 256px imagery. Official [Esri Static Imagery Labels tile API](https://developers.arcgis.com/rest/static-basemap-tiles/arcgis-imagery-labels-tile-get/) documents 512×512 output, static-level resolution (e.g. L12 `19.1092570712683 m/px`) and the one-level **pixel-scale comparison** to traditional 256px tiles. Geographic tile span at L12 is approximately `512×19.109257 = 9783.94 m`. A traditional 256px L12 with `38.218514 m/px` would have approximately the same span, **if** CRS, origin, tile grid and row/column addressing also match. The comparison 256px number is a published example, **not verified World Imagery endpoint metadata**.

**Source evidence still missing:** exact `tileInfo` and CRS/origin/LOD of deployed World Imagery, static labels and fallback, valid key privileges, geographic precision, alignment of z/x/y, current service/attribution rights, authorized cache/SVG composition and Story PNG distribution. An official [Esri multiple-raster-layer example](https://developers.arcgis.com/maplibre-gl-js/maps/raster-tile-basemaps/display-multiple-basemap-layers/) shows an alternative rendering approach but does **not** establish that FlyTally must replace its Next.js/Leaflet composition.

**Historical caveat:** #281 was written before the security hotfix #282 and Satellite selector #285; it says Satellite route public and production OFF. Those status statements are **superseded** and must not be copied back into ROADMAP. Current main checks the Satellite session and successful response privacy. The geometry uncertainty survives and remains a genuine issue.

**Classification:** Valid source-interpretation correction and useful provenance; preserve as dated design/review evidence. Architecture A (fixed-grid SVG) vs B (independent imagery/labels layers) remains **DEFER / no GO** until actual service-specific evidence. No automatic z transformation, no vendor-billable probes or credential changes initiated by this audit.

## 6. Decision matrix

| PR | Verified current-main difference | Recommended action | Can close/delete now? |
| --- | --- | --- | --- |
| #273 | Story removes failed tile and can export partial imagery; fail-closed improvements missing | **HIGH:** new small Story-only fix and targeted browser tests based on current main | **NO** — after port and evidence |
| #278 | No standalone server-only Satellite upstream disable | **HIGH:** owner operational decision, then minimal fail-closed current-main change and HTTP tests | **NO** — separate rollout decision |
| #279 | Transport/admission/raster modules not imported by live provider, explicit limits missing | **RESEARCH HOLD:** independent provider/resource security design and measured limits before any port | **NO** |
| #281 | Geometry review only; static 512px does not alone prove one-level geographic shift | **KEEP EVIDENCE:** provider-specific tileInfo, rights/attribution/Story decision | **NO** |

## 7. Safe follow-up milestones

1. **S1 — Story integrity:** characterize current partial-export failure with deterministic tiles, implement minimal fail-closed Story save/embed path on a new `fix/` branch, verify malformed/error/missing tiles, Standard/Satellite happy paths, error UX and URL cleanup, source/domain/Playwright tests. No PR #273 bulk merge.
2. **S2 — Satellite kill switch:** design against current `app/api/map-tile`, owner approves operational semantics (including deploy-bound flag), implement exact-true server-only block, verify 400/401/503 + Standard 200 + provider-no-call/cache ordering; preserve Story fallback. No PR #278 bulk merge.
3. **S3 — Provider/resource research:** isolate #279 reusable primitives only after actual Esri format/size/usage/rights, safe byte/deadline/decode/policy and application deployment findings. Plan and review before integrating.
4. **S4 — Geometry + release readiness:** use #281 to guide non-billable source review and only separately approved bounded live checks; no guessed zoom remapping. Finish 3.7.0 live provider/iPad acceptance per ROADMAP.
5. **M2B/M3 cleanup:** inspect #271/#272/#274/#277 exact patches and PR references, then propose explicit closure/deletion batches for owner authorization. Do not delete open-PR source branches.

## 8. Verification / DoD ledger for *this audit*

| Gate | Status | Evidence |
| --- | --- | --- |
| GitHub `main` SHA + PR heads and states | **PASS (read-only)** | GitHub metadata and 3-dot comparison returned |
| Source file comparison (#273/#278/#279/#281) | **PASS (read-only)** | GitHub current/PR head sources + patches and official Esri docs |
| GitHub source diff applicability to **new** main | **NOT RUN** | No cherry-pick/rebase or test candidates built |
| Node / typecheck / Next build / PostgreSQL / Playwright / CI | **NOT RUN** | No checked-out local runtime used |
| Vercel deployment, feature flags, live Esri, DB, iPad Safari | **NOT RUN in this audit** | Existing historical deployment evidence remains separate |
| Merge / PR closure / branch deletion / credentials or config change | **NOT PERFORMED** | Read-only source audit only |

**Proposed reviewer challenge:** independently confirm #273 failure coverage/MIME limitation, #278 auth/disable/cache ordering and deploy-bound behavior, #279 cancellation vs settled upstream, admission fairness/denial, true image decode and multi-instance limitations, #281 provider-specific geometry/terms. Verify exact files and code before approving either code port. Second-AI review is a challenge, not automatic authority.
