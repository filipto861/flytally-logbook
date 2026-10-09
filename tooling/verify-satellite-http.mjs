// Manually invoked, production-route HTTP integration using a local-only
// disposable browser database and an instrumented isolated Next child process.
// NEVER called as part of the ordinary application runtime/build.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, request as playwrightRequest } from "@playwright/test";
import { loginBrowserPilot } from "../e2e/browser-actions.mjs";
import { runBrowserSql } from "../e2e/browser-db.mjs";
import { probePostgresConnection } from "./postgres-cli.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3107;
// Production issues Secure cookies. Chromium permits these over the special
// localhost host, but not the explicit 127.0.0.1 origin on some clients.
// This is a local HTTP harness concession, NOT an HTTPS transport test.
const ORIGIN = `http://localhost:${PORT}`;
const TOKEN = "FlyTally-R2C-fixture-token-" + randomBytes(12).toString("hex");
// Three isolated child-process configurations; no real supplier requests.
const MODE = process.env.FLYTALLY_SATELLITE_HTTP_MODE || "enabled";
assert.ok(["enabled", "disabled", "missing-token"].includes(MODE), "Unsupported Satellite HTTP fixture mode");
// The fallback imagery URL has no token, so Next's seven-day upstream Data Cache
// can survive separate fixture invocations. Use fresh *valid* map coordinates
// for each test series, shared across its enabled/disabled/no-token child runs.
// The caller may set one random 32-hex RUN_ID for the whole three-mode series.
const RUN_ID = process.env.FLYTALLY_SATELLITE_HTTP_RUN_ID || randomBytes(16).toString("hex");
assert.match(RUN_ID, /^[a-f0-9]{32}$/, "Fixture run ID must be 32 lowercase hex characters");
const runHash = createHash("sha256").update(RUN_ID).digest();
const TILE_Z = 18;
const TILE_X0 = 1024 + runHash.readUInt32BE(0) % (2 ** TILE_Z - 1030);
const TILE_Y = 1024 + runHash.readUInt32BE(4) % (2 ** TILE_Z - 1030);
const tilePath = scenario => `/api/map-tile/${TILE_Z}/${TILE_X0 + scenario - 1}/${TILE_Y}`;
const SHA = /^([0-9a-f]{40})$/;
function command(exe, args, label, env = process.env) {
  const result = spawnSync(exe, args, { cwd: ROOT, env, encoding: "utf8", timeout: 90_000 });
  if (result.error || result.status !== 0) {
    throw new Error(`${label}: ${result.error?.message || result.stderr?.slice(-800) || result.stdout?.slice(-800) || "failed"}`);
  }
  return (result.stdout || "").trim();
}
function preflight() {
  assert.equal(process.env.FLYTALLY_LOCAL_POSTGRES, "1", "FLYTALLY_LOCAL_POSTGRES must be 1");
  assert.equal(process.env.FLYTALLY_AUTH_BROWSER, "1", "FLYTALLY_AUTH_BROWSER must be 1");
  assert.equal(process.env.SESSION_SECRET?.length, 64, "Local session secret must have the established 64 characters");
  const url = new URL(process.env.DATABASE_URL || "");
  assert.equal(url.hostname, "127.0.0.1", "Required localhost database host");
  assert.equal(url.port, "55432", "Required dedicated database port");
  assert.equal(url.pathname, "/flytally_satellite_r1_test", "Required dedicated database name");
  assert.equal(decodeURIComponent(url.username), "flytally_sat_r1", "Required dedicated DB user");
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol), "Database must use explicit PostgreSQL URL");
  assert.equal(command("git", ["branch", "--show-current"], "git branch"),
    "feat/3.7.0-satellite-r2d-upstream-disable", "Expected R2D.1 test branch");
  assert.equal(command("git", ["status", "--porcelain"], "git clean"), "", "Clean tree required");
  assert.match(command("git", ["rev-parse", "HEAD"], "git SHA"), SHA);

  const identity = probePostgresConnection(process.env.DATABASE_URL, {
    env: process.env,
    label: "R2C isolated HTTP acceptance",
    failureSuffix: "No database fixture changed.",
  });
  assert.ok(identity, "Local Postgres probe did not return an effective environment");
  const dbLabel = command(String(process.env.FLYTALLY_PSQL || "psql"), [
    "-X", "-w", "-d", process.env.DATABASE_URL, "-t", "-A", "-v", "ON_ERROR_STOP=1",
    "-c", "SELECT current_database(), current_user, inet_server_port();",
  ], "Strict test DB identity", identity);
  assert.equal(dbLabel, "flytally_satellite_r1_test|flytally_sat_r1|55432",
    "Database identity must match the isolated destructive-test fixture");
  const require = createRequire(import.meta.url);
  const nextBin = require.resolve("next/dist/bin/next");
  assert.ok(existsSync(path.join(ROOT, ".next", "BUILD_ID")),
    "A production build is required; run verify:release:risk --rerun first");
  return { nextBin, dbEnv: identity };
}
async function portAvailable() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, "localhost", resolve);
  });
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
function upstreamEvents(logFile) {
  if (!existsSync(logFile)) return [];
  return readFileSync(logFile, "utf8").trim().split("\n").filter(Boolean).map(x => JSON.parse(x));
}
async function waitForServer(child) {
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      const response = await fetch(`${ORIGIN}/login`, { signal: AbortSignal.timeout(1500) });
      if (response.status === 200) return;
    } catch {}
    await delay(300);
  }
  throw new Error("Isolated Next server failed to become ready");
}
async function main() {
  const { nextBin, dbEnv } = preflight();
  Object.assign(process.env, dbEnv); // supply psql on PATH for existing DB test helpers
  await portAvailable();
  // Same bootstrap as authenticated browser acceptance; only after strict DB preflight.
  command(process.execPath, [path.join(ROOT, "tooling", "bootstrap-browser-smoke-db.mjs")],
    "local browser database bootstrap", dbEnv);
  const tmp = mkdtempSync(path.join(os.tmpdir(), "flytally-r2c-"));
  const logFile = path.join(tmp, "provider.jsonl");
  let child, browser, anonymous;
  let stderrTail = "";
  try {
    child = spawn(process.execPath, ["--require", path.join(ROOT, "tooling", "satellite-http-upstream-fixture.cjs"),
      nextBin, "start", "-H", "localhost", "-p", String(PORT)], {
      cwd: ROOT, stdio: ["ignore", "pipe", "pipe"],
      env: { ...dbEnv, NODE_ENV: "production",
        ARCGIS_ACCESS_TOKEN: MODE === "missing-token" ? "" : TOKEN,
        FLYTALLY_SATELLITE_UPSTREAM_DISABLED: MODE === "disabled" ? "true" : "false",
        FLYTALLY_SATELLITE_HTTP_FIXTURE_MODE: MODE,
        FLYTALLY_SATELLITE_HTTP_TILE_X0: String(TILE_X0),
        FLYTALLY_SATELLITE_HTTP_TILE_Y: String(TILE_Y),
        FLYTALLY_SATELLITE_HTTP_FIXTURE: "1", FLYTALLY_SATELLITE_FIXTURE_LOG: logFile },
    });
    child.stderr.on("data", chunk => { stderrTail = (stderrTail + String(chunk)).slice(-2500); });
    // Prevent child pipe backpressure from hanging Next startup.
    child.stdout.resume();
    await waitForServer(child);
    anonymous = await playwrightRequest.newContext({ baseURL: ORIGIN });
    const get = (requester, tile) => requester.get(`${tilePath(tile)}?style=satellite`);
    const anonymousResponse = await get(anonymous, 1);
    assert.equal(anonymousResponse.status(), 401, "Unauthenticated Satellite must be 401");
    assert.equal(anonymousResponse.headers()["cache-control"], "private, no-store");
    assert.equal(upstreamEvents(logFile).length, 0, "No provider request before session gate");

    const invalidStyle = await anonymous.get(`${tilePath(1)}?style=garbage`);
    assert.equal(invalidStyle.status(), 400, "Malformed style must be 400");
    assert.equal(invalidStyle.headers()["cache-control"], "no-store");
    const duplicateStyle = await anonymous.get(`${tilePath(1)}?style=map&style=satellite`);
    assert.equal(duplicateStyle.status(), 400, "Duplicate style must be 400");
    assert.equal(duplicateStyle.headers()["cache-control"], "no-store");
    assert.equal(upstreamEvents(logFile).length, 0);

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ baseURL: ORIGIN });
    await context.route("**/*", async route => {
      if (new URL(route.request().url()).origin !== ORIGIN) return route.abort();
      return route.continue(); // Do not intercept the application tile endpoint.
    });
    const page = await context.newPage();
    await loginBrowserPilot(page, "/map");
    // Confirm the actual browser persisted the server-issued session, and
    // do not copy, print, override or inject its opaque value into requests.
    const browserCookies = await context.cookies(ORIGIN);
    const sessions = browserCookies.filter(cookie => cookie.name === "logbook_session");
    assert.equal(sessions.length, 1, "Production login must set exactly one browser session cookie");
    assert.equal(sessions[0].httpOnly, true, "Session must remain HttpOnly");
    assert.equal(sessions[0].secure, true, "Production session must remain Secure");
    assert.equal(new URL(page.url()).origin, ORIGIN, "Login must end at isolated localhost origin");
    const renderedHtml = await page.content();
    assert.ok(!renderedHtml.includes("FLYTALLY_SATELLITE_UPSTREAM_DISABLED") && !renderedHtml.includes(TOKEN),
      "Server-only switch and synthetic provider credentials must not appear in page HTML");

    // Use browser-native fetch, not Playwright's Node-side APIRequestContext:
    // cookie policy and browser transport must match actual user behavior.
    async function browserTile(x) {
      return page.evaluate(async ({ scenario, x0, y, z }) => {
        const response = await fetch(`/api/map-tile/${z}/${x0 + scenario - 1}/${y}?style=satellite`, {
          credentials: "same-origin", cache: "no-store",
        });
        return {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: await response.text(),
        };
      }, { scenario: x, x0: TILE_X0, y: TILE_Y, z: TILE_Z });
    }

    async function expectedTile(x, status, marker, labelsMarker = null) {
      const response = await browserTile(x);
      assert.equal(response.status, status, `Satellite status at x=${x}; session cookie present: ${sessions.length === 1}`);
      assert.equal(response.headers["cache-control"], status === 200 ? "private, no-store" : "no-store",
        "Authenticated success is private; unavailable tiles must never be cacheable");
      assert.equal(response.headers["x-flytally-map-style"], status === 200 ? "satellite" : "unavailable");
      const body = response.body;
      assert.ok(!body.includes(TOKEN), "Fake token must never be disclosed in response");
      if (status === 200) {
        assert.match(response.headers["content-type"], /^image\/svg\+xml/);
        assert.ok(body.includes(Buffer.from(marker).toString("base64")), `Base imagery missing at x=${x}`);
        if (labelsMarker) assert.ok(body.includes(Buffer.from(labelsMarker).toString("base64")), "Labels missing");
        else assert.equal((body.match(/<image /g) || []).length, 1, "Imagery-only must not fabricate labels");
      }
      return response;
    }
    if (MODE === "enabled") {
      await expectedTile(1, 200, "FLYTALLY_HTTP_BASE_2C", "FLYTALLY_HTTP_LABEL_2C");
      await expectedTile(2, 200, "FLYTALLY_HTTP_BASE_2C", "FLYTALLY_HTTP_FALLBACK_2C");
      await expectedTile(3, 502);
      await expectedTile(4, 200, "FLYTALLY_HTTP_BASE_2C");
      await expectedTile(5, 502);
      const events = upstreamEvents(logFile);
      for (const x of ["1", "2", "3", "4", "5"]) {
        assert.ok(events.some(event => event.kind === "base" && event.x === x), `Base fetch not observed for x=${x}`);
      }
      assert.ok(events.some(event => event.kind === "fallback" && event.x === "2"));
      assert.ok(events.some(event => event.kind === "fallback" && event.x === "4"));
      assert.ok(!events.some(event => event.kind === "fallback" && event.x === "3"), "No fallback after failed base");
    } else {
      // Disabled and missing-token modes share the external non-image 503
      // contract. Check both repeated requests (including an already-warmed
      // tile URL from a preceding enabled-mode test run) and zero upstream.
      for (let i = 0; i < 2; i++) {
        const unavailable = await browserTile(1);
        assert.equal(unavailable.status, 503, `Satellite ${MODE}: authenticated request must return 503`);
        assert.equal(unavailable.headers["cache-control"], "no-store");
        assert.equal(unavailable.headers["x-flytally-map-style"], "unavailable");
        assert.ok(!String(unavailable.headers["content-type"] || "").startsWith("image/"));
        assert.ok(!unavailable.body.includes("<svg") && !unavailable.body.includes(TOKEN) &&
          !unavailable.body.includes("FLYTALLY_SATELLITE_UPSTREAM_DISABLED"),
          "Unavailable Satellite must not provide imagery, HTML, or provider credentials");
        assert.equal(upstreamEvents(logFile).length, 0, "Unavailable Satellite must bypass upstream and warm fetch cache");
      }
    }
    const beforeRevocation = upstreamEvents(logFile).length;
    runBrowserSql("UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id=9001 AND revoked_at IS NULL;");
    const afterRevocation = await browserTile(1);
    assert.equal(afterRevocation.status, 401, "Revoked login must fail before cached provider response");
    assert.equal(upstreamEvents(logFile).length, beforeRevocation);
    const standard = await anonymous.get(`${tilePath(1)}?style=map`);
    assert.equal(standard.status(), 200, "Public Standard must remain available");
    assert.equal(standard.headers()["x-flytally-map-style"], "map");
    assert.match(standard.headers()["cache-control"], /^public,/);
    assert.equal(standard.headers()["access-control-allow-origin"], "*");
    console.log(`R2D HTTP fixture: PASS (mode=${MODE}) — anonymous 401, malformed/duplicate 400, session revocation 401, Standard 200, Satellite ${MODE === "enabled" ? "200/fallback/502" : "503 / zero upstream"}`);
    console.log(`R2D upstream interceptions: ${upstreamEvents(logFile).length} (synthetic, no real provider calls)`);
    console.log(`R2D tile fixture series: z=${TILE_Z}, x-start=${TILE_X0}, y=${TILE_Y} (fresh URLs; no upstream cache purge)`);
  } catch (error) {
    console.error(`R2D HTTP fixture (mode=${MODE}): FAIL`, error instanceof Error ? error.message : String(error));
    // Only logical case id, request kind and HTTP outcome: never log token,
    // session cookie, GPS/flight details or actual coordinate payload.
    console.error("R2D synthetic upstream event summary:", JSON.stringify(upstreamEvents(logFile)));
    if (stderrTail) console.error("Server diagnostic (truncated):", stderrTail.replaceAll(TOKEN, "[redacted]"));
    process.exitCode = 1;
  } finally {
    if (anonymous) await anonymous.dispose().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (child && child.exitCode === null) child.kill();
    rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error("R2C preflight: FAIL", error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});
