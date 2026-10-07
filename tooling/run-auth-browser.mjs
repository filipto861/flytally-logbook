import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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

const probe=spawnSync("psql",["-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-Atqc","SELECT 1"],{
  encoding:"utf8",
  env:{...process.env,PGCONNECT_TIMEOUT:process.env.PGCONNECT_TIMEOUT||"5"},
});
if(probe.error){
  console.error(`Authenticated browser acceptance requires the psql client: ${probe.error.message}`);
  process.exit(2);
}
if(probe.status!==0||probe.stdout.trim()!=="1"){
  console.error(`Authenticated browser acceptance could not connect to DATABASE_URL. The browser gate did not run. ${probe.stderr||probe.stdout}`);
  process.exit(2);
}

const bootstrap=fileURLToPath(new URL("./bootstrap-browser-smoke-db.mjs",import.meta.url));
const bootstrapResult=spawnSync(process.execPath,[bootstrap],{stdio:"inherit",env:process.env});
if(bootstrapResult.error)throw bootstrapResult.error;
if(bootstrapResult.status!==0)process.exit(bootstrapResult.status??1);

const command=process.platform==="win32"?"npx.cmd":"npx";
const browserResult=spawnSync(command,["--no-install","playwright","test","--config=playwright.config.mjs",...process.argv.slice(2)],{stdio:"inherit",env:process.env});
if(browserResult.error)throw browserResult.error;
process.exit(browserResult.status??1);
