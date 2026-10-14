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
  const candidate=readFileSync(fileURLToPath(new URL("../sql/drafts/3_8_0_currency_v21_additive_candidate.sql",import.meta.url)),"utf8");
  const migrated=spawnSync("psql",["-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-q"],{
    input:candidate,encoding:"utf8",stdio:["pipe","inherit","inherit"],env:browserEnv,
  });
  if(migrated.error)throw migrated.error;
  if(migrated.status!==0)process.exit(migrated.status??1);
  console.log("Disposable Currency browser fixture v21 candidate applied; production unchanged.");
}

const require=createRequire(import.meta.url);
const playwrightPackage=require.resolve("@playwright/test/package.json");
const playwrightCli=join(dirname(playwrightPackage),"cli.js");
const browserResult=spawnSync(process.execPath,[playwrightCli,"test","--config=playwright.config.mjs",...process.argv.slice(2)],{stdio:"inherit",env:browserEnv});
if(browserResult.error)throw browserResult.error;
process.exit(browserResult.status??1);
