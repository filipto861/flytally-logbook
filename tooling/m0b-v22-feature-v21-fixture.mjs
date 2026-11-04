#!/usr/bin/env node
// Print a richer disposable V21 feature fixture from the current browser
// bootstrap plus the exact original canonical v20/v21 migration statements.
// NEVER executes a command or emits destructive DROP SCHEMA/DB/TABLE.
// NOT guaranteed identical to all production feature-migration side effects.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const bootstrap=readFileSync(new URL("tooling/bootstrap-browser-smoke-db.mjs",root),"utf8");
const migrationPlan=readFileSync(new URL("lib/migration-plan.ts",root),"utf8");
const optimization=readFileSync(new URL("lib/db-optimization.ts",root),"utf8");
assert.match(migrationPlan,/DATABASE_SCHEMA_VERSION=21;/);
const names=[...migrationPlan.matchAll(/\{version:(\d+),name:"([^"]+)"\}/g)];
assert.equal(names.length,21);
const tick=String.fromCharCode(96);
const begin=bootstrap.indexOf("const sql="+tick+"\n");
const end=bootstrap.indexOf("\n"+tick+";\n\nconst result=spawnSync(",begin);
assert.ok(begin>=0&&end>begin,"Browser fixture SQL literal changed");
let sql=bootstrap.slice(begin+("const sql="+tick).length,end);
const token=String.fromCharCode(36)+"{";
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const k=bootstrap.indexOf("const featureKeys=[");
const featuresBlock=bootstrap.slice(k,bootstrap.indexOf("\n];",k));
assert.match(featuresBlock,/^const featureKeys=\[/);
const features=[...featuresBlock.matchAll(/"(v[^"]+)"/g)].map(x=>x[1]);
assert.ok(features.length>=14,"Feature migration keys changed");
const canonicalNames=names.slice(0,19).map((m,i)=>{
  assert.equal(Number(m[1]),i+1);
  return "("+m[1]+","+quote(m[2])+")";
});
function replaceBounded(start,endSuffix,replacement){
  const from=sql.indexOf(token+start);
  assert.ok(from>=0,"Expected browser expression missing: "+start);
  const to=sql.indexOf(endSuffix,from);
  assert.ok(to>from,"Expected browser expression end missing: "+start);
  sql=sql.slice(0,from)+replacement+sql.slice(to+endSuffix.length);
}
replaceBounded("preappliedMigrations.map(","};",canonicalNames.join(",\n")+";");
replaceBounded("featureKeys.map(","};",features.map(key=>"("+quote(key)+")").join(",\n")+";");
const passToken=token+"quote(passwordHash)}";
assert.equal(sql.split(passToken).length,3,"Expected two synthetic credential placeholders");
sql=sql.replaceAll(passToken,quote("synthetic-no-login-hash"));
assert.ok(!sql.includes(token),"Unrecognized browser fixture interpolation");
const destructive="DROP SCHEMA public CASCADE;\nCREATE SCHEMA public;";
assert.ok(sql.includes(destructive),"Browser bootstrap original schema reset changed");
const guard=[
"BEGIN;",
"DO $m0b_feature_guard$ BEGIN",
"IF current_database()<>'flytally_m0b_disposable_feature_v21'",
" OR current_user<>'flytally' OR coalesce(host(inet_server_addr()),'')<>'127.0.0.1'",
" OR current_setting('server_version_num')::integer NOT BETWEEN 160000 AND 169999",
" THEN RAISE EXCEPTION 'M0B full feature fixture requires exact disposable PG16 target'; END IF;",
"IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public'",
" AND table_type='BASE TABLE') THEN",
" RAISE EXCEPTION 'M0B full feature fixture refuses populated target'; END IF;",
"END $m0b_feature_guard$;"
].join("\n");
sql=sql.replace(destructive,guard);
assert.doesNotMatch(sql,/\bDROP\s+(?:TABLE|SCHEMA|DATABASE)\b/i);
const statements=[sql,"COMMIT;"];
const blocksRegex=new RegExp("sql"+tick+"([\\s\\S]*?)"+tick,"g");
for(let v=20;v<=21;v++){
  const a=optimization.indexOf("if(version==="+v+")return[");
  const b=optimization.indexOf("\n  ];",a);
  assert.ok(a>=0&&b>a,"Missing source migration v"+v);
  const blocks=[...optimization.slice(a,b).matchAll(blocksRegex)].map(x=>x[1]);
  assert.ok(blocks.length>=5&&blocks.every(x=>!x.includes(token)),
    "Unexpected SQL shape v"+v);
  statements.push("BEGIN;","SELECT pg_advisory_xact_lock(704190104);",
    ...blocks.map(x=>x+";"),
    "INSERT INTO public.flytally_schema_migrations(version,name) VALUES("+
      v+","+quote(names[v-1][2])+");","COMMIT;");
}
statements.push([
"DO $m0b_check$ BEGIN",
"IF (SELECT count(*) FROM public.flytally_schema_migrations)<>21",
" OR (SELECT count(*) FROM public.flytally_feature_migrations)<14",
" OR to_regclass('public.flight_participations') IS NULL",
" OR to_regclass('public.flight_verifications') IS NULL",
" OR to_regclass('public.flight_expenses') IS NULL",
" OR to_regclass('public.flight_source_provenance') IS NULL",
" OR to_regclass('public.voided_certified_flights') IS NULL",
" THEN RAISE EXCEPTION 'M0B V21 application feature fixture incomplete'; END IF;",
"END $m0b_check$;"
].join("\n"));
process.stdout.write(statements.join("\n")+"\n");
