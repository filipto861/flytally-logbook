/**
 * Offline, review-gated import of a pinned ISO 4217 List One XML snapshot.
 * No network requests, fallback catalog, currency conversion or automatic updates.
 *
 * Regenerate/check:
 *   node tooling/generate-iso4217-registry.mjs --check
 *   node tooling/generate-iso4217-registry.mjs --write
 * Changes to the XML pin and generated rows require source/provenance review.
 */
import {createHash} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

export const SNAPSHOT_BLOB_SHA="1b8df1bec436592b955286d4e39c72518be9e444";
const snapshot=new URL("../data/iso4217/list-one-2026-09-17.xml",import.meta.url);
const output=new URL("../lib/iso4217-currency-data.ts",import.meta.url);
const SOURCE_PUBLICATION="2026-09-17";

const fail=reason=>{throw new Error("ISO 4217 registry generation blocked: "+reason)};
const content=(value,tag)=>value.match(new RegExp("<"+tag+">([^<]*)</"+tag+">"))?.[1]?.trim()??"";
const codeSort=(a,b)=>a.code<b.code?-1:a.code>b.code?1:0;

export function parseListOneXml(xml){
  if(typeof xml!=="string"||xml.length>2_000_000||/<!DOCTYPE|<!ENTITY/i.test(xml))fail("unsafe or invalid XML");
  const root=xml.match(/<ISO_4217 Pblshd="(\d{4}-\d{2}-\d{2})">/);
  if(!root||root[1]!==SOURCE_PUBLICATION||!xml.includes("</ISO_4217>"))fail("unexpected publication or root");
  const sourceEntries=[...xml.matchAll(/<CcyNtry>([\s\S]*?)<\/CcyNtry>/g)];
  if(sourceEntries.length<200||sourceEntries.length>400)fail("implausible number of source entries");
  const currencyByCode=new Map();
  const funds=new Set(),nonMonetary=new Set();
  let noCode=0;
  for(const [,entry] of sourceEntries){
    const nameTag=entry.match(/<CcyNm( IsFund="true")?>([^<]*)<\/CcyNm>/);
    if(!nameTag)fail("unrecognized currency name/fund classification");
    const name=nameTag[2].trim(),fund=Boolean(nameTag[1]),code=content(entry,"Ccy");
    if(!code){
      if(name!=="No universal currency")fail("unexpected missing ISO code");
      noCode++;continue;
    }
    if(!/^[A-Z]{3}$/.test(code)||!name||/&/.test(name))fail("invalid code/name or unhandled XML escape for "+code);
    const numeric=content(entry,"CcyNbr"),minorText=content(entry,"CcyMnrUnts");
    if(!/^\d{3}$/.test(numeric))fail("invalid numeric code for "+code);
    const knownMinor=/^[0-9]$/.test(minorText);
    if(!knownMinor&&minorText!=="N.A.")fail("unknown minor-unit descriptor for "+code);
    const record={code,name,numeric,minorUnits:knownMinor?Number(minorText):null,fund};
    const previous=currencyByCode.get(code);
    if(previous&&JSON.stringify(previous)!==JSON.stringify(record))fail("conflicting entity rows for "+code);
    currencyByCode.set(code,record);
    if(fund)funds.add(code);
    if(!knownMinor)nonMonetary.add(code);
  }
  const monetary=[...currencyByCode.values()].filter(item=>!item.fund&&item.minorUnits!==null).sort(codeSort);
  if(monetary.length<100||monetary.length>240||noCode<1||!funds.size||!nonMonetary.size)fail("unexpected classification cardinality");
  for(const code of ["JPY","EUR","KWD","XAF","XOF","XPF"]){
    if(!monetary.some(item=>item.code===code))fail("expected genuine monetary currency missing: "+code);
  }
  for(const code of ["XAU","XAG","XXX","XTS","XDR","BOV","XAD","CLF","UYW"]){
    if(monetary.some(item=>item.code===code))fail("special/fund code would enter monetary picker: "+code);
  }
  return{
    publishedAt:root[1],
    sourceRows:sourceEntries.length,
    distinctCodes:currencyByCode.size,
    monetary,
    excludedFunds:[...funds].sort(),
    excludedWithoutMinorUnits:[...nonMonetary].sort(),
    entriesWithoutCodes:noCode,
  };
}

export function renderRegistry(parsed){
  const rows=parsed.monetary.map(({code,name,numeric,minorUnits})=>[code,name,numeric,minorUnits]);
  return [
    "/** Generated from the pinned 2026-09-17 SIX List One XML mirror. DO NOT EDIT BY HAND.",
    " * The snapshot bytes were mirrored by a third party; independent download of SIX's current original remains a release gate.",
    " * Generator: tooling/generate-iso4217-registry.mjs. No runtime fetching or silent updates.",
    " */",
    "export const ISO4217_CURRENCY_SOURCE = Object.freeze("+JSON.stringify({
      publisher:"SIX Financial Information — ISO 4217 Maintenance Agency",
      standard:"ISO 4217 List One: Current Currency & Funds",
      publishedAt:parsed.publishedAt,
      officialUrl:"https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml",
      mirrorRepository:"faisalanjum/EventTrader",
      mirrorCommit:"5d22ac8d33afb1e118fd3d87b17c680b19cd5563",
      mirrorFile:"driver/reference_data/iso4217-list-one-2026-09-17.xml",
      sourceGitBlobSha1:SNAPSHOT_BLOB_SHA,
      verifiedDirectlyWithSIX:false,
      sourceRows:parsed.sourceRows,
      distinctSourceCodes:parsed.distinctCodes,
      eligibleMonetaryCodes:rows.length,
      excludedFunds:parsed.excludedFunds,
      excludedWithoutMinorUnits:parsed.excludedWithoutMinorUnits,
    },null,2)+");",
    "export const ISO4217_ACTIVE_MONETARY_ROWS = "+JSON.stringify(rows,null,2)+" as const;",
    "",
  ].join("\n");
}

export function verifySnapshotBytes(raw){
  const hash=createHash("sha1").update("blob "+Buffer.byteLength(raw,"utf8")+"\0"+raw).digest("hex");
  if(hash!==SNAPSHOT_BLOB_SHA)fail("pinned source blob has changed: "+hash);
  return hash;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const flags=process.argv.slice(2);
  if(flags.length!==1||!["--check","--write"].includes(flags[0]))fail("specify --check or --write");
  const xml=readFileSync(snapshot,"utf8");
  verifySnapshotBytes(xml);
  const parsed=parseListOneXml(xml);
  const generated=renderRegistry(parsed);
  if(flags[0]==="--write")writeFileSync(output,generated,"utf8");
  else if(readFileSync(output,"utf8").replace(/\r\n/g,"\n")!==generated)fail("generated registry is stale — review source and regenerate");
  console.log("ISO4217 "+flags[0]+" PASS: published="+parsed.publishedAt+" activeMonetary="+parsed.monetary.length+" fundExcluded="+parsed.excludedFunds.length+" noScaleExcluded="+parsed.excludedWithoutMinorUnits.length);
}
