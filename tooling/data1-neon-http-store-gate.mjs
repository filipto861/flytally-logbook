#!/usr/bin/env node
// DATA-1D synthetic stored-archive transport acceptance, EXECUTOR-LOCAL only.
// Never creates or deletes Neon projects. Never reads production flight records.
// The human operator provides DATABASE_URL ONLY inside this runner's local process.
// A successful run proves the tested sizes, not a provider maximum or real v13 restore.
import { createHash, randomBytes } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const MIB = 1048576;
export const PRESETS = Object.freeze([1, 4, 12]);
const BLOCKED_PROJECT_IDS = new Set([
  "muddy-dust-14049657", // existing Logbook Shadow, NEVER TEST
  "frosty-recipe-46458686", // FlyTally Training Production
  "dry-king-94424047", // FlyTally Training Acceptance
]);
const EXPECTED_DRIVER_VERSION = "1.1.0";

export function parseArgs(args) {
  if (args.length === 2 && args[0] === "--synthetic-only" && args[1] === "--probe")
    return { mode: "probe" };
  if (args.length === 3 && args[0] === "--synthetic-only"
    && args[1] === "--execute" && /^--confirm=[a-f0-9]{20}$/.test(args[2]))
    return { mode: "execute", confirm: args[2].slice(10) };
  throw new Error("Use --synthetic-only --probe OR --synthetic-only --execute --confirm=<20-hex-probe-token>.");
}

export function checkTarget(env) {
  if (env.DATA1_SYNTHETIC_ONLY !== "1") throw new Error("Synthetic-only opt-in missing.");
  if (env.CI || env.VERCEL || env.VERCEL_ENV || env.NEON_DATABASE_URL || env.PGHOST)
    throw new Error("Refused inherited CI/deployment/alternative database context.");
  const id = env.DATA1_EXPECTED_PROJECT_ID || "";
  const branch = env.DATA1_EXPECTED_BRANCH_ID || "";
  const db = env.DATA1_EXPECTED_DATABASE || "";
  const role = env.DATA1_EXPECTED_ROLE || "";
  if (!/^[a-z]+-[a-z]+-[0-9]{5,}$/.test(id) || BLOCKED_PROJECT_IDS.has(id))
    throw new Error("Missing/blocked disposable Neon project ID.");
  if (!/^br-[a-z0-9-]+$/.test(branch)) throw new Error("Missing independently verified disposable branch ID.");
  if (!/^synthetic_data1(?:_[a-z0-9]+)?$/.test(db) ||
      !/^synthetic_data1_owner(?:_[a-z0-9]+)?$/.test(role))
    throw new Error("Expected disposable database/role names do not match dedicated synthetic namespace.");
  if (typeof env.DATABASE_URL !== "string" || !env.DATABASE_URL)
    throw new Error("DATABASE_URL is missing in the local executor.");
  let uri;
  try { uri = new URL(env.DATABASE_URL); }
  catch { throw new Error("Invalid local DATABASE_URL."); }
  if (!["postgresql:", "postgres:"].includes(uri.protocol) ||
      !/^[a-z0-9.-]+\.neon\.tech$/.test(uri.hostname) ||
      uri.hostname.includes("localhost") ||
      uri.pathname !== "/" + db || decodeURIComponent(uri.username) !== role ||
      !uri.password)
    throw new Error("Refused: URL host, database or role does not match the disposable connection.");
  return { id, branch, db, role, hostname: uri.hostname };
}

export function makeSyntheticArchive(mib, random = randomBytes) {
  if (!PRESETS.includes(mib)) throw new Error("Unapproved synthetic payload preset.");
  const bytes = random(mib * MIB - 32768);
  if (!Buffer.isBuffer(bytes) || bytes.length !== mib * MIB - 32768)
    throw new Error("Synthetic random source returned an invalid bounded buffer.");
  const document = {
    format: "flytally-data1-transport-only-not-restorable",
    version: 13, source: "FABRICATED-NO-PILOT-DATA",
    exported_at: "2026-10-30T00:00:00.000Z",
    fake_signature: "NOT-A-VALID-SIGNED-ARCHIVE",
    opaque_synthetic_bytes_base64: bytes.toString("base64"),
  };
  const raw = Buffer.from(JSON.stringify(document, null, 2), "utf8");
  const gzip = gzipSync(raw, { level: 9 });
  if (gzip.length > 50 * MIB) throw new Error("Synthetic archive exceeds existing gzip guard.");
  return { raw, gzip, base64: gzip.toString("base64"),
    digest: createHash("sha256").update(raw).digest("hex") };
}

export function verifyStoredArchive(artifact, row) {
  if (!row || typeof row.payload_base64 !== "string" ||
      typeof row.payload_sha256 !== "string") return false;
  if (row.payload_base64 !== artifact.base64 ||
      row.payload_sha256 !== artifact.digest ||
      Number(row.raw_bytes) !== artifact.raw.length ||
      Number(row.compressed_bytes) !== artifact.gzip.length) return false;
  const gzip = Buffer.from(row.payload_base64, "base64");
  if (!gzip.equals(artifact.gzip)) return false;
  let raw;
  try { raw = gunzipSync(gzip, { maxOutputLength: 24 * MIB }); }
  catch { return false; }
  return raw.equals(artifact.raw) &&
    createHash("sha256").update(raw).digest("hex") === artifact.digest;
}

export function makeProbeToken(target, preflight) {
  const parts = [target.id,target.branch,target.db,target.role,target.hostname,
    preflight.pg_version,preflight.boot_time];
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0,20);
}

