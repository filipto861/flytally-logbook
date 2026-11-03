#!/usr/bin/env node
// M0-B B1b.2c test-only SOURCE CONTRACT checks (not an auth/Neon integration test).
// Read-only; never connects to an API, database or production runtime.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {cronRequestAuthorized} from '../lib/cron-auth.ts';
import {assertIsolatedTarget} from './m0b-b1b2c-concurrency-probe.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('cron Bearer authorization strictly rejects missing, empty, malformed, wrong and alternate auth',()=>{
  assert.equal(cronRequestAuthorized(undefined,'Bearer hi'),false);
  assert.equal(cronRequestAuthorized('', 'Bearer hi'),false);
  assert.equal(cronRequestAuthorized('testing-secret',null),false);
  assert.equal(cronRequestAuthorized('testing-secret','testing-secret'),false);
  assert.equal(cronRequestAuthorized('testing-secret','Bearer wrong'),false);
  assert.equal(cronRequestAuthorized('testing-secret','Bearer testing-secret'),true);
  assert.equal(cronRequestAuthorized('testing-secret','bearer testing-secret'),false);
  assert.equal(cronRequestAuthorized('testing-secret','Bearer testing-secret '),false);
});

test('actual scheduled backups route checks CRON_SECRET before any privacy sweep',()=>{
  const route=source('app/api/cron/backups/route.ts');
  const authorization=route.indexOf('cronRequestAuthorized(process.env.CRON_SECRET');
  const sweep=route.indexOf('await runPrivacyRetentionSweep()');
  const accountBackups=route.indexOf('createStoredBackup(');
  assert.ok(authorization>=0&&authorization<sweep&&sweep<accountBackups);
  assert.match(route,/status:401/);
  assert.doesNotMatch(route,/user-agent|vercel-cron/i);
});

test('the deployed cron schedule calls this exact backups endpoint',()=>{
  const vercel=JSON.parse(source('vercel.json'));
  assert.ok(vercel.crons.some(x=>x.path==='/api/cron/backups'));
  assert.equal(vercel.git.deploymentEnabled['*'],false);
  assert.equal(vercel.git.deploymentEnabled.main,false);
});

test('authenticated Trash screen derives owner ID from requireUser, not request params',()=>{
  const page=source('app/(protected)/data/page.tsx');
  const session=page.indexOf('await requireUser()');
  const load=page.indexOf('deletedFlights=await listDeletedFlights(userId)');
  assert.ok(session>=0&&load>session);
  assert.match(page,/const\{userId\}=await requireUser\(\)/);
});

test('requireUser derives identity from active non-revoked hashed DB session',()=>{
  const req=source('lib/auth/require-user.ts');
  const session=source('lib/auth/session.ts');
  assert.match(req,/await getSession\(\)/);
  assert.match(req,/if \(!session\) redirect\("\/login"\)/);
  assert.match(session,/const raw=\(await cookies\(\)\)\.get\(COOKIE_NAME\)\?\.value/);
  assert.match(session,/s\.token_hash=\$\{tokenHash\(raw\)\}/);
  assert.match(session,/s\.revoked_at IS NULL/);
  assert.match(session,/s\.expires_at>NOW\(\)/);
  assert.match(session,/u\.active=1/);
  assert.match(session,/return\{userId:Number\(row\.user_id\)/);
});

test('Trash list currently has scoped direct DELETE and untrusted legacy UID is not inferred',()=>{
  const trash=source('lib/flight-trash.ts');
  assert.match(trash,/DELETE FROM deleted_flights WHERE user_id=\$\{userId\} AND purge_after<=NOW\(\)/);
  assert.match(trash,/WHERE id=\$\{trashId\} AND user_id=\$\{userId\}/);
  assert.match(trash,/restored_at=NOW\(\),restored_flight_id=/);
});

test('the current cron sweep performs a DIFFERENT global DELETE that must be migrated',()=>{
  const privacy=source('lib/privacy-account.ts');
  assert.match(privacy,/export async function runPrivacyRetentionSweep\(\)/);
  assert.match(privacy,/DELETE FROM deleted_flights WHERE purge_after<=NOW\(\)/);
  assert.match(privacy,/await sql\.transaction\(\[/);
});

test('shared lib/db picks one Neon HTTP client from DATABASE_URL, not caller SQL roles',()=>{
  const db=source('lib/db.ts');
  assert.match(db,/const client = process\.env\.FLYTALLY_LOCAL_POSTGRES === "1"/);
  assert.match(db,/neon\(databaseUrl\(\), \{ fullResults:false,arrayMode:false \}\)/);
  assert.match(db,/productionSql/);
  assert.match(db,/export const sql = new Proxy/);
  assert.doesNotMatch(db,/\bSET ROLE\b|\bSET LOCAL ROLE\b|current_setting\(/);
  const p=JSON.parse(source('package.json'));
  assert.match(p.dependencies['@neondatabase/serverless'],/^\^1\./);
});

test('there is no independent privileged SQL client passed to the two cleanup call sites',()=>{
  const page=source('app/(protected)/data/page.tsx');
  const cron=source('app/api/cron/backups/route.ts');
  const trash=source('lib/flight-trash.ts');
  const privacy=source('lib/privacy-account.ts');
  assert.match(page,/import \{ listDeletedFlights \} from "@\/lib\/flight-trash"/);
  assert.match(cron,/import \{ runPrivacyRetentionSweep \} from "@\/lib\/privacy-account"/);
  assert.match(trash,/import \{ sql \} from "@\/lib\/db"/);
  assert.match(privacy,/import \{ sql \} from "@\/lib\/db"/);
});

test('privacy self-service is session and confirmation gated but retains flight and FSTD core',()=>{
  const actions=source('app/(protected)/profile/actions.ts');
  const privacy=source('lib/privacy-account.ts');
  assert.match(actions,/export async function deleteAccount\(f:FormData\)\{const session=await requireUser\(\)/);
  assert.match(actions,/s\(f,"confirm"\)!=="DELETE MY ACCOUNT"/);
  assert.ok(actions.lastIndexOf('eraseTrainingDataForAccount(String(session.userId))')<actions.lastIndexOf('eraseAccountForPrivacy(session.userId)'));
  assert.match(privacy,/UPDATE users SET active=0/);
  assert.doesNotMatch(privacy,/DELETE FROM flights WHERE/);
  assert.doesNotMatch(privacy,/DELETE FROM fstd_sessions WHERE/);
});

test('V22 migration is not silently introduced and full account restore is still blocked',()=>{
  const migrations=source('lib/migration-plan.ts');
  const containment=source('lib/account-restore-containment.ts');
  assert.match(migrations,/DATABASE_SCHEMA_VERSION=21/);
  assert.match(containment,/export function blockFullAccountRestore/);
  assert.match(containment,/throw new Error\(ACCOUNT_RESTORE_UNAVAILABLE_MESSAGE\)/);
});

test('remote Neon/database connection is rejected by existing executable disposable safety guard',()=>{
  assert.throws(()=>assertIsolatedTarget({
    FLYTALLY_M0B_OWNED_PG16:'M0B_DISPOSABLE_PG16_CONFIRMED',
    DATABASE_URL:'postgresql://dummy:dummy@ep-example.neon.tech:5432/flytally_m0b_disposable_ci'
  }),/non-127/);
});

// This intentionally pins the CURRENT source topology. Any later authorized
// refactor must update the audit and its acceptance criteria, not preserve old
// DELETEs or auth paths solely to keep this temporary diagnostic green.
