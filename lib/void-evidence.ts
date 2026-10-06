import { createHash } from "node:crypto";

function canonical(value:unknown):string{
  if(value===null)return"null";
  if(Array.isArray(value))return`[${value.map(canonical).join(",")}]`;
  if(typeof value==="object"){
    return`{${Object.entries(value as Record<string,unknown>)
      .sort(([left],[right])=>left.localeCompare(right))
      .map(([key,item])=>`${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  }
  const encoded=JSON.stringify(value);
  return encoded===undefined?"null":encoded;
}

export function voidEvidenceSha256(value:unknown){
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function asEvidenceObject(value:unknown):Record<string,unknown>{
  if(value&&typeof value==="object"&&!Array.isArray(value))return value as Record<string,unknown>;
  throw new Error("Void evidence row is not an object.");
}
