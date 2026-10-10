// Offline-only Windows Node 24 HTTP stream teardown diagnostic.
// Loopback 127.0.0.1 only; no credential, repository providers or external requests.
// Separate child process per scenario so native assertion cannot terminate the parent.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const self = fileURLToPath(import.meta.url);
const cases = ["drain", "cancel-body", "abort-after-cancel", "abort-after-drain"];
if (process.argv[2] === "--child") {
  const scenario = process.argv[3];
  if (!cases.includes(scenario)) process.exit(2);
  const { createServer } = await import("node:http");
  const server = createServer((_req, res) => {
    res.writeHead(200, {"Content-Type": "text/plain"});
    res.end('{"tileInfo":{"rows":256}}');
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const controller = new AbortController();
  let response;
  try {
    response = await fetch(`http://127.0.0.1:${address.port}/metadata`, {
      cache: "no-store", redirect: "error", signal: controller.signal,
    });
    if (response.status !== 200 || response.headers.get("content-type") !== "text/plain")
      throw Error("unexpected-loopback-response");
    if (scenario === "drain" || scenario === "abort-after-drain") {
      await response.arrayBuffer();
    } else {
      await response.body.cancel("local-test");
    }
    if (scenario.startsWith("abort-after-")) controller.abort();
    process.stdout.write(JSON.stringify({scenario, outcome:"completed"}) + "\n");
  } catch {
    process.stdout.write(JSON.stringify({scenario, outcome:"error"}) + "\n");
    process.exitCode = 2;
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
} else {
  if (process.argv.length !== 2) {
    process.stderr.write("This diagnostic takes no arguments.\n");
    process.exitCode = 2;
  } else {
    let errors = 0;
    for (const scenario of cases) {
      const result = spawnSync(process.execPath, [self, "--child", scenario], {
        encoding:"utf8", timeout:10000,
        env: {...process.env, ARCGIS_ACCESS_TOKEN:"", FLYTALLY_SATELLITE_METADATA_LIVE_APPROVED:""},
      });
      const healthy = result.status === 0 && result.signal === null &&
        result.stdout.includes('"outcome":"completed"') &&
        !result.stderr.includes("Assertion failed");
      process.stdout.write(JSON.stringify({
        scenario, outcome:healthy?"PASS":"FAIL",
        exitCode:result.status, signal:result.signal ?? null,
        nodeAssertionObserved:result.stderr.includes("Assertion failed"),
        timedOut:Boolean(result.error && result.error.code === "ETIMEDOUT"),
      }) + "\n");
      if (!healthy) errors++;
    }
    process.exitCode = errors ? 1 : 0;
  }
}
