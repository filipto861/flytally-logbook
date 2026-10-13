import { spawnSync } from "node:child_process";

// D3b-0 explicit manual gate. Existing *applied* full-v20 disposable DB only.
// This command intentionally DOES NOT bootstrap, migrate, drop or reset anything.
// A SKIP is never a PASS. Exit nonzero for any missing identity/PG catalog.
const url = process.env.DATABASE_URL;
if (process.env.FLYTALLY_D3B_FULL_V20_DISPOSABLE !== "1" || !url) {
  throw new Error("D3b native PG16 requires explicit disposable flag and DATABASE_URL.");
}
const u = new URL(url);
if (u.protocol !== "postgresql:" || u.hostname !== "127.0.0.1" ||
    u.username !== "flytally" || u.password || u.pathname !== "/flytally_currency_test" ||
    u.search || u.hash || !Number.isInteger(Number(u.port)) ||
    Number(u.port) <= 1024 || [5432, 55432].includes(Number(u.port))) {
  throw new Error("Unsafe D3b database identity. No tests executed.");
}
const env = {...process.env, PGCONNECT_TIMEOUT:"5"};
for (const key of Object.keys(env)) if (key.startsWith("PG") && key !== "PGCONNECT_TIMEOUT") delete env[key];
const probe = spawnSync("psql", ["-X","-w","-qAt","-v","ON_ERROR_STOP=1","-d",url,
  "-c","SELECT current_database()||'|'||current_user||'|'||host(inet_server_addr())||'|'||inet_server_port()||'|'||current_setting('server_version_num')"],
  {env, encoding:"utf8",timeout:12000});
if (probe.error) throw probe.error;
const expected = "flytally_currency_test|flytally|127.0.0.1|" + Number(u.port) + "|";
if (probe.status !== 0 || !probe.stdout.startsWith(expected) ||
    !/^16[0-9]{4}$/.test(probe.stdout.trim().slice(expected.length))) {
  throw new Error("D3b target identity / PostgreSQL 16 verification failed. No tests executed.");
}
const cases = [
  "tests/integration/v380-d3b-full-v20-catalog.test.ts",
  "tests/integration/v380-d3b-zero-delete-counterexample.test.ts",
];
for (const file of cases) {
  const test = spawnSync(process.execPath,[
    "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
    "--test","--experimental-strip-types",file
  ],{env,stdio:"inherit"});
  if (test.error) throw test.error;
  if (test.status !== 0) throw new Error("D3b gate failed in " + file + ", exit " + test.status);
}
console.log("D3b preliminary native catalog + SQL counterexample gates passed; TWO-SESSION AND APPLICATION RACE TESTS NOT RUN.");
