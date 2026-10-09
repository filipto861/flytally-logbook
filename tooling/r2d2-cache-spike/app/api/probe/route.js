// Isolated test-only Next project; not imported by the production Logbook app.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const incoming = new URL(request.url);
  const mode = incoming.searchParams.get("mode");
  const sample = incoming.searchParams.get("sample");
  const action = incoming.searchParams.get("action");
  const key = incoming.searchParams.get("key");
  if (!["cached", "uncached"].includes(mode) ||
      !["normal", "large", "stall"].includes(sample) ||
      !["complete", "abort"].includes(action) ||
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
        if (action === "abort") {
          controller.abort("probe-reader-abort");
          // Do not await cancellation: a cache-tee sibling may be uncooperative.
          void reader.cancel("probe-reader-abort").catch(() => {});
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
    return Response.json({ mode, sample, action, phase: "completed", bytes,
      firstChunkMs, elapsedMs: Math.round(performance.now() - start) });
  } catch (error) {
    controller.abort("probe-error");
    return Response.json({ mode, sample, action, phase,
      outcome: "error-or-abort", reason: error?.name === "AbortError" ? "aborted" :
        controller.signal.aborted ? "aborted-or-cancelled" : "failed",
      bytes, firstChunkMs, elapsedMs: Math.round(performance.now() - start) });
  } finally {
    clearTimeout(watchdog);
  }
}
