import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { test } from "node:test";

(globalThis as any).__m0calls = { auth: 0, sql: 0, storedLoads: 0, fileReads: 0, backups: 0, trash: 0, revalidates: 0 };
const c = (globalThis as any).__m0calls as Record<string,number>;
const mock: Record<string,string> = {
  "next/cache": 'export function revalidatePath(){ globalThis.__m0calls.revalidates++; }',
  "@/lib/auth/require-user": 'export async function requireUser(){globalThis.__m0calls.auth++;return {userId:42};}',
  "@/lib/db": 'export function sql(){globalThis.__m0calls.sql++;throw Error("Unexpected SQL execution");}sql.transaction=async()=>{globalThis.__m0calls.sql++;throw Error("Unexpected transaction");};',
  "@/lib/portable-backup": 'export const flightRestoreKey=()=>"";export const trackRestoreKey=()=>"";export const parsePortableBackup=()=>{globalThis.__m0calls.fileReads++;return {backup:{version:13},digest:"fake"};};export const backupContainsExactMonetaryData=()=>false;export const validateBackupMonetaryEvidence=()=>{};export const validateVoidHistoryRelationships=()=>{};',
  "@/lib/backup-center": 'export async function createStoredBackup(){globalThis.__m0calls.backups++;return {}; }export async function loadStoredBackup(){globalThis.__m0calls.storedLoads++;throw Error("unexpected load");}',
  "@/lib/flight-trash": 'export async function restoreDeletedFlightRecord(){globalThis.__m0calls.trash++;return {flightId:7}};',
  "@/lib/recovery-conflict": 'export class AccountRestoreConflictError extends Error{};export const archivedCertificationConflict=()=>{};export const currentCertificationConflict=()=>{};export const protectedHistoryConflict=()=>{};export const recordIdentityConflict=()=>{};',
  "@/lib/backup-authenticity": 'export const portableBackupAuthenticity=()=>"verified";export const SERVER_AUTHORITATIVE_BACKUP_SECTIONS=[];',
  "@/lib/backup-certification": 'export const validateBackupCertificationHistory=()=>({certifiedFlights:0,flightRevisions:0,certifiedFstd:0,fstdRevisions:0});',
  "@/lib/db-optimization": 'export const ensureDatabaseOptimizations=async()=>{};',
  "@/lib/v162-schema":'export const ensureV162Schema=async()=>{};',
  "@/lib/v163-schema":'export const ensureV163Schema=async()=>{};',
  "@/lib/v164-schema":'export const ensureV164Schema=async()=>{};',
  "@/lib/v165-schema":'export const ensureV165Schema=async()=>{};',
  "@/lib/v166-schema":'export const ensureV166Schema=async()=>{};',
  "@/lib/recovery-scale":'export const EXACT_RESTORE_STATEMENT_LIMIT=5000;export const RESTORE_BATCH_SIZES={};',
  "server-only": "export {};"
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/account-restore-containment") {
      return nextResolve(pathToFileURL(resolve("lib/account-restore-containment.ts")).href, context);
    }
    if (specifier === "@/lib/account-restore-v6") {
      return nextResolve(pathToFileURL(resolve("lib/account-restore-v6.ts")).href, context);
    }
    if (Object.hasOwn(mock,specifier)) {
      return { url:"data:text/javascript,"+encodeURIComponent(mock[specifier]),shortCircuit:true };
    }
    return nextResolve(specifier,context);
  }
});
const action = await import(pathToFileURL(resolve("app/(protected)/export/actions.ts")).href);
const svc = await import(pathToFileURL(resolve("lib/account-restore-v6.ts")).href);
const { ACCOUNT_RESTORE_UNAVAILABLE_MESSAGE: m } = await import(pathToFileURL(resolve("lib/account-restore-containment.ts")).href);
const state = () => ({...c});
function assertNoMutation(before: Record<string,number>,after: Record<string,number>) {
  assert.equal(after.sql,before.sql,"zero SQL");
  assert.equal(after.storedLoads,before.storedLoads,"zero stored reads for write intent");
  assert.equal(after.fileReads,before.fileReads,"zero uploaded file reads");
  assert.equal(after.backups,before.backups,"zero pre_restore backup");
  assert.equal(after.trash,before.trash,"zero trash restore");
  assert.equal(after.revalidates,before.revalidates,"zero cache revalidations");
}

test("forged stored full-account restore is blocked after auth before any DB path", async () => {
  for(const intent of ["restore","RESTORE","invalid","other"," restore ","0"]) {
    const form=new FormData();form.set("intent",intent);form.set("backup_id","5");form.set("confirm","RESTORE");form.set("preview_digest","any");
    const before=state(),result=await action.restoreStoredBackup({},form),after=state();
    assert.deepEqual(result,{error:m},intent);
    assert.equal(after.auth,before.auth+1,intent);
    assertNoMutation(before,after);
  }
});
test("forged uploaded full-account restore is blocked before file parse",async()=>{
  for(const intent of ["restore","RESTORE","malformed"]) {
    const form=new FormData();form.set("intent",intent);form.set("confirm","RESTORE");form.set("preview_digest","any");
    const before=state(),result=await action.restorePortableBackup({},form),after=state();
    assert.deepEqual(result,{error:m});
    assert.equal(after.auth,before.auth+1);
    assertNoMutation(before,after);
  }
});
test("direct exact service call is blocked before database or schema operations",async()=>{
  const before=state();
  await assert.rejects(svc.executeExactAccountRestore(42,{} as any,{} as any),{message:m});
  assertNoMutation(before,state());
});
test("individual trash flight restore remains separately reachable",async()=>{
  const before=state();
  const form=new FormData();form.set("trash_id","2");
  const r=await action.restoreDeletedFlight({},form);
  assert.match(r.success,/Flight restored/);
  assert.equal(c.trash,before.trash+1);
});
test("manual backup creation remains separately reachable",async()=>{
  const before=state();
  await action.createManualBackup();
  assert.equal(c.backups,before.backups+1);
  assert.equal(c.revalidates,before.revalidates+2);
});

