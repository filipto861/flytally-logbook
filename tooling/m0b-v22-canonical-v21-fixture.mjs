#!/usr/bin/env node
// Print source-exact V1..V21 migrations; NEVER connects to any database.
// Only pipe to a positively identified, freshly empty local disposable PG16.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const db=readFileSync(new URL("lib/db-optimization.ts",root),"utf8");
const plan=readFileSync(new URL("lib/migration-plan.ts",root),"utf8");
assert.match(plan,/DATABASE_SCHEMA_VERSION=21;/);
const names=[...plan.matchAll(/\{version:(\d+),name:"([^"]+)"\}/g)];
assert.equal(names.length,21);
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const sql=[
"BEGIN;",
"DO $guard$ BEGIN IF current_database() !~ '^flytally_m0b_disposable_[a-z0-9_]+$'",
" OR current_user<>'flytally' OR coalesce(host(inet_server_addr()),'')<>'127.0.0.1'",
" OR current_setting('server_version_num')::int NOT BETWEEN 160000 AND 169999 THEN",
" RAISE EXCEPTION 'M0B V21 fixture requires disposable loopback PG16'; END IF;",
"IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') THEN",
" RAISE EXCEPTION 'M0B V21 fixture refuses a populated target'; END IF; END $guard$;",
"CREATE TABLE public.flytally_schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());",
"CREATE TABLE public.users(id BIGINT PRIMARY KEY,email TEXT NOT NULL);",
"CREATE TABLE public.flights(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES public.users(id),date TEXT NOT NULL,evidence TEXT NOT NULL DEFAULT '',registration TEXT NOT NULL DEFAULT '',aircraft_type TEXT NOT NULL DEFAULT '',aircraft_class TEXT NOT NULL DEFAULT '',departure TEXT NOT NULL DEFAULT '',arrival TEXT NOT NULL DEFAULT '',off_block TEXT NOT NULL DEFAULT '',on_block TEXT NOT NULL DEFAULT '',starts INTEGER NOT NULL DEFAULT 0,role TEXT NOT NULL DEFAULT '',instructor TEXT NOT NULL DEFAULT '');",
"CREATE TABLE public.aircraft(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES public.users(id),registration TEXT NOT NULL,aircraft_type TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1);",
"CREATE TABLE public.airports(ident TEXT NOT NULL,user_id BIGINT NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1);",
"CREATE TABLE public.rates(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,registration TEXT NOT NULL,valid_from TEXT);",
"CREATE TABLE public.user_expiries(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,active INTEGER NOT NULL DEFAULT 1,expiry_date DATE NOT NULL);",
"CREATE TABLE public.flight_tracks(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,flight_id BIGINT NOT NULL,file_name TEXT NOT NULL DEFAULT '',point_count INTEGER NOT NULL DEFAULT 0,start_utc TIMESTAMPTZ);",
"CREATE TABLE public.track_points(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,track_id BIGINT NOT NULL);",
"INSERT INTO public.users(id,email) VALUES(9001,'synthetic-a@example.test'),(9002,'synthetic-b@example.test');",
"COMMIT;"
];
const tick=String.fromCharCode(96);
const pattern=new RegExp("sql"+tick+"([\\s\\S]*?)"+tick,"g");
for(let v=1;v<=21;v++){
  assert.equal(Number(names[v-1][1]),v);
  const a=db.indexOf("if(version==="+v+")return[");
  const b=db.indexOf("\n  ];",a);
  assert.ok(a>=0&&b>a,"Missing canonical migration "+v);
  const blocks=[...db.slice(a,b).matchAll(pattern)].map(x=>x[1]);
  assert.ok(blocks.length>=2,"Incomplete migration "+v);
  assert.ok(!blocks.some(x=>x.includes("$"+"{")||x.includes("\u0000")),
    "Dynamic SQL unavailable for safe extraction "+v);
  sql.push("BEGIN;","SELECT pg_advisory_xact_lock(704190104);");
  for(const query of blocks)sql.push(query+";");
  sql.push("INSERT INTO public.flytally_schema_migrations(version,name) VALUES("+
    v+","+quote(names[v-1][2])+");","COMMIT;");
}
sql.push("DO $verify$ BEGIN IF (SELECT count(*) FROM public.flytally_schema_migrations)<>21",
" OR NOT EXISTS(SELECT 1 FROM public.flytally_schema_migrations",
" WHERE version=21 AND name='source-backed currency exact-money') THEN",
" RAISE EXCEPTION 'M0B source V21 migrations incomplete'; END IF; END $verify$;");
process.stdout.write(sql.join("\n")+"\n");
