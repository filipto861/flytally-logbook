import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {test} from "node:test";
import {portableBackupRequiredSections,type PortableBackup} from "../lib/portable-backup.ts";
import {
  AccountBackupPreSignError,
  validateAccountBackupBeforeSigning,
} from "../lib/account-backup-presign.ts";

type Payload=Omit<PortableBackup,"integrity">;
const userId=9001;
const emptyPayload=():Payload=>{
  const sections=Object.fromEntries(portableBackupRequiredSections(13).map(key=>[key,[]]));
  const counts=Object.fromEntries(portableBackupRequiredSections(13).map(key=>[key,0]));
  return {
    ...sections,
    format:"pilot-logbook-portable",
    version:13,
    schema_version:21,
    exported_at:"2026-10-29T18:00:00.000Z",
    profile:{id:userId},
    counts,
  } as unknown as Payload;
};
const withRow=(payload:Payload,section:keyof Payload,row:Record<string,unknown>)=>{
  const rows=payload[section] as Record<string,unknown>[];
  rows.push(row);
  payload.counts[String(section)]=rows.length;
};
const rejected=async(payload:Payload,code:AccountBackupPreSignError["code"]="UNRESTORABLE_SOURCE")=>{
  await assert.rejects(validateAccountBackupBeforeSigning(payload,userId),
    error=>error instanceof AccountBackupPreSignError&&error.code===code);
};

test("DATA-1C: empty v13 backup uses existing parser/restore validation and legacy-null evidence",async()=>{
  const current=emptyPayload();
  assert.equal(Object.prototype.hasOwnProperty.call(current,"track_points"),false);
  await validateAccountBackupBeforeSigning(current,userId);
  assert.equal(Object.prototype.hasOwnProperty.call(current,"track_points"),false);
  const legacy=emptyPayload();
  withRow(legacy,"rates",{id:17,user_id:userId,registration:"OK-TEST",
    currency_code:null,currency_minor_units:null,price_per_hour_decimal:null});
  await validateAccountBackupBeforeSigning(legacy,userId);
});

test("DATA-1C: missing section, inconsistent declared count and wrong owner are refused before signing",async()=>{
  const missing=emptyPayload();
  delete (missing as unknown as Record<string,unknown>).flight_tracks;
  await rejected(missing);
  const count=emptyPayload();
  count.counts.flights=1;
  await rejected(count);
  const owner=emptyPayload();
  withRow(owner,"pilot_licences",{id:1,user_id:5432});
  await rejected(owner);
  await assert.rejects(validateAccountBackupBeforeSigning(emptyPayload(),0),
    error=>error instanceof AccountBackupPreSignError&&error.code==="UNRESTORABLE_SOURCE");
});

test("DATA-1C: orphan GPS/expense and incomplete certification chains fail closed",async()=>{
  const orphan=emptyPayload();
  withRow(orphan,"flight_tracks",{id:8,user_id:userId,flight_id:123});
  await rejected(orphan);
  const expense=emptyPayload();
  withRow(expense,"flight_expenses",{id:1,user_id:userId,flight_id:123});
  await rejected(expense);
  const revision=emptyPayload();
  withRow(revision,"flights",{id:123,user_id:userId,record_revision:2,certified_at:null,certification_hash:""});
  await rejected(revision);
});

test("DATA-1C: invalid protected void evidence and partial exact-money evidence are refused",async()=>{
  const voided=emptyPayload();
  withRow(voided,"voided_certified_flights",{id:6,user_id:userId,original_flight_id:123,
    record_revision:1,flight_snapshot:{id:999,user_id:userId}});
  await rejected(voided);
  const money=emptyPayload();
  withRow(money,"rates",{id:1,user_id:userId,currency_code:"EUR",currency_minor_units:2,
    price_per_hour_decimal:"broken",price_per_hour:5});
  await rejected(money);
});

test("DATA-1C: source builder must validate the actual payload before digest or signature",()=>{
  const source=fs.readFileSync(path.resolve(import.meta.dirname,"../lib/account-backup.ts"),"utf8");
  const validation=source.indexOf("await validateAccountBackupBeforeSigning(payload,userId)");
  const hash=source.indexOf("const digest=await portableBackupDigest");
  const signature=source.indexOf("signPortableBackup(payload.version,userId,digest)");
  assert.ok(validation>=0&&hash>validation&&signature>hash);
});
