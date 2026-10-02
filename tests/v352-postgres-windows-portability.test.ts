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
  let explicitDatabaseSelections=0;
  for(const file of psqlSources){
    const source=fs.readFileSync(file,"utf8");
    assert.doesNotMatch(
      source,
      /spawnSync\("psql",\s*\[\s*(?:databaseUrl(?:\(\))?|localDatabaseUrl\(\))\s*,/,
      `${path.relative(root,file)} passes the connection string as the first positional psql argument`,
    );
    explicitDatabaseSelections+=(source.match(/spawnSync\("psql",\s*\[\s*"-d",\s*(?:databaseUrl(?:\(\))?|localDatabaseUrl\(\))/g)??[]).length;
  }
  assert.ok(explicitDatabaseSelections>=psqlSources.length,"Expected every PostgreSQL harness source to use explicit -d selection");
});
