import { createHash } from "node:crypto";
import { canonicalEvidenceJson } from "@/lib/canonical-evidence";

export function voidEvidenceSha256(value:unknown){
  return createHash("sha256").update(canonicalEvidenceJson(value)).digest("hex");
}

export function asEvidenceObject(value:unknown):Record<string,unknown>{
  if(value&&typeof value==="object"&&!Array.isArray(value))return value as Record<string,unknown>;
  throw new Error("Void evidence row is not an object.");
}
