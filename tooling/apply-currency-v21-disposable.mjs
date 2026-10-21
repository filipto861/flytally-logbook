import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";

// Explicit schema-first rehearsal, exclusively for the throwaway Currency browser DB.
// The normal Next runtime must never create production v21 schema implicitly.
const env=process.env;
const databaseUrl=String(env.DATABASE_URL??"").trim();
let url;
try{url=new URL(databaseUrl);}catch{throw new Error("Currency fixture requires a valid DATABASE_URL.");}
// Keep the original Currency contract unchanged. U0 adds a *separate*, exact,
// unprivileged owner-created fixture; there is no generic DB override.
const uiAuditV21Intent=process.argv.length===3&&process.argv[2]==="--ui-audit-v21";
// Preserve the existing no-Vercel gate for both test purposes.
if(env.VERCEL!==undefined||env.VERCEL_ENV!==undefined){
  throw new Error("Schema-first fixture cannot run under deployment environment.");
}
const shared=env.FLYTALLY_AUTH_BROWSER==="1"&&env.FLYTALLY_LOCAL_POSTGRES==="1"
  &&env.VERCEL===undefined&&env.VERCEL_ENV===undefined
  &&url.protocol==="postgresql:"&&url.hostname==="127.0.0.1";
const currencyAllowed=process.argv.length===2
  &&env.FLYTALLY_CURRENCY_V21_BROWSER==="1"
  &&!!url.port&&!["5432","55432"].includes(url.port)
  &&url.username==="flytally"&&url.password===""
  &&url.pathname==="/flytally_currency_test";
const uiAuditAllowed=uiAuditV21Intent
  &&env.FLYTALLY_UI_AUDIT_V21==="1"&&env.FLYTALLY_UI_AUDIT_CAPTURE==="1"
  &&env.FLYTALLY_CURRENCY_V21_BROWSER!=="1"&&env.FLYTALLY_V21_RISK_BROWSER!=="1"
  &&url.port==="5433"
  &&url.username==="flytally_ui_u0_20261021"&&url.password!==""
  &&url.pathname==="/flytally_ui_u0_20261021"&&url.search===""&&url.hash==="";
if(!shared||(!currencyAllowed&&!uiAuditAllowed)){
  throw new Error("Canonical schema-first test refused: wrong purpose, host or disposable database.");
}
const plan=readFileSync(new URL("../lib/migration-plan.ts",import.meta.url),"utf8");
const runtime=readFileSync(new URL("../lib/db-optimization.ts",import.meta.url),"utf8");
const names=[...plan.matchAll(/\{version:(\d+),name:"([^"]+)"\}/g)]
  .map(m=>({version:Number(m[1]),name:m[2]}));
if(names.length!==21||names.some((item,index)=>item.version!==index+1)){
  throw new Error("Currency fixture migration plan changed; do not infer migration history.");
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
    throw new Error(`Currency v${version} SQL blocks changed or contain interpolation.`);
  }
  // Runtime sends each sql`` as a separate statement. psql requires
  // a semicolon between them when assembled into one atomic script.
  return blocks.map(statement=>statement.trimEnd().replace(/;+$/,"")+";");
}
const v20=statements(20,"if(version===21)return[");
const v21=statements(21,"  throw new Error(`Unknown database migration");
const options=["-d",databaseUrl,"-X","-w","-v","ON_ERROR_STOP=1","-qAt"];
function psql(input){
  const result=spawnSync("psql",options,{input,encoding:"utf8",
    env:{...env,PGCONNECT_TIMEOUT:"5"},maxBuffer:8*1024*1024});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`Disposable currency SQL failed: ${String(result.stderr||result.stdout).trim()}`);
  return String(result.stdout).trim();
}
const identity=psql("SELECT current_database()||'|'||current_user||'|'||host(inet_server_addr())||'|'||inet_server_port()");
const expectedIdentity=uiAuditV21Intent
  ?`flytally_ui_u0_20261021|flytally_ui_u0_20261021|127.0.0.1|5433`
  :`flytally_currency_test|flytally|127.0.0.1|${url.port}`;
if(identity!==expectedIdentity){
  throw new Error("Currency fixture server/database identity mismatch. No schema changes.");
}
if(uiAuditV21Intent){
  const owner=psql("SELECT pg_get_userbyid((SELECT datdba FROM pg_database WHERE datname=current_database()))||'|'||rolsuper||'|'||rolcreatedb FROM pg_roles WHERE rolname=current_user");
  if(owner!=="flytally_ui_u0_20261021|false|false"){
    throw new Error("U0 disposable DB owner or privilege identity changed. No migration.");
  }
}
const registered=psql("SELECT COALESCE(string_agg(version::text||':'||name,'|' ORDER BY version),'') FROM public.flytally_schema_migrations");
const expected=names.slice(0,19).map(row=>`${row.version}:${row.name}`).join("|");
if(registered!==expected){
  throw new Error("Currency fixture requires exact canonical registry v1-v19. No schema changes.");
}
const escapeLiteral=value=>`'${value.replaceAll("'","''")}'`;
const migrationSql=[
  "BEGIN;",
  "SELECT pg_advisory_xact_lock(704190104);",
  ...v20,
  `INSERT INTO public.flytally_schema_migrations(version,name) VALUES(20,${escapeLiteral(names[19].name)});`,
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
console.log("Disposable Currency schema-first v20/v21: registry 21, columns 12, CHECKs 4 PASS.");
