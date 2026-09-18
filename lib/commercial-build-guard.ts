import { assertCommercialLaunchEnabled } from "./commercial-readiness.ts";

type Env=Readonly<Record<string,string|undefined>>;

function productionBuild(env:Env):boolean{
  return env.NODE_ENV==="production"
    || env.VERCEL_ENV==="production"
    || env.VERCEL_TARGET_ENV==="production";
}

export function assertCommercialProductionBuildSafe(env:Env=process.env):void{
  const requestedStage=env.FLYTALLY_LAUNCH_STAGE?.trim().toLowerCase();
  if(!productionBuild(env)||requestedStage!=="commercial")return;
  assertCommercialLaunchEnabled(env);
}
