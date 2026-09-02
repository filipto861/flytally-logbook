import "server-only";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { ensureV132Schema } from "@/lib/v132-schema";
import { ensureV1353Schema } from "@/lib/v1353-schema";
import { ensureV144Schema } from "@/lib/v144-schema";
import { ensureV145Schema } from "@/lib/v145-schema";
import { ensureV148Schema } from "@/lib/v148-schema";
import { ensureV151Schema } from "@/lib/v151-schema";
import { ensureV159Schema } from "@/lib/v159-schema";
import { ensureV162Schema } from "@/lib/v162-schema";
import { ensureV163Schema } from "@/lib/v163-schema";

declare global{
  // eslint-disable-next-line no-var
  var __logbookRuntimeSchema:Promise<void>|undefined;
}

async function applyRuntimeSchema(){
  // Base migrations own the dependency graph. Compatibility and feature
  // schemas can then initialize in parallel instead of adding cold-start latency.
  await ensureDatabaseOptimizations();
  await Promise.all([ensureV132Schema(),ensureV1353Schema(),ensureV144Schema(),ensureV145Schema(),ensureV148Schema(),ensureV151Schema(),ensureV159Schema(),ensureV162Schema(),ensureV163Schema()]);
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
