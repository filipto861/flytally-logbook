import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { probePostgresConnection } from "./postgres-cli.mjs";

// The CLI purpose is explicit. Missing flag must stop BEFORE fixture bootstrap.
// Never infer permission for currency v21 DDL from a generic browser test.
const playwrightArgs=process.argv.slice(2);
const currencyIntent=playwrightArgs[0]==="--currency-v21";
if(currencyIntent){
  if(playwrightArgs.length!==2||playwrightArgs[1]!=="e2e/trash-integrity.spec.mjs"){
    console.error("Currency browser needs exactly its dedicated E2E spec.");process.exit(2);
  }
  if(process.env.FLYTALLY_CURRENCY_V21_BROWSER!=="1"
    ||process.env.FLYTALLY_AUTH_BROWSER!=="1"
    ||process.env.FLYTALLY_LOCAL_POSTGRES!=="1"
    ||process.env.VERCEL!==undefined||process.env.VERCEL_ENV!==undefined){
    console.error("Currency browser purpose/hosting flags missing or invalid in Node harness. No bootstrap.");
    process.exit(2);
  }
}else if(process.env.FLYTALLY_CURRENCY_V21_BROWSER==="1"){
  console.error("Currency browser purpose flag requires explicit --currency-v21 CLI intent.");
  process.exit(2);
}
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

if(currencyIntent){
  if(parsedDatabaseUrl.protocol!=="postgresql:"
    ||parsedDatabaseUrl.hostname!=="127.0.0.1"
    ||parsedDatabaseUrl.pathname!=="/flytally_currency_test"
    ||parsedDatabaseUrl.username!=="flytally"
    ||parsedDatabaseUrl.password!==""
    ||parsedDatabaseUrl.port===""
    ||parsedDatabaseUrl.port==="5432"
    ||parsedDatabaseUrl.port==="55432"){
    console.error("Currency browser URL is not the dedicated disposable fixture. No bootstrap.");
    process.exit(2);
  }
  console.log("Currency browser pre-bootstrap purpose and database URL checks PASS.");
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

// Only explicitly opted-in Currency browser acceptance may use the verified
// disposable localhost fixture for runtime v20/v21 schema initialization.
if(currencyIntent){
  if(parsedDatabaseUrl.hostname!=="127.0.0.1" ||
     parsedDatabaseUrl.pathname!=="/flytally_currency_test" ||
     process.env.FLYTALLY_AUTH_BROWSER!=="1" ||
     process.env.FLYTALLY_LOCAL_POSTGRES!=="1"){
    throw new Error("Currency v21 browser SQL requires the named disposable localhost fixture.");
  }
  // Rehearse the production schema-first sequence on this disposable DB only.
  // Apply exact canonical v20 and v21 SQL plus their registry rows atomically,
  // before Next starts. The application runtime must validate, not authorize DDL.
  const schemaFirst=fileURLToPath(new URL("./apply-currency-v21-disposable.mjs",import.meta.url));
  const schemaResult=spawnSync(process.execPath,[schemaFirst],{stdio:"inherit",env:browserEnv});
  if(schemaResult.error)throw schemaResult.error;
  if(schemaResult.status!==0)process.exit(schemaResult.status??1);
  console.log("Disposable Currency browser fixture passed schema-first v20/v21 migration.");
}

const require=createRequire(import.meta.url);
const playwrightPackage=require.resolve("@playwright/test/package.json");
const playwrightCli=join(dirname(playwrightPackage),"cli.js");
const browserResult=spawnSync(process.execPath,[playwrightCli,"test","--config=playwright.config.mjs",...(currencyIntent?playwrightArgs.slice(1):playwrightArgs)],{stdio:"inherit",env:browserEnv});
if(browserResult.error)throw browserResult.error;
if(browserResult.status===0&&currencyIntent){
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
    throw new Error("Currency browser schema-first v21 registry/column/constraint postcheck failed.");
  }
  console.log("Verified disposable currency browser schema-first v21: 1 registry, 12 columns, 4 CHECKs.");
}
process.exit(browserResult.status??1);
