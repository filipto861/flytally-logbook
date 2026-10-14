import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { probePostgresConnection } from "./postgres-cli.mjs";

if(process.env.FLYTALLY_AUTH_BROWSER!=="1"||process.env.FLYTALLY_LOCAL_POSTGRES!=="1"){
  console.error("FLYTALLY_AUTH_BROWSER=1 and FLYTALLY_LOCAL_POSTGRES=1 are required for authenticated browser acceptance. The browser gate did not run.");
  process.exit(2);
}

const databaseUrl=String(process.env.DATABASE_URL??"").trim();
if(!databaseUrl){
  console.error("DATABASE_URL is required for authenticated browser acceptance. The browser gate did not run.");
  process.exit(2);
}

let parsedDatabaseUrl;
try{
  parsedDatabaseUrl=new URL(databaseUrl);
}catch{
  console.error("Authenticated browser acceptance requires a valid DATABASE_URL. The browser gate did not run.");
  process.exit(2);
}
if(!new Set(["127.0.0.1","localhost","::1","[::1]"]).has(parsedDatabaseUrl.hostname)){
  console.error(`Authenticated browser acceptance may only reset a localhost PostgreSQL fixture; got host ${parsedDatabaseUrl.hostname}. The browser gate did not run.`);
  process.exit(2);
}

let browserEnv;
try{
  browserEnv=probePostgresConnection(databaseUrl,{
    env:process.env,
    label:"Authenticated browser acceptance",
    failureSuffix:"The browser gate did not run.",
  });
}catch(error){
  console.error(error instanceof Error?error.message:String(error));
  process.exit(2);
}

const bootstrap=fileURLToPath(new URL("./bootstrap-browser-smoke-db.mjs",import.meta.url));
const bootstrapResult=spawnSync(process.execPath,[bootstrap],{stdio:"inherit",env:browserEnv});
if(bootstrapResult.error)throw bootstrapResult.error;
if(bootstrapResult.status!==0)process.exit(bootstrapResult.status??1);

// Only the explicitly opted-in Currency 3.8.0 browser runner may upgrade
// its already-bootstrapped disposable fixture. Never register v21 in runtime.
if(process.env.FLYTALLY_CURRENCY_V21_BROWSER==="1"){
  if(parsedDatabaseUrl.hostname!=="127.0.0.1" ||
     parsedDatabaseUrl.pathname!=="/flytally_currency_test" ||
     process.env.FLYTALLY_AUTH_BROWSER!=="1" ||
     process.env.FLYTALLY_LOCAL_POSTGRES!=="1"){
    throw new Error("Currency v21 browser SQL requires the named disposable localhost fixture.");
  }
  // Do not pre-apply review-only DDL without its registry row. The running app
  // will apply v20 then v21 atomically using its localhost-only guarded path.
  console.log("Disposable Currency browser fixture is ready for guarded runtime v20/v21 migration.");
}

const require=createRequire(import.meta.url);
const playwrightPackage=require.resolve("@playwright/test/package.json");
const playwrightCli=join(dirname(playwrightPackage),"cli.js");
const browserResult=spawnSync(process.execPath,[playwrightCli,"test","--config=playwright.config.mjs",...process.argv.slice(2)],{stdio:"inherit",env:browserEnv});
if(browserResult.error)throw browserResult.error;
if(browserResult.status===0&&process.env.FLYTALLY_CURRENCY_V21_BROWSER==="1"){
  // Browser actions exercised the application against a disposable localhost DB.
  // Independently verify that the runtime finished the complete v21 migration.
  const evidenceQuery=`SELECT (SELECT COUNT(*) FROM public.flytally_schema_migrations
    WHERE version=21 AND name='source-backed currency exact-money'),
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND (
      (table_name='rates' AND column_name IN ('currency_code','currency_minor_units','price_per_hour_decimal','dry_price_per_hour_decimal'))
      OR (table_name='aircraft' AND column_name IN ('default_price_currency_code','default_price_currency_minor_units','default_price_per_hour_decimal'))
      OR (table_name='flights' AND column_name IN ('price_currency_code','price_currency_minor_units','price_per_hour_decimal'))
      OR (table_name='flight_expenses' AND column_name IN ('amount_encoding','amount_minor_units'))
    )),
    (SELECT COUNT(*) FROM pg_constraint WHERE conname IN (
      'rates_exact_currency_tuple_v21_check','aircraft_exact_currency_tuple_v21_check',
      'flights_exact_currency_tuple_v21_check','expenses_amount_encoding_v21_check'
    ))`;
  const observed=spawnSync("psql",["-d",databaseUrl,"-X","-w","-v","ON_ERROR_STOP=1","-At","-F","|","-c",evidenceQuery],{
    encoding:"utf8",env:browserEnv,
  });
  if(observed.error)throw observed.error;
  if(observed.status!==0||String(observed.stdout).trim()!=="1|12|4"){
    throw new Error("Currency browser runtime v21 registry/column/constraint postcheck failed.");
  }
  console.log("Verified disposable currency browser runtime v21: 1 registry, 12 columns, 4 CHECKs.");
}
process.exit(browserResult.status??1);
