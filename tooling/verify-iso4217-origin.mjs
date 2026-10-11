/**
 * Verify whether a user-supplied ISO 4217 List One XML file matches our pinned mirror.
 * Offline/read-only by design. A byte match is NOT proof of its download origin:
 * preserve the official download URL/source chain separately in review evidence.
 *
 * Example (manually download from the official SIX List One XML link first):
 * node tooling/verify-iso4217-origin.mjs --official /path/to/list-one.xml
 *
 * Exit 0 ONLY on byte-identical XML; exit 2 for mismatch/invalid input.
 * Never updates the repo catalog, metadata or a database.
 */
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const PINNED_PATH=fileURLToPath(new URL("../data/iso4217/list-one-2026-09-17.xml",import.meta.url));
export const PINNED_GIT_BLOB_SHA1="1b8df1bec436592b955286d4e39c72518be9e444";
export const EXPECTED_PUBLICATION="2026-09-17";
export const OFFICIAL_SOURCE_URL="https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml";
const MAX_BYTES=2_000_000;

export function sha256(bytes){
  return createHash("sha256").update(bytes).digest("hex");
}
export function gitBlobSha1(bytes){
  return createHash("sha1").update(`blob ${bytes.byteLength}\0`).update(bytes).digest("hex");
}
export function xmlPublication(bytes){
  if(!(bytes instanceof Uint8Array)||bytes.byteLength===0||bytes.byteLength>MAX_BYTES)return null;
  const value=Buffer.from(bytes).toString("utf8");
  if(/<!DOCTYPE|<!ENTITY/i.test(value))return null;
  const found=[...value.matchAll(/<ISO_4217\s+Pblshd="(\d{4}-\d\d-\d\d)"\s*>/g)];
  if(found.length!==1||!value.includes("<CcyTbl>")||!value.includes("</CcyTbl>")||!value.includes("</ISO_4217>"))return null;
  return found[0][1];
}
export function compareIso4217Snapshots(candidate,pinned){
  const candidateDate=xmlPublication(candidate);
  const pinnedDate=xmlPublication(pinned);
  const candidateSha256=sha256(candidate);
  const pinnedSha256=sha256(pinned);
  if(!candidateDate||!pinnedDate)return {status:"invalid-xml",candidateDate,pinnedDate,candidateSha256,pinnedSha256};
  if(pinnedDate!==EXPECTED_PUBLICATION||gitBlobSha1(pinned)!==PINNED_GIT_BLOB_SHA1)
    return {status:"invalid-pin",candidateDate,pinnedDate,candidateSha256,pinnedSha256};
  if(candidateDate!==pinnedDate)return {status:"different-publication",candidateDate,pinnedDate,candidateSha256,pinnedSha256};
  if(candidateSha256!==pinnedSha256||!Buffer.from(candidate).equals(Buffer.from(pinned)))
    return {status:"different-content",candidateDate,pinnedDate,candidateSha256,pinnedSha256};
  return {status:"byte-identical",candidateDate,pinnedDate,candidateSha256,pinnedSha256};
}

const isMain=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=="--official"||!args[1]){
    console.error("Usage: node tooling/verify-iso4217-origin.mjs --official /path/to/official/list-one.xml");
    process.exitCode=2;
  }else{
    try{
      // The tool cannot prove where this file was downloaded from; operator must
      // document official SIX URL, retrieval date and source verification.
      const supplied=readFileSync(resolve(args[1])),pinned=readFileSync(PINNED_PATH);
      const result=compareIso4217Snapshots(supplied,pinned);
      console.log(JSON.stringify({
        ...result,sourceUrlToVerifyManually:OFFICIAL_SOURCE_URL,
        sourceOriginAuthenticatedByThisScript:false,
        productionRegistryApproval:false
      },null,2));
      if(result.status!=="byte-identical")process.exitCode=2;
    }catch(error){
      console.error("ISO4217 origin verification unavailable:",error instanceof Error?error.message:String(error));
      process.exitCode=2;
    }
  }
}
