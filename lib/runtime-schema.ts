import "server-only";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { ensureV132Schema } from "@/lib/v132-schema";
import { ensureV1353Schema } from "@/lib/v1353-schema";

declare global{
  // eslint-disable-next-line no-var
  var __logbookRuntimeSchema:Promise<void>|undefined;
}

async function applyRuntimeSchema(){
  // Base migrations own the dependency graph. Compatibility schemas can then
  // initialize in parallel instead of adding sequential cold-start latency.
  await ensureDatabaseOptimizations();
  await Promise.all([ensureV132Schema(),ensureV1353Schema()]);
}

export function ensureRuntimeSchema(){
  if(!globalThis.__logbookRuntimeSchema){
    globalThis.__logbookRuntimeSchema=applyRuntimeSchema().catch(error=>{
      globalThis.__logbookRuntimeSchema=undefined;
      throw error;
    });
  }
  return globalThis.__logbookRuntimeSchema;
}