async function preflight(sql, target) {
  const result = await sql.query(
    "SELECT current_database() AS db, current_user AS role, current_setting('server_version_num')::int AS pg_version, " +
    "pg_postmaster_start_time()::text AS boot_time, " +
    "(SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS tables"
  );
  const row = result[0];
  if (result.length !== 1 || row.db !== target.db || row.role !== target.role ||
      !Number.isInteger(Number(row.pg_version)) ||
      Number(row.pg_version) < 160000 || Number(row.pg_version) >= 170000 ||
      Number(row.tables) !== 0 || !row.boot_time)
    throw new Error("Disposable PG16 identity, empty schema or boot proof failed; NO WRITE.");
  return row;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (Number(process.versions.node.split(".")[0]) !== 24)
    throw new Error("Node 24 required; no fallback to another runtime.");
  const target = checkTarget(process.env);
  const versionInfo = JSON.parse(readFileSync(
    new URL("../node_modules/@neondatabase/serverless/package.json", import.meta.url), "utf8"));
  if (versionInfo.version !== EXPECTED_DRIVER_VERSION)
    throw new Error("Pinned @neondatabase/serverless version mismatch.");
  // The URL is never returned, logged, persisted, or passed to another tool.
  const { neon, neonConfig } = await import("@neondatabase/serverless");
  const transport = [];
  neonConfig.fetchFunction = async (input, init) => {
    const started = performance.now();
    const requestBytes = typeof init?.body === "string"
      ? Buffer.byteLength(init.body, "utf8") : null;
    const response = await fetch(input, init);
    const resultBytes = (await response.clone().arrayBuffer()).byteLength;
    transport.push({ status: response.status, requestBytes, responseBytes: resultBytes,
      ms: Math.round(performance.now() - started) });
    return response;
  };
  const sql = neon(process.env.DATABASE_URL, { fullResults: false, arrayMode: false });
  const initial = await preflight(sql, target);
  const confirm = makeProbeToken(target, initial);
  if (args.mode === "probe") {
    console.log(JSON.stringify({ phase: "READ_ONLY_PROBE", status: "PASS",
      expectedProjectId: target.id, expectedBranchId: target.branch,
      db: initial.db, role: initial.role, pgVersion: initial.pg_version,
      tables: initial.tables, proof: confirm,
      warning: "Project/branch IDs were operator-provided, NOT proven by SQL. Independently verify Neon console before --execute." }));
    return;
  }
  if (args.confirm !== confirm || process.env.DATA1_ALLOW_TEST_WRITES !== "YES_DISPOSABLE_ONLY")
    throw new Error("Write authorization or probe confirmation mismatch; NO WRITE.");
  console.log(JSON.stringify({phase:"EXECUTION_PREFLIGHT",status:"PASS",
    projectId:target.id,branchId:target.branch,db:target.db,pgVersion:initial.pg_version}));
  // The one and only schema write: only after independent, empty-DB preflight and confirmation.
  await sql.query("CREATE TABLE public.data1_synthetic_archive (" +
    "id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, preset_mib integer UNIQUE NOT NULL, " +
    "payload_base64 text NOT NULL, payload_sha256 text NOT NULL, " +
    "raw_bytes bigint NOT NULL, compressed_bytes bigint NOT NULL)");
  for (const mib of PRESETS) {
    const a = makeSyntheticArchive(mib);
    const insertStart = transport.length;
    const ids = await sql.query(
      "INSERT INTO public.data1_synthetic_archive " +
      "(preset_mib,payload_base64,payload_sha256,raw_bytes,compressed_bytes) " +
      "VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [mib,a.base64,a.digest,a.raw.length,a.gzip.length]);
    const insertHttp = transport.slice(insertStart);
    if (ids.length !== 1 || !ids[0].id) throw new Error("INSERT id not returned.");
    const readStart = transport.length;
    const rows = await sql.query(
      "SELECT payload_base64,payload_sha256,raw_bytes,compressed_bytes " +
      "FROM public.data1_synthetic_archive WHERE id=$1", [ids[0].id]);
    const selectHttp = transport.slice(readStart);
    const pass = rows.length === 1 && verifyStoredArchive(a,rows[0]) &&
      insertHttp.length === 1 && selectHttp.length === 1 &&
      insertHttp[0].status === 200 && selectHttp[0].status === 200 &&
      insertHttp[0].requestBytes !== null && selectHttp[0].responseBytes > 0;
    console.log(JSON.stringify({phase:"STORED_NEON_HTTP",mib,preset:"APPROXIMATE_COMPRESSED_MIB",
      result:pass?"PASS":"FAIL",rawBytes:a.raw.length,gzipBytes:a.gzip.length,
      base64Bytes:Buffer.byteLength(a.base64),insertHttp,selectHttp,
      rssMiB:Math.round(process.memoryUsage().rss/MIB),
      note:"synthetic unsigned fixture, not an application restore or provider max"}));
    if (!pass) throw new Error("Stored HTTP byte-integrity assertion failed. STOP.");
  }
  console.log(JSON.stringify({phase:"COMPLETE",passed:PRESETS.length,
    requiredCleanup:"DELETE ONLY positively verified newly-created test project outside this tool"}));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    // Never emit driver errors: they can include SQL, credentials or payloads.
    console.error(JSON.stringify({phase:"FAILED",errorClass:String(error?.name || "Error"),
      safeCode:"DATA1_HTTP_GATE_STOPPED",message:"No further tests; inspect sanitized checkpoint."}));
    process.exitCode = 1;
  });
}
