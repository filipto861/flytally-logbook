import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";

// Apply canonical v21 SQL only on the named disposable U3 browser database.
// The generic browser bootstrap and first Next request already applied v20.
// Runtime must never infer permission to create production v21 schema.
const env=process.env;
if(env.FLYTALLY_U3_SCHEMA_FIRST!=="1"){
  throw new Error("U3 schema-first requires explicit purpose flag.");
}
const databaseUrl=String(env.DATABASE_URL??"").trim();
let url;
try{url=new URL(databaseUrl);}catch{throw new Error("U3 fixture requires a valid DATABASE_URL.");}
if(env.FLYTALLY_AUTH_BROWSER!=="1"||env.FLYTALLY_LOCAL_POSTGRES!=="1"
  ||env.FLYTALLY_U3_SCHEMA_FIRST!=="1"
  ||env.VERCEL!==undefined||env.VERCEL_ENV!==undefined
  ||url.protocol!=="postgresql:"||url.hostname!=="127.0.0.1"
  ||url.port!=="55433"
  ||url.username!=="flytally_u3"||url.password!==""
  ||url.pathname!=="/flytally_ui_u3_20261021"
  ||process.argv.length!==2){
  throw new Error("U3 schema-first test refused: wrong purpose, host or disposable database.");
}
const plan=readFileSync(new URL("../lib/migration-plan.ts",import.meta.url),"utf8");
const runtime=readFileSync(new URL("../lib/db-optimization.ts",import.meta.url),"utf8");
const names=[...plan.matchAll(/\{version:(\d+),name:"([^"]+)"\}/g)]
  .map(m=>({version:Number(m[1]),name:m[2]}));
if(names.length!==21||names.some((item,index)=>item.version!==index+1)){
  throw new Error("U3 fixture migration plan changed; do not infer migration history.");
}
for(const version of [20,21]){
  if(!runtime.includes(`${version}:"${names[version-1].name}"`)){
    throw new Error(`Currency runtime registry name drift at v${version}.`);
  }
}
function statements(version,nextMarker){
  const marker=`if(version===${version})return[`;
  const start=runtime.indexOf(marker);
  const end=runtime.indexOf(nextMarker,start+marker.length);
  if(start<0||end<0)throw new Error(`Missing canonical v${version} SQL source.`);
  const section=runtime.slice(start+marker.length,end);
  if(!/^\s*sql`/.test(section)||!/\];\s*$/.test(section)){
    throw new Error(`Unexpected canonical v${version} SQL structure.`);
  }
  const blocks=[...section.matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]);
  if(blocks.length!==(version===20?39:9)||blocks.some(sql=>sql.includes("${"))){
    throw new Error(`U3 v${version} SQL blocks changed or contain interpolation.`);
  }
  // Runtime sends each sql`` as a separate statement. psql requires
  // a semicolon between them when assembled into one atomic script.
  return blocks.map(statement=>statement.trimEnd().replace(/;+$/,"")+";");
}
const v21=statements(21,"  throw new Error(`Unknown database migration");
const options=["-d",databaseUrl,"-X","-w","-v","ON_ERROR_STOP=1","-qAt"];
function psql(input){
  const result=spawnSync("psql",options,{input,encoding:"utf8",
    env:{...env,PGCONNECT_TIMEOUT:"5"},maxBuffer:8*1024*1024});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`Disposable U3 SQL failed: ${String(result.stderr||result.stdout).trim()}`);
  return String(result.stdout).trim();
}
const identity=psql("SELECT current_database()||'|'||current_user||'|'||host(inet_server_addr())||'|'||inet_server_port()");
if(identity!==`flytally_ui_u3_20261021|flytally_u3|127.0.0.1|55433`){
  throw new Error("U3 fixture server/database identity mismatch. No schema changes.");
}
const registered=psql("SELECT COALESCE(string_agg(version::text||':'||name,'|' ORDER BY version),'') FROM public.flytally_schema_migrations");
const expected=names.slice(0,20).map(row=>`${row.version}:${row.name}`).join("|");
if(registered!==expected){
  throw new Error("U3 fixture requires exact canonical registry v1-v20. No schema changes.");
}
const escapeLiteral=value=>`'${value.replaceAll("'","''")}'`;
const migrationSql=[
  "BEGIN;",
  "SELECT pg_advisory_xact_lock(704190104);",
  ...v21,
  `INSERT INTO public.flytally_schema_migrations(version,name) VALUES(21,${escapeLiteral(names[20].name)});`,
  "COMMIT;",
].join("\n");
psql(migrationSql);
const evidence=psql(`SELECT
  (SELECT COUNT(*) FROM public.flytally_schema_migrations WHERE version=21 AND name='source-backed currency exact-money')||'|'||
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND (
    (table_name='rates' AND column_name IN ('currency_code','currency_minor_units','price_per_hour_decimal','dry_price_per_hour_decimal')) OR
    (table_name='aircraft' AND column_name IN ('default_price_currency_code','default_price_currency_minor_units','default_price_per_hour_decimal')) OR
    (table_name='flights' AND column_name IN ('price_currency_code','price_currency_minor_units','price_per_hour_decimal')) OR
    (table_name='flight_expenses' AND column_name IN ('amount_encoding','amount_minor_units'))
  ))||'|'||
  (SELECT COUNT(*) FROM pg_constraint WHERE convalidated AND conname IN (
    'rates_exact_currency_tuple_v21_check','aircraft_exact_currency_tuple_v21_check',
    'flights_exact_currency_tuple_v21_check','expenses_amount_encoding_v21_check'))`);
if(evidence!=="1|12|4")throw new Error("Disposable v21 physical schema postcheck failed.");
console.log("Disposable U3 schema-first v21 only: registry 21, columns 12, CHECKs 4 PASS.");
