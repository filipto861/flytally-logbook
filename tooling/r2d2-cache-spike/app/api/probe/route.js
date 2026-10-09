// Isolated test-only Next project; not imported by the production Logbook app.
import { appendFileSync } from "node:fs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const incoming = new URL(request.url);
  const mode = incoming.searchParams.get("mode");
  const sample = incoming.searchParams.get("sample");
  const action = incoming.searchParams.get("action");
  const key = incoming.searchParams.get("key");
  const disconnectProbe = incoming.searchParams.get("disconnectProbe") || "off";
  if (!["cached", "uncached"].includes(mode) ||
      !["normal", "large", "stall"].includes(sample) ||
      !["complete", "abort", "abort-late", "cancel-only"].includes(action) ||
      !["off", "observe", "link"].includes(disconnectProbe) ||
      (disconnectProbe !== "off" && (sample !== "large" || action !== "complete")) ||
      !/^[a-z0-9_-]{1,80}$/.test(key || "")) {
    return Response.json({ error: "invalid_probe_parameters" }, { status: 400 });
  }
  const origin = new URL(process.env.FLYTALLY_R2D2_SPIKE_UPSTREAM || "");
  if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" ||
      !/^[0-9]+$/.test(origin.port) || origin.pathname !== "/" || origin.search || origin.hash) {
    return Response.json({ error: "unsafe_fixture_origin" }, { status: 503 });
  }
  const start = performance.now();
  const controller = new AbortController();
  // Test-only event trace: downstream HTTP client cannot read route outcomes
  // after disconnect. Record *only* experiment markers, no cookies or tokens.
  const signalLog = process.env.FLYTALLY_R2D2_SPIKE_ROUTE_EVENTS;
  if (disconnectProbe !== "off" &&
      (process.env.FLYTALLY_R2D2_SPIKE !== "1" || !signalLog)) {
    return Response.json({ error: "missing_isolated_signal_log" }, { status: 503 });
  }
  function trace(event, other = {}) {
    if (disconnectProbe === "off") return;
    appendFileSync(signalLog, JSON.stringify({
      at: Date.now(), event, mode, disconnectProbe, key, ...other,
    }) + "\n");
  }
  let clientSignalEvents = 0;
  const onClientAbort = () => {
    clientSignalEvents++;
    trace("incoming-request-signal-abort", { requestAborted: request.signal.aborted });
    if (disconnectProbe === "link") {
      controller.abort("incoming-request-aborted");
      trace("linked-upstream-controller-abort");
    }
  };
  if (disconnectProbe !== "off") {
    trace("route-start", { requestAlreadyAborted: request.signal.aborted });
    request.signal.addEventListener("abort", onClientAbort, { once: true });
    if (request.signal.aborted) onClientAbort();
  }
  // LAB-ONLY watchdog: NOT a proposed production timeout or size budget.
  const watchdog = setTimeout(() => controller.abort("lab-watchdog"), 4500);
  let bytes = 0;
  let firstChunkMs = null;
  let phase = "fetch";
  try {
    const url = new URL("/bytes", origin);
    url.searchParams.set("sample", sample);
    url.searchParams.set("key", key);
    const cacheOptions = mode === "cached"
      ? { next: { revalidate: 604800 } }
      : { cache: "no-store" };
    const response = await fetch(url, { ...cacheOptions, signal: controller.signal });
    phase = "body";
    if (!response.ok || !response.body) throw new Error("invalid-fixture-response");
    const reader = response.body.getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (firstChunkMs === null) firstChunkMs = Math.round(performance.now() - start);
        bytes += value.byteLength;
        const stop = action === "abort" || action === "cancel-only" ||
          (action === "abort-late" && bytes >= 512 * 1024);
        if (stop) {
          // Only "cancel-only" intentionally leaves fetch signal alive to
          // measure whether Next's cache sibling keeps reading the upstream.
          if (action !== "cancel-only") controller.abort("probe-reader-abort");
          // Never await cancel of an uncooperative cache tee; observe separately.
          void reader.cancel("probe-reader-stop").catch(() => {});
          phase = action === "cancel-only" ? "reader-cancelled-no-abort" : "reader-aborted";
          break;
        }
        // LAB-ONLY guard. Abort, never concatenate or return bulk fixture data.
        if (bytes > 24 * 1024 * 1024) {
          controller.abort("probe-lab-maximum");
          throw new Error("lab-ceiling");
        }
      }
    } finally {
      if (action === "complete") {
        reader.releaseLock();
      }
    }
    return Response.json({ mode, sample, action, phase: phase === "body" ? "completed" : phase,
      signalAborted: controller.signal.aborted, bytes,
      firstChunkMs, elapsedMs: Math.round(performance.now() - start) });
  } catch (error) {
    controller.abort("probe-error");
    return Response.json({ mode, sample, action, phase,
      outcome: "error-or-abort", reason: error?.name === "AbortError" ? "aborted" :
        controller.signal.aborted ? "aborted-or-cancelled" : "failed",
      bytes, firstChunkMs, elapsedMs: Math.round(performance.now() - start) });
  } finally {
    clearTimeout(watchdog);
    if (disconnectProbe !== "off") {
      trace("route-finally", {
        bytes, clientSignalEvents, requestSignalAborted: request.signal.aborted,
        upstreamSignalAborted: controller.signal.aborted,
        phase, elapsedMs: Math.round(performance.now() - start),
      });
      request.signal.removeEventListener("abort", onClientAbort);
    }
  }
}
