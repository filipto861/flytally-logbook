// Loads real server modules (lib/*, app/*) inside an integration test process, against the
// disposable local PostgreSQL that the runner provides. "@/..." resolves to the repository,
// "server-only" is a no-op, and lib/db.ts talks to PostgreSQL through lib/local-postgres.ts.
//
// The full production-like schema comes from the same scripts the browser suite uses:
// tooling/bootstrap-browser-smoke-db.mjs (v1..v19 plus feature tables and fixture users)
// and tooling/apply-currency-v21-disposable.mjs (v20 and v21, schema-first).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root=path.resolve(import.meta.dirname,"../..");
let hooked=false;

function useServerModules(){
  if(hooked)return;
  hooked=true;
  registerHooks({
    resolve(specifier,context,next){
      if(specifier==="server-only")return{url:"data:text/javascript,export%20%7B%7D",shortCircuit:true};
      if(specifier.startsWith("@/")){
        const base=path.join(root,specifier.slice(2));
        for(const candidate of [base+".ts",base+".tsx",path.join(base,"index.ts")]){
          if(existsSync(candidate))return next(pathToFileURL(candidate).href,context);
        }
      }
      return next(specifier,context);
    },
  });
}

/** Rebuilds the runner's disposable database as the full production-like schema (v21). */
export function bootstrapProductionSchema(){
  const env={...process.env,FLYTALLY_AUTH_BROWSER:"1",FLYTALLY_LOCAL_POSTGRES:"1",FLYTALLY_CURRENCY_V21_BROWSER:"1"};
  for(const script of ["bootstrap-browser-smoke-db.mjs","apply-currency-v21-disposable.mjs"]){
    const result=spawnSync(process.execPath,[path.join(root,"tooling",script)],{encoding:"utf8",env});
    assert.equal(result.status,0,`${script} failed:\n${result.stderr||result.stdout}`);
  }
}

/** Imports a repository module (for example "lib/account-backup.ts") with its real dependencies. */
export async function importServerModule<T=Record<string,unknown>>(file:string):Promise<T>{
  process.env.FLYTALLY_LOCAL_POSTGRES="1";
  useServerModules();
  return await import(pathToFileURL(path.join(root,file)).href) as T;
}
