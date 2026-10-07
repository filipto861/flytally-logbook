import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if(process.env.FLYTALLY_AUTH_BROWSER!=="1"){
  console.error("FLYTALLY_AUTH_BROWSER=1 is required for authenticated browser acceptance. The browser gate did not run.");
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
