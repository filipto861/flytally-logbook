import { createHash } from "node:crypto";
import { existsSync,readFileSync } from "node:fs";
import path from "node:path";
import { repositoryRoot } from "./verification-candidate.mjs";

function hashEntries(entries){
  const hash=createHash("sha256");
  for(const entry of entries){
    hash.update(entry.name);
    hash.update("\0");
    hash.update(entry.value);
    hash.update("\0");
  }
  return hash.digest("hex");
}

function fileEntries(files){
  return [...new Set(files)].sort().map((file)=>{
    const absolute=path.join(repositoryRoot,...file.split("/"));
    if(!existsSync(absolute))return {name:file,value:"MISSING"};
    return {name:file,value:createHash("sha256").update(readFileSync(absolute)).digest("hex")};
  });
}

export function verificationConfigIdentity(){
  const files=[
    "tooling/development-modules.json",
    "tooling/development-modules.schema.json",
    "tooling/verify-plan.mjs",
    "tooling/verification-candidate.mjs",
    "tooling/verification-identity.mjs",
    "tooling/browser-risk-selection.mjs",
    "tooling/development-scope.mjs",
    "tooling/evidence-contract.mjs",
    "playwright.config.mjs",
    "tooling/browser-suite-baseline.json",
  ];
  const entries=fileEntries(files);
  return {kind:"verification-config-v1",hash:hashEntries(entries),files:entries};
}

export function browserFixtureContractIdentity(){
  const files=[
    "tooling/bootstrap-browser-smoke-db.mjs",
    "e2e/browser-db.mjs",
  ];
  const entries=fileEntries(files);
  return {kind:"browser-fixture-contract-v1",hash:hashEntries(entries),files:entries};
}

export function declaredToolchainIdentity(){
  const pkg=JSON.parse(readFileSync(path.join(repositoryRoot,"package.json"),"utf8"));
  const lockPath=path.join(repositoryRoot,"package-lock.json");
  const values={
    nodeRuntime:process.version,
    nodeEngine:String(pkg.engines?.node??""),
    next:String(pkg.dependencies?.next??""),
    playwright:String(pkg.devDependencies?.["@playwright/test"]??""),
    typescript:String(pkg.devDependencies?.typescript??""),
    packageLockSha256:existsSync(lockPath)?createHash("sha256").update(readFileSync(lockPath)).digest("hex"):"MISSING",
  };
  const hash=hashEntries(Object.entries(values).sort(([a],[b])=>a.localeCompare(b)).map(([name,value])=>({name,value})));
  return {kind:"declared-toolchain-v1",hash,...values};
}
