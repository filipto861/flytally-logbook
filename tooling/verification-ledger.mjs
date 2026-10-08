import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { repositoryRoot } from "./verification-candidate.mjs";

export const verificationLedgerRoot=path.join(repositoryRoot,".flytally","verification");

function safeCandidateId(candidateId){
  const value=String(candidateId??"");
  if(!/^[a-f0-9]{64}$/.test(value))throw new Error("Invalid verification candidate id.");
  return value;
}

export function verificationLedgerPath(candidateId,gate){
  const id=safeCandidateId(candidateId);
  const gateName=String(gate??"").trim();
  if(!/^[a-z0-9-]+$/.test(gateName))throw new Error("Invalid verification gate name.");
  return path.join(verificationLedgerRoot,id,gateName+".json");
}

export function verificationArtifactPath(candidateId,name){
  const id=safeCandidateId(candidateId);
  const file=String(name??"").trim();
  if(!/^[A-Za-z0-9._-]+$/.test(file))throw new Error("Invalid verification artifact name.");
  const dir=path.join(verificationLedgerRoot,id);
  mkdirSync(dir,{recursive:true});
  return path.join(dir,file);
}

export function writeVerificationLedgerEntry(entry){
  if(!entry?.candidate?.candidateId)throw new Error("Ledger entry requires candidate identity.");
  if(!entry?.gate)throw new Error("Ledger entry requires a gate.");
  const target=verificationLedgerPath(entry.candidate.candidateId,entry.gate);
  mkdirSync(path.dirname(target),{recursive:true});
  const payload={
    schemaVersion:1,
    recordedAt:new Date().toISOString(),
    ...entry,
    candidate:{
      schemaVersion:entry.candidate.schemaVersion,
      candidateId:entry.candidate.candidateId,
      headSha:entry.candidate.headSha,
      baseSha:entry.candidate.baseSha??null,
      filesHash:entry.candidate.filesHash,
      source:entry.candidate.source,
      files:entry.candidate.files,
    },
  };
  const temp=target+".tmp-"+process.pid;
  writeFileSync(temp,JSON.stringify(payload,null,2)+"\n","utf8");
  rmSync(target,{force:true});
  renameSync(temp,target);
  return payload;
}

export function readVerificationLedgerEntry(candidateId,gate){
  const target=verificationLedgerPath(candidateId,gate);
  if(!existsSync(target))return null;
  const payload=JSON.parse(readFileSync(target,"utf8"));
  if(payload?.candidate?.candidateId!==candidateId||payload?.gate!==gate){
    throw new Error("Verification ledger entry identity mismatch.");
  }
  return payload;
}

function hashBuildManifests(){
  const candidates=[
    ".next/build-manifest.json",
    ".next/app-build-manifest.json",
    ".next/prerender-manifest.json",
    ".next/server/app-paths-manifest.json",
  ];
  const present=candidates.filter((file)=>existsSync(path.join(repositoryRoot,file)));
  if(present.length===0)throw new Error("No Next.js production build identity is available.");
  const hash=createHash("sha256");
  for(const file of present.sort()){
    hash.update(file);
    hash.update("\0");
    hash.update(readFileSync(path.join(repositoryRoot,file)));
    hash.update("\0");
  }
  return {kind:"next-manifest-sha256",value:hash.digest("hex"),files:present.sort()};
}

export function currentBuildIdentity(){
  const buildIdPath=path.join(repositoryRoot,".next","BUILD_ID");
  if(existsSync(buildIdPath)){
    const value=readFileSync(buildIdPath,"utf8").trim();
    if(value)return {kind:"next-build-id",value};
  }
  return hashBuildManifests();
}

export function buildIdentityMatches(left,right){
  return Boolean(left&&right&&left.kind===right.kind&&left.value===right.value);
}
