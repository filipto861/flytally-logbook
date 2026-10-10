// M3-D5: loopback-only transport/exit investigation. No ArcGIS calls, no credentials.
// Child runs actual Node fetch over 127.0.0.1 and parent observes native exit status.
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const self = fileURLToPath(import.meta.url);
const scenarios = [
  ["mime-reject", "exit-code"],
  ["mime-reject", "immediate-exit"],
  ["chunked-reject", "exit-code"],
  ["chunked-reject", "immediate-exit"],
  ["truncated-body", "exit-code"],
];

if (process.argv[2] === "--child") {
  const scenario = process.argv[3], termination = process.argv[4];
  if (!scenarios.some(([s, t]) => s === scenario && t === termination)) process.exit(3);
  const server = createServer((_, res) => {
    res.setHeader("Content-Type", "text/plain");
    if (scenario === "chunked-reject") {
      res.write("ignored-prefix");
      setTimeout(() => res.end("ignored-suffix"), 30);
    } else if (scenario === "truncated-body") {
      res.setHeader("Content-Length", "1000");
      res.write("truncated");
      setTimeout(() => res.destroy(), 30);
    } else {
      res.end("ignored-body");
    }
  });
  await new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(0, "127.0.0.1", ok);
  });
  const address = server.address();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  let body, reader, outcome = "not-run";
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/metadata`, {
      method: "GET", redirect: "error", cache: "no-store", signal: controller.signal,
    });
    body = response.body;
    if (scenario === "truncated-body") {
      reader = body.getReader();
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
      }
      outcome = "unexpected-completion";
    } else {
      // Exactly the MIME-refusal branch of original collector: do not read body.
      outcome = response.headers.get("content-type") === "text/plain" ? "mime-refused" : "unexpected-mime";
    }
  } catch {
    outcome = scenario === "truncated-body" ? "transport-error" : "fetch-error";
  } finally {
    if (reader) {
      try { await reader.cancel("cleanup"); } catch {}
    } else if (body) {
      try { await body.cancel("cleanup"); } catch {}
    }
    controller.abort();
    clearTimeout(timer);
    try { reader?.releaseLock(); } catch {}
  }
  process.stdout.write(JSON.stringify({ scenario, termination, outcome }) + "\n");
  if (termination === "immediate-exit") process.exit(2);
  process.exitCode = 2;
  server.close();
} else {
  if (process.argv.length !== 2) {
    process.stderr.write("No arguments accepted.\n");
    process.exitCode = 2;
  } else {
    let failures = 0;
    for (const [scenario, termination] of scenarios) {
      const child = spawnSync(process.execPath, [self, "--child", scenario, termination], {
        timeout: 6000, encoding: "utf8",
        env: { ...process.env, ARCGIS_ACCESS_TOKEN: "", FLYTALLY_SATELLITE_METADATA_LIVE_APPROVED: "" },
      });
      let result;
      try { result = JSON.parse(child.stdout.trim()); } catch { result = null; }
      const expected = scenario === "truncated-body" ? "transport-error" : "mime-refused";
      const pass = child.status === 2 && result?.outcome === expected &&
        child.signal === null && !child.error && !child.stderr.includes("Assertion failed");
      if (!pass) failures++;
      process.stdout.write(JSON.stringify({
        scenario, termination, outcome: pass ? "PASS" : "FAIL",
        reportedOutcome: result?.outcome ?? "missing",
        exitCode: child.status, signal: child.signal ?? null,
        nativeAssertionObserved: child.stderr.includes("Assertion failed"),
        timedOut: child.error?.code === "ETIMEDOUT",
      }) + "\n");
    }
    process.exitCode = failures ? 1 : 0;
  }
}
