// PR340: build real optimizer v1..v20 catalog in the runner-owned empty public PG16 DB.
// Uses canonical lib/db-optimization.ts migration statements, not version stamping.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const root=new URL("../",import.meta.url);
const url=process.env.DATABASE_URL??"";
const u=new URL(url);
assert.equal(u.protocol,"postgresql:");
assert.equal(u.hostname,"127.0.0.1");
assert.equal(u.username,"flytally");
assert.equal(u.password,"");
assert.equal(u.pathname,"/flytally_currency_test");
assert.equal(u.search,"");
assert.equal(u.hash,"");
assert.ok(Number(u.port)>1024&&![5432,55432].includes(Number(u.port)));
assert.equal(process.env.FLYTALLY_D3B_FULL_V20_DISPOSABLE,"1");
function run(sql){
  const env={...process.env,PGCONNECT_TIMEOUT:"5"};
  for(const k of Object.keys(env))if(k.startsWith("PG")&&k!=="PGCONNECT_TIMEOUT")delete env[k];
  const r=spawnSync("psql",["-X","-w","-qAt","-v","ON_ERROR_STOP=1","-d",url],{input:sql,env,encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
  if(r.error)throw r.error;
  assert.equal(r.status,0,"v20 bootstrap SQL failed: "+String(r.stderr).slice(0,800));
  return String(r.stdout).trim();
}
const ident=run("SELECT current_database()||'|'||current_user||'|'||host(inet_server_addr())||'|'||inet_server_port()||'|'||current_setting('server_version_num');");
assert.deepEqual(ident.split("|").slice(0,4),["flytally_currency_test","flytally","127.0.0.1",u.port]);
assert.match(ident.split("|")[4],/^16[0-9]{4}$/);
// Fail closed unless this runner's newly initialized database is empty.
assert.equal(run("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f');"),"0","public must be empty");
const base=[
"CREATE TABLE flytally_schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
"CREATE TABLE users(id BIGINT PRIMARY KEY,email TEXT NOT NULL)",
"CREATE TABLE flights(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id),date TEXT NOT NULL,evidence TEXT NOT NULL DEFAULT '',registration TEXT NOT NULL DEFAULT '',aircraft_type TEXT NOT NULL DEFAULT '',aircraft_class TEXT NOT NULL DEFAULT '',departure TEXT NOT NULL DEFAULT '',arrival TEXT NOT NULL DEFAULT '',off_block TEXT NOT NULL DEFAULT '',on_block TEXT NOT NULL DEFAULT '',starts INTEGER NOT NULL DEFAULT 0,role TEXT NOT NULL DEFAULT '',instructor TEXT NOT NULL DEFAULT '')",
"CREATE TABLE aircraft(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id),registration TEXT NOT NULL,aircraft_type TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1)",
"CREATE TABLE airports(ident TEXT NOT NULL,user_id BIGINT NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1)",
"CREATE TABLE rates(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,registration TEXT NOT NULL,valid_from TEXT)",
"CREATE TABLE user_expiries(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,active INTEGER NOT NULL DEFAULT 1,expiry_date DATE NOT NULL)",
"CREATE TABLE flight_tracks(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,flight_id BIGINT NOT NULL,file_name TEXT NOT NULL DEFAULT '',point_count INTEGER NOT NULL DEFAULT 0,start_utc TIMESTAMPTZ)",
"CREATE TABLE track_points(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,track_id BIGINT NOT NULL)",
"INSERT INTO users(id,email) VALUES(9001,'source@example.test'),(9002,'participant@example.test')"];
run("BEGIN;\n"+base.join(";\n")+";\nCOMMIT;");
const text=readFileSync(new URL("lib/db-optimization.ts",root),"utf8");
const start=text.indexOf("const migrationNames:");
const end=text.indexOf("const migrationQueries=",start);
assert.ok(start>=0&&end>start);
const names=new Map([...text.slice(start,end).matchAll(/([0-9]+):"([^"]+)"/g)].map(x=>[Number(x[1]),x[2]]));
assert.equal(names.size,21);
assert.equal(names.get(21),"source-backed currency exact-money");
const tick=String.fromCharCode(96);
const re=new RegExp("sql"+tick+"([\\s\\S]*?)"+tick,"g");
const quote=s=>"'"+s.replaceAll("'","''")+"'";
for(let v=1;v<=20;v++){
  const a=text.indexOf("if(version==="+v+")return[");
  const b=text.indexOf("  ];",a);
  assert.ok(a>=0&&b>a,"Missing actual migration "+v);
  const statements=[...text.slice(a,b).matchAll(re)].map(x=>x[1]);
  assert.ok(statements.length>=2,"Migration statements incomplete "+v);
  assert.ok(!statements.some(x=>x.includes("${")||/\bpublic\./i.test(x)),"Non-static or public schema SQL in migration "+v);
  run("BEGIN;\nSET LOCAL search_path TO public,pg_catalog;\nSELECT pg_advisory_xact_lock(704190104);\n"+statements.join(";\n")+";\nINSERT INTO flytally_schema_migrations(version,name) VALUES("+v+","+quote(names.get(v))+");\nCOMMIT;");
}
assert.equal(run("SELECT COUNT(*) FROM public.flytally_schema_migrations WHERE version BETWEEN 1 AND 20"),"20");
assert.equal(run("SELECT COUNT(*) FROM public.flytally_schema_migrations WHERE version>20"),"0");
console.log("real_v20_catalog_bootstrap=PASS migrations=20 target=owned-localhost-PG16 schema=public release_status=NOT RUN");
