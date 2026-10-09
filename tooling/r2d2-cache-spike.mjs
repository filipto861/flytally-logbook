// Manual-only R2D.2-A experiment. Does NOT run in the FlyTally application.
// Builds a separate tiny Next app under tooling/r2d2-cache-spike; no DB,
// provider credentials, ArcGIS or external URLs are used.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer as createTcpServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT = path.join(ROOT, "tooling", "r2d2-cache-spike");
const REPORT_DIR = path.join(PROJECT, "reports");
const LOCKED_NEXT = "16.3.2";
const BRANCH = "feat/3.7.0-satellite-r2d2-bounded-provider-io";
const RUN = randomBytes(8).toString("hex");
const LAB_TIMEOUT_MS = 4500; // LAB-ONLY watchdog; NOT production timeout policy
function command(exe, args, label) {
  const run = spawnSync(exe, args, { cwd: ROOT, encoding: "utf8", timeout: 15_000 });
  if (run.error || run.status !== 0) {
    throw new Error(label + ": " + String(run.error?.message || run.stderr || run.stdout).slice(-600));
  }
  return (run.stdout || "").trim();
}
function preflight() {
  assert.equal(command("git", ["branch", "--show-current"], "branch"), BRANCH,
    "Only execute on the dedicated experimental branch");
  assert.equal(command("git", ["status", "--porcelain"], "clean tree"), "",
    "Refuse dirty worktree; experiment results must bind to a clean commit");
  assert.match(command("git", ["rev-parse", "HEAD"], "commit"), /^[0-9a-f]{40}$/);
  const lock = JSON.parse(readFileSync(path.join(ROOT, "package-lock.json"), "utf8"));
  assert.equal(lock.packages["node_modules/next"].version, LOCKED_NEXT,
    "Spike must use precisely the production-locked Next.js version");
  assert.equal(Number(process.versions.node.split(".")[0]), 24, "Use repository-pinned Node 24.x");
  assert.ok(existsSync(path.join(ROOT, "node_modules", "next", "dist", "bin", "next")),
    "Install the repository dependencies before running the spike");
  assert.ok(existsSync(path.join(PROJECT, "app", "api", "probe", "route.js")));
  assert.ok(existsSync(path.join(PROJECT, "preload.cjs")));
  // A nested Next app without its own config can pick up the ancestor
  // production next.config.ts and then fail to resolve ./lib/ imports.
  // Explicitly require a self-contained, checked-in lab config.
  const labConfigPath = path.join(PROJECT, "next.config.mjs");
  assert.ok(existsSync(labConfigPath), "Isolated Next project must own its config");
  const labConfig = readFileSync(labConfigPath, "utf8");
  assert.match(labConfig, /turbopack:\s*\{\s*root:/,
    "The laboratory must explicitly pin its compiler dependency root");
  assert.doesNotMatch(labConfig, /commercial-build-guard|from\s+["']\.\.\/\.\.\/lib\//,
    "Never inherit production application build controls via the lab configuration");
  return command("git", ["rev-parse", "HEAD"], "commit");
}
async function freePort() {
  const s = createTcpServer();
  await new Promise((resolve, reject) => {
    s.once("error", reject);
    s.listen(0, "127.0.0.1", resolve);
  });
  const p = s.address().port;
  await new Promise((resolve, reject) => s.close(err => err ? reject(err) : resolve()));
  return p;
}
async function runProcess(exe, args, cwd, env, limit, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { cwd, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let tail = "";
    const append = chunk => { tail = (tail + String(chunk)).slice(-4000); };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    const watchdog = setTimeout(() => {
      child.kill();
      reject(new Error(label + " timed out; " + tail));
    }, limit);
    child.once("error", e => { clearTimeout(watchdog); reject(e); });
    child.once("exit", (code, signal) => {
      clearTimeout(watchdog);
      if (code === 0) resolve({ tail });
      else reject(new Error(label + " failed with " + (signal || code) + ": " + tail));
    });
  });
}
function fixtureServer(events) {
  return createHttpServer((req, res) => {
    let url;
    try { url = new URL(req.url, "http://127.0.0.1"); }
    catch { res.writeHead(400).end(); return; }
    const sample = url.searchParams.get("sample");
    const key = url.searchParams.get("key");
    if (req.method !== "GET" || url.pathname !== "/bytes" ||
        !["normal", "large", "stall"].includes(sample) ||
        !/^[a-z0-9_-]{1,80}$/.test(key || "")) {
      res.writeHead(400).end(); return;
    }
    const event = { sample, key, emitted: 0, chunks: 0, started: Date.now(),
      close: null, finished: false };
    events.push(event);
    // Synthetic binary only. LAB test sizes (64 KiB, 16 MiB) are NOT product limits.
    const goal = sample === "normal" ? 64 * 1024 : sample === "large" ? 16 * 1024 * 1024 : 1024;
    const chunk = Buffer.alloc(sample === "stall" ? 1024 : 64 * 1024, 0x41);
    res.writeHead(200, { "content-type": "application/octet-stream" });
    res.on("close", () => { event.close = Date.now(); clearInterval(timer); });
    const timer = setInterval(() => {
      if (res.destroyed) { clearInterval(timer); return; }
      if (res.writableNeedDrain) return;
      if (event.emitted < goal) {
        const size = Math.min(chunk.length, goal - event.emitted);
        const accepted = res.write(chunk.subarray(0, size));
        event.emitted += size;
        event.chunks += 1;
        if (!accepted) return; // avoid aggressive producer oversubscription
      }
      if (event.emitted >= goal && sample !== "stall") {
        event.finished = true;
        clearInterval(timer);
        res.end();
      }
      // "stall" deliberately remains open after 1 KiB until consumer abort/child shutdown.
    }, 8);
    timer.unref?.();
  });
}
async function waitForApp(origin, child) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error("Next child exited early");
    try {
      const r = await fetch(origin, { signal: AbortSignal.timeout(800) });
      if (r.ok) return;
    } catch {}
    await sleep(120);
  }
  throw new Error("Isolated Next app never became ready");
}
function memorySummary(file, requests = []) {
  if (!existsSync(file)) return { samples: 0, sampling: "not recorded" };
  const lines = readFileSync(file, "utf8").trim().split("\n").filter(Boolean);
  const rows = lines.flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  if (!rows.length) return { samples: 0, sampling: "not recorded" };
  const peak = (items, field) => items.length
    ? Math.round(Math.max(...items.map(row => row[field] || 0)) / 1048576) : null;
  const summary = { samples: rows.length, processes: [...new Set(rows.map(r => r.pid))],
    peakRssMiB: peak(rows, "rss"),
    peakHeapMiB: peak(rows, "heapUsed"),
    peakExternalMiB: peak(rows, "external"),
    peakArrayBuffersMiB: peak(rows, "arrayBuffers"),
    // Observed whole-process peaks within windows; NOT per-request allocations
    // and NOT a substitute for heap profiling / downstream received bytes.
    windows: requests.filter(r => r.startedEpochMs && r.postObserveUntilEpochMs).map(r => {
      const points = rows.filter(m => m.t >= r.startedEpochMs && m.t <= r.postObserveUntilEpochMs);
      return { mode: r.mode, sample: r.sample, action: r.action,
        samples: points.length, peakRssMiB: peak(points, "rss"),
        peakHeapMiB: peak(points, "heapUsed"),
        peakExternalMiB: peak(points, "external") };
    }) };
  return summary;
}
async function main() {
  const sha = preflight();
  mkdirSync(REPORT_DIR, { recursive: true });
  const events = [];
  const upstream = fixtureServer(events);
  await new Promise((resolve, reject) => {
    upstream.once("error", reject);
    upstream.listen(0, "127.0.0.1", resolve);
  });
  const upstreamPort = upstream.address().port;
  const appPort = await freePort();
  const require = createRequire(import.meta.url);
  const nextBin = require.resolve("next/dist/bin/next");
  const memoryFile = path.join(REPORT_DIR, "memory-" + RUN + ".jsonl");
  // Minimal OS-only environment. Never forward arbitrary shell/app/provider secrets.
  const osAllow = new Set(["PATH", "PATHEXT", "SYSTEMROOT", "COMSPEC", "WINDIR",
    "TEMP", "TMP", "TMPDIR", "HOME", "USERPROFILE", "HOMEDRIVE", "HOMEPATH",
    "APPDATA", "LOCALAPPDATA", "LANG", "LC_ALL", "OS", "PROCESSOR_ARCHITECTURE"]);
  const baseEnv = Object.fromEntries(Object.entries(process.env).filter(
    ([key]) => osAllow.has(key.toUpperCase())));
  Object.assign(baseEnv, { NEXT_TELEMETRY_DISABLED: "1",
    FLYTALLY_R2D2_SPIKE: "1",
    FLYTALLY_R2D2_SPIKE_MEMORY_LOG: memoryFile,
    FLYTALLY_R2D2_SPIKE_UPSTREAM: "http://127.0.0.1:" + upstreamPort + "/",
    NODE_ENV: "production" });
  let child = null;
  const results = [];
  let problem = null;
  try {
    // Separate Next build; does not rebuild or modify the Logbook production .next.
    await runProcess(process.execPath, [nextBin, "build"], PROJECT, baseEnv, 180_000, "mini Next build");
    child = spawn(process.execPath, [
      "--require", path.join(PROJECT, "preload.cjs"),
      nextBin, "start", "-H", "127.0.0.1", "-p", String(appPort),
    ], { cwd: PROJECT, env: baseEnv, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stdout.on("data", () => {});
    child.stderr.on("data", x => { stderr = (stderr + String(x)).slice(-2000); });
    await waitForApp("http://127.0.0.1:" + appPort + "/", child);
    const requests = [
      ["cached", "normal", "complete", "cache-warm"],
      ["cached", "normal", "complete", "cache-warm"], // same URL: compare upstream events
      ["uncached", "normal", "complete", "no-cache-normal"],
      // Full-size baseline proves the producer can actually send all 16 MiB.
      ["cached", "large", "complete", "cache-large-complete"],
      // Compare signal abort after first chunk versus after a measured 512 KiB.
      ["cached", "large", "abort", "cache-large-abort"],
      ["uncached", "large", "abort", "no-cache-large-abort"],
      ["cached", "large", "abort-late", "cache-large-abort-late"],
      ["uncached", "large", "abort-late", "no-cache-large-abort-late"],
      // Reader-only cancellation deliberately leaves the upstream fetch signal
      // alive; a Next cache tee may continue consuming after the app responds.
      ["cached", "large", "cancel-only", "cache-large-cancel-only"],
      ["uncached", "large", "cancel-only", "no-cache-large-cancel-only"],
      ["cached", "stall", "complete", "cache-stall"],
      ["uncached", "stall", "complete", "no-cache-stall"],
    ];
    for (const [mode, sample, action, key] of requests) {
      const query = new URLSearchParams({ mode, sample, action, key: RUN + "-" + key });
      const eventStart = events.length;
      const start = Date.now();
      try {
        const response = await fetch(
          "http://127.0.0.1:" + appPort + "/api/probe?" + query,
          { signal: AbortSignal.timeout(LAB_TIMEOUT_MS + 3500) });
        const body = await response.json();
        results.push({ mode, sample, action, key: key === "cache-warm" ? "repeated" : "unique",
          status: response.status, startedEpochMs: start, endedEpochMs: Date.now(), elapsedMs: Date.now() - start, body });
      } catch (e) {
        results.push({ mode, sample, action, outcome: "harness-request-failed",
          startedEpochMs: start, endedEpochMs: Date.now(), elapsedMs: Date.now() - start,
          reason: e?.name === "TimeoutError" ? "lab-request-timeout" : "request-failed" });
      }
      // A reader-only cancel may leave a background framework cache tee active.
      // Wait long enough for the 16 MiB synthetic producer to finish if it
      // remains consumed. All waits are lab-only, not application policies.
      const observationWaitMs = action === "cancel-only" ? 3200 : 500;
      await sleep(observationWaitMs);
      const result = results.at(-1);
      result.postObserveUntilEpochMs = Date.now();
      result.observationWaitMs = observationWaitMs;
      result.newUpstreamEvents = events.slice(eventStart).map(event => ({
        sample: event.sample, queuedBytes: event.emitted, chunksQueued: event.chunks,
        completed: event.finished, closed: event.close !== null,
      }));
    }
    if (stderr) results.push({ serverStderrObserved: true, tail: stderr.slice(-600) });
  } catch (e) {
    problem = String(e?.message || e).slice(-1500);
  } finally {
    if (child && child.exitCode === null) {
      child.kill();
      await sleep(300);
    }
    upstream.closeAllConnections?.(); // close any deliberately stalled lab stream
    await new Promise(resolve => upstream.close(resolve));
  }
  const report = {
    kind: "R2D2_A_SYNTHETIC_DIAGNOSTIC_NOT_RELEASE_TEST",
    sha, branch: BRANCH, node: process.versions.node, next: LOCKED_NEXT,
    run: RUN, labValuesAreNotProductionBudgets: true,
    provenance: "next build + next start, isolated tooling mini app and local binary HTTP fixture",
    upstreamEvents: events.map(e => ({ sample: e.sample, key: e.key.slice(17),
      emittedBytes: e.emitted, chunksQueued: e.chunks, completed: e.finished,
      closed: e.close !== null })),
    // emittedBytes reports writes QUEUED by the local fixture, not wire-ACKed socket bytes.
    upstreamMetricLimit: "queued fixture bytes, NOT acknowledged wire bytes",
    memory: memorySummary(memoryFile, results),
    requests: results,
    error: problem,
    verdict: problem ? "SPIKE_INCOMPLETE" : "SPIKE_OBSERVATIONS_ONLY_NO_SAFETY_PASS",
  };
  const reportPath = path.join(REPORT_DIR, "r2d2-spike-" + RUN + ".json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ reportPath, verdict: report.verdict, sha: report.sha,
    requests: report.requests, upstreamEvents: report.upstreamEvents, memory: report.memory }, null, 2));
  if (problem) {
    console.error("R2D.2-A failed: " + problem);
    process.exitCode = 1;
  }
}
main().catch(e => {
  console.error("R2D.2-A PRECHECK FAILED (no probe attempted): " + String(e?.message || e));
  process.exitCode = 2;
});
