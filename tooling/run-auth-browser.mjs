import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { probePostgresConnection } from "./postgres-cli.mjs";

// The CLI purpose is explicit. Missing flag must stop BEFORE fixture bootstrap.
// Never infer permission for currency v21 DDL from a generic browser test.
const playwrightArgs=process.argv.slice(2);
const currencyIntent=playwrightArgs[0]==="--currency-v21";
const riskCurrencyIntent=playwrightArgs[0]==="--currency-v21-risk";
// Exact opt-in for the already owner-created, local, unprivileged U0 test DB.
// Never relax the older Currency v21 test fixture's identity or CLI contract.
const uiAuditV21Intent=playwrightArgs[0]==="--ui-audit-v21";
const uiAuditV21Flag=process.env.FLYTALLY_UI_AUDIT_V21==="1";
const schemaFirstIntent=currencyIntent||riskCurrencyIntent||uiAuditV21Intent;
if(uiAuditV21Intent){
  const args=playwrightArgs.slice(1);
  if(!uiAuditV21Flag
    ||process.env.FLYTALLY_UI_AUDIT_CAPTURE!=="1"
    ||process.env.FLYTALLY_CURRENCY_V21_BROWSER==="1"
    ||process.env.FLYTALLY_V21_RISK_BROWSER==="1"
    ||process.env.VERCEL!==undefined||process.env.VERCEL_ENV!==undefined
    ||args.length!==4
    ||args[0]!=="e2e/ui-audit-capture.spec.mjs"
    ||args[1]!=="--project=desktop-chromium"
    ||args[2]!=="--retries=0"
    ||args[3]!=="--workers=1"){
    console.error("U0 schema-first audit requires its exact test, options and isolated purpose flags. No bootstrap.");
    process.exit(2);
  }
}else if(uiAuditV21Flag){
  console.error("U0 schema-first purpose requires explicit --ui-audit-v21 intent. No bootstrap.");
  process.exit(2);
}
if(riskCurrencyIntent){
  const specs=playwrightArgs.slice(1).filter(value=>!value.startsWith("--"));
  const argumentsAllowed=playwrightArgs.slice(1).every(value=>
    /^e2e\/[a-z0-9._-]+\.spec\.mjs$/i.test(value)
    || /^--project=(desktop-chromium|mobile-chromium)$/.test(value)
    || value.startsWith("--grep=")
    || value==="--retries=0"
    || value==="--workers=1");
  if(process.env.FLYTALLY_V21_RISK_BROWSER!=="1"
    || !process.env.FLYTALLY_BROWSER_EVIDENCE_FILE
    || specs.length===0
    || !specs.every(value=>/^e2e\/[a-z0-9._-]+\.spec\.mjs$/i.test(value))
    || !playwrightArgs.some(value=>/^--project=(desktop-chromium|mobile-chromium)$/.test(value))
    || !playwrightArgs.some(value=>value.startsWith("--grep="))
    || !playwrightArgs.includes("--retries=0")
    || !playwrightArgs.includes("--workers=1")
    || !argumentsAllowed){
    console.error("Currency v21 risk browser requires bounded Playwright targets and isolated purpose flags. No bootstrap.");
    process.exit(2);
  }
}else if(process.env.FLYTALLY_V21_RISK_BROWSER==="1"){
  console.error("Currency v21 risk purpose requires explicit --currency-v21-risk intent. No bootstrap.");
  process.exit(2);
}
if(schemaFirstIntent){
  if(currencyIntent&&(playwrightArgs.length!==2||playwrightArgs[1]!=="e2e/trash-integrity.spec.mjs")){
    console.error("Currency browser needs exactly its dedicated E2E spec.");process.exit(2);
  }
  if(uiAuditV21Intent){
    if(process.env.FLYTALLY_AUTH_BROWSER!=="1"
      ||process.env.FLYTALLY_LOCAL_POSTGRES!=="1"
      ||process.env.VERCEL!==undefined||process.env.VERCEL_ENV!==undefined){
      console.error("U0 schema-first browser hosting flags missing or invalid. No bootstrap.");
      process.exit(2);
    }
  }else if(process.env.FLYTALLY_CURRENCY_V21_BROWSER!=="1"
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

if(schemaFirstIntent){
  if(uiAuditV21Intent){
    if(parsedDatabaseUrl.protocol!=="postgresql:"
      ||parsedDatabaseUrl.hostname!=="127.0.0.1"
      ||parsedDatabaseUrl.port!=="5433"
      ||parsedDatabaseUrl.pathname!=="/flytally_ui_u0_20261021"
      ||parsedDatabaseUrl.username!=="flytally_ui_u0_20261021"
      ||parsedDatabaseUrl.password===""
      ||parsedDatabaseUrl.search!==""||parsedDatabaseUrl.hash!==""){
      console.error("U0 browser URL is not the exact disposable fixture. No bootstrap.");
      process.exit(2);
    }
    console.log("U0 browser pre-bootstrap purpose and database URL checks PASS.");
  }else{
    // Original Currency acceptance guard: intentionally unchanged.
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

// Verify effective database identity/ownership BEFORE the fixture executes
// DROP SCHEMA public CASCADE. URL shape and a successful login are insufficient.
if(uiAuditV21Intent){
  const identity=spawnSync("psql",[
    "-d",databaseUrl,"-X","-w","-v","ON_ERROR_STOP=1","-At","-F","|","-c",
    "SELECT current_user,current_database(),pg_get_userbyid((SELECT datdba FROM pg_database WHERE datname=current_database())),rolsuper,rolcreatedb FROM pg_roles WHERE rolname=current_user",
  ],{encoding:"utf8",env:browserEnv});
  if(identity.error||identity.status!==0||
    String(identity.stdout).trim()!=="flytally_ui_u0_20261021|flytally_ui_u0_20261021|flytally_ui_u0_20261021|f|f"){
    console.error("U0 database effective owner, identity or privilege check failed. No bootstrap.");
    process.exit(2);
  }
  console.log("U0 audit DB owner, identity and privilege preflight PASS.");
}
const bootstrap=fileURLToPath(new URL("./bootstrap-browser-smoke-db.mjs",import.meta.url));
const bootstrapResult=spawnSync(process.execPath,[bootstrap],{stdio:"inherit",env:browserEnv});
if(bootstrapResult.error)throw bootstrapResult.error;
if(bootstrapResult.status!==0)process.exit(bootstrapResult.status??1);

// Only explicit, identity-checked schema-first acceptance may apply canonical
// v20/v21 SQL to the verified disposable localhost fixture.
if(schemaFirstIntent){
  if(parsedDatabaseUrl.hostname!=="127.0.0.1" ||
     parsedDatabaseUrl.pathname!==(uiAuditV21Intent?"/flytally_ui_u0_20261021":"/flytally_currency_test") ||
     process.env.FLYTALLY_AUTH_BROWSER!=="1" ||
     process.env.FLYTALLY_LOCAL_POSTGRES!=="1"){
    throw new Error("Schema-first v21 SQL requires the named disposable localhost fixture.");
  }
  // Rehearse the production schema-first sequence on this disposable DB only.
  // Apply exact canonical v20 and v21 SQL plus their registry rows atomically,
  // before Next starts. The application runtime must validate, not authorize DDL.
  const schemaFirst=fileURLToPath(new URL("./apply-currency-v21-disposable.mjs",import.meta.url));
  const schemaResult=spawnSync(process.execPath,[schemaFirst,...(uiAuditV21Intent?["--ui-audit-v21"]:[])],{stdio:"inherit",env:browserEnv});
  if(schemaResult.error)throw schemaResult.error;
  if(schemaResult.status!==0)process.exit(schemaResult.status??1);
  console.log("Disposable Currency browser fixture passed schema-first v20/v21 migration.");
}

const require=createRequire(import.meta.url);
const playwrightPackage=require.resolve("@playwright/test/package.json");
const playwrightCli=join(dirname(playwrightPackage),"cli.js");
const browserResult=spawnSync(process.execPath,[playwrightCli,"test","--config=playwright.config.mjs",...(schemaFirstIntent?playwrightArgs.slice(1):playwrightArgs)],{stdio:"inherit",env:browserEnv});
if(browserResult.error)throw browserResult.error;
if(browserResult.status===0&&schemaFirstIntent){
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
