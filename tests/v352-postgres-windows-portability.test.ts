import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const integrationDir=path.join(root,"tests","integration");
const postgresIntegrationFiles=fs.readdirSync(integrationDir)
  .filter(name=>name.startsWith("postgres-")&&name.endsWith(".test.ts"))
  .map(name=>path.join(integrationDir,name));

const psqlSources=[
  ...postgresIntegrationFiles,
  path.join(root,"lib","local-postgres.ts"),
  path.join(root,"tooling","bootstrap-browser-smoke-db.mjs"),
  path.join(root,"e2e","browser-db.mjs"),
];

test("PostgreSQL subprocess calls keep connection strings behind explicit -d for Windows portability",()=>{
  let checkedCalls=0;
  for(const file of psqlSources){
    const source=fs.readFileSync(file,"utf8");
    const calls=[...source.matchAll(/\b(?:spawnSync|spawn)\(\s*["']psql["']\s*,/g)];
    // Inspect every literal psql argv array: -d is valid anywhere in argv,
    // including after -X/-w/-qAt flags in isolated native PG16 tests.
    // A dynamic argv expression must be reviewed rather than silently skipped.
    const invocations=[...source.matchAll(/\b(?:spawnSync|spawn)\(\s*["']psql["']\s*,\s*\[([\s\S]*?)\]\s*,\s*\{/g)];
    assert.equal(invocations.length,calls.length,
      path.relative(root,file)+" has an unreviewed psql subprocess argument form");
    for(const match of invocations){
      const args=match[1];
      // A standalone psql version probe does not select or open a database.
      if(/^\s*["']--version["']\s*$/.test(args))continue;
      assert.match(args,/(?:^|,)\s*["']-d["']\s*,\s*[A-Za-z_$][\w$]*(?:\(\))?\s*(?:,|$)/,
        path.relative(root,file)+" must select a database through explicit -d");
      assert.doesNotMatch(args,/(?:^|,)\s*(?:databaseUrl(?:\(\))?|localDatabaseUrl\(\)|url)\s*,/,
        path.relative(root,file)+" must not pass database URL as a positional argument");
      assert.doesNotMatch(args,/(?:^|,)\s*["']-c["']\s*,\s*(?:statement|sql)\s*(?:,|$)/,
        path.relative(root,file)+" must pass SQL through stdin, not -c command-line text");
      checkedCalls++;
    }
  }
  assert.ok(checkedCalls>0,"At least one real PostgreSQL subprocess must be checked");
});
