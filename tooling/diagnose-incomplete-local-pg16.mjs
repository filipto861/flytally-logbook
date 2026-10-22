// READ-ONLY diagnosis of an interrupted, specifically owned Logbook native PG16 first-run.
// Never writes DB files or prints the password, query output, directory path or raw psql stderr.
import { existsSync, readFileSync, realpathSync, lstatSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { nativePg16Tools, nativeIdentityMismatches, nativeCoreIdentityMismatches } from "./local-native-pg16.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const home = join(root, ".flytally", "persistent-local-pg16");
const data = join(home, "data");
const pwfile = join(home, "bootstrap-pwfile");
const host = "127.0.0.1", port = "55439";
const database = "flytally_logbook_test", user = "flytally_local";
const problem = message => { throw new Error("READ-ONLY DIAGNOSTIC BLOCKED: " + message); };
function run(binary, args, env, timeout = 12000) {
  return spawnSync(binary, args, {
    cwd: root, env, encoding: "utf8", windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"], timeout, maxBuffer: 512 * 1024,
  });
}
function verifyNoRedirect(pathname) {
  if (lstatSync(pathname).isSymbolicLink()) problem("redirected fixture file or directory");
  if (realpathSync.native(pathname).toLowerCase() !== resolve(pathname).toLowerCase()) {
    problem("fixture has a redirected physical path");
  }
}
function outcome(label, result) {
  const err = String(result.stderr ?? "");
  const states = err.match(/\b[0-9]{2}[A-Z0-9]{3}\b/g) || [];
  if (result.error || result.status !== 0) {
    // SQLSTATE is safe to share; raw stderr can contain paths/queries and must not be printed.
    console.log("[DIAG] " + label + ": FAIL (exit " + String(result.status) +
      "; SQLSTATE " + (states[0] || "UNAVAILABLE") +
      "; process " + String(result.error?.code || "OK") + ")");
    return null;
  }
  console.log("[DIAG] " + label + ": query completed");
  return String(result.stdout ?? "").trim();
}
try {
  if (process.platform !== "win32") problem("Windows-native PG16 diagnostic only");
  if (!existsSync(home) || !existsSync(data) || !existsSync(pwfile)) {
    problem("expected incomplete native cluster or its retained bootstrap credential is missing");
  }
  if (existsSync(join(home, "owner.json")) || existsSync(join(root, ".env.test.local"))) {
    problem("this is not an incomplete first-run fixture; never inspect a configured database with this tool");
  }
  for (const pathname of [join(root, ".flytally"), home, data, pwfile]) verifyNoRedirect(pathname);
  if (readFileSync(join(data, "PG_VERSION"), "utf8").trim() !== "16") problem("unexpected PG major version");
  const pidFile = join(data, "postmaster.pid");
  if (!existsSync(pidFile)) problem("postmaster PID file missing");
  verifyNoRedirect(pidFile);
  // On Windows postmaster.pid may be written in the current ANSI code page
  // instead of UTF-8. Check exact path identity using both strict decodings.
  const pidBytes = readFileSync(pidFile);
  let pidOk = false;
  for (const encoding of ["utf-8", "windows-1250"]) {
    try {
      const pid = new TextDecoder(encoding, { fatal: true }).decode(pidBytes).split(/\r?\n/);
      if (/^[1-9]\d*$/.test(pid[0]) && isAbsolute(pid[1]) &&
          resolve(pid[1]).toLowerCase() === resolve(data).toLowerCase() &&
          pid[3] === port) { pidOk = true; break; }
    } catch { /* wrong encoding; try the other one */ }
  }
  if (!pidOk) problem("postmaster PID path/port does not match the dedicated fixture");
  const bin = nativePg16Tools();
  if (!bin) problem("verified PG16 client and server executables missing");
  const status = run(bin.pg_ctl, ["-D", data, "status"], process.env);
  if (status.error || status.status !== 0) problem("PG16 does not report its exact fixture as running");
  const password = readFileSync(pwfile, "utf8").trim();
  if (!/^[0-9a-f]{48}$/.test(password)) problem("invalid retained random bootstrap credential");
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^PG[A-Z0-9_]+$/i.test(key)) delete env[key];
  env.PGPASSWORD = password;
  env.PGCLIENTENCODING = "UTF8";
  env.PGCONNECT_TIMEOUT = "5";
  const query = sql => run(bin.psql, [
    "-X", "-w", "-qAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate",
    "-h", host, "-p", port, "-U", user, "-d", database, "-c", sql,
  ], env);
  console.log("[DIAG] Read-only local PG16 test fixture preflight PASS. No secrets or raw query output will be printed.");
  const smoke = outcome("SELECT 1", query("SELECT 1"));
  if (smoke === null || smoke !== "1") problem("cannot prove authenticated local connection");
  const core = outcome("identity fields without directory", query(
    "SELECT current_database() || '|' || current_user || '|' || host(inet_server_addr()) || '|' || inet_server_port()::text || '|' || current_setting('server_version_num')"));
  if (core === null) problem("core identity query failed");
  const mismatchedCoreFields = nativeCoreIdentityMismatches(core);
  if (mismatchedCoreFields.length) {
    problem("core database identity mismatch [" + mismatchedCoreFields.join(", ") +
      "]; no adoption or writes");
  }
  console.log("[DIAG] Core database/user/server address/port/version: PASS");
  const serverPidHex = outcome("server postmaster PID file (binary)", query(
    "SELECT encode(pg_catalog.pg_read_binary_file('postmaster.pid'), 'hex')"));
  if (serverPidHex === null) problem("server PID file binary read failed; inspect SQLSTATE only, do not retry setup");
  const full = outcome("full physical identity query", query(
    "SELECT current_database() || '|' || current_user || '|' || encode(pg_catalog.pg_read_binary_file('postmaster.pid'), 'hex') || '|' || host(inet_server_addr()) || '|' || inet_server_port()::text || '|' || current_setting('server_version_num')"));
  if (full === null) problem("full identity query failed; see SQLSTATE");
  const mismatches = nativeIdentityMismatches(full);
  if (mismatches.length) problem("physical identity mismatches: [" + mismatches.join(", ") + "]");
  console.log("[DIAG] Physical identity: PASS. Retained bootstrap credential is available.");
  console.log("[DIAG] READ-ONLY COMPLETE. No database or fixture files were modified.");
} catch (err) {
  console.error("[DIAG BLOCKED] " + (err instanceof Error ? err.message : "unknown error"));
  process.exitCode = 2;
}
