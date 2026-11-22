import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parseLocalDatabaseUrl, selectPostgresTests } from "../tooling/run-postgres-tests.mjs";

const browserRunner = fileURLToPath(new URL("../tooling/run-auth-browser.mjs", import.meta.url));
const postgresRunner = fileURLToPath(new URL("../tooling/run-postgres-tests.mjs", import.meta.url));

test("PostgreSQL runner only accepts localhost targets", () => {
  assert.throws(() => parseLocalDatabaseUrl(""), /DATABASE_URL is required/);
  assert.throws(() => parseLocalDatabaseUrl("not a url"), /valid PostgreSQL URL/);
  assert.throws(
    () => parseLocalDatabaseUrl("postgresql://u:p@ep-example.eu-central-1.aws.neon.tech/neondb"),
    /only target localhost/,
  );
  assert.equal(parseLocalDatabaseUrl("postgresql://flytally@127.0.0.1:55441/x").hostname, "127.0.0.1");
});

test("PostgreSQL runner refuses a remote database before connecting", () => {
  const result = spawnSync(process.execPath, [postgresRunner, "core"], {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: "postgresql://u:p@db.example.com/prod" },
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /only target localhost/);
});

test("PostgreSQL test selection separates core and scale suites", () => {
  const core = selectPostgresTests("core");
  const scale = selectPostgresTests("scale");
  const full = selectPostgresTests("full");
  assert.ok(core.length > 0 && scale.length > 0);
  assert.equal(core.length + scale.length, full.length);
  assert.ok(scale.every((name) => !core.includes(name)));
  assert.throws(() => selectPostgresTests("everything"), /Unknown PostgreSQL test mode/);
  assert.throws(() => selectPostgresTests("core", ["missing.test.ts"]), /Unknown integration test file/);
});

test("browser runner refuses anything but a 127.0.0.1 database before resetting it", () => {
  for (const url of ["", "postgresql://u:p@db.example.com/prod", "postgresql://flytally@localhost:55441/x"]) {
    const result = spawnSync(process.execPath, [browserRunner], {
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: url },
    });
    assert.equal(result.status, 2, url);
    assert.match(result.stderr, /did not run|only run on 127\.0\.0\.1/);
  }
});

test("cookSql turns extracted template SQL into the string PostgreSQL actually receives",async()=>{
  const { cookSql } = await import("./integration/production-sql.ts");
  // Source text of: sql`... ~'^\\d{4}-\\d{2}' ... \`x\` ... \${y}`
  const raw=String.raw`date::text~'^\\d{4}-\\d{2}' AND a=\`x\` AND b='\${y}'`;
  assert.equal(cookSql(raw),"date::text~'^\\d{4}-\\d{2}' AND a=`x` AND b='${y}'");
  // SQL without escapes is unchanged.
  assert.equal(cookSql("SELECT 1 WHERE user_id=${userId}"),"SELECT 1 WHERE user_id=${userId}");
});
