import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
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

const command=process.platform==="win32"?"npx.cmd":"npx";
const browserResult=spawnSync(command,["--no-install","playwright","test","--config=playwright.config.mjs",...process.argv.slice(2)],{stdio:"inherit",env:browserEnv});
if(browserResult.error)throw browserResult.error;
process.exit(browserResult.status??1);
