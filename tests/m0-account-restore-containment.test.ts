import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  ACCOUNT_RESTORE_UNAVAILABLE_MESSAGE,
  blockFullAccountRestore,
} from "../lib/account-restore-containment.ts";

const root = path.resolve(import.meta.dirname, "..");
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

test("M0-A fail-closed guard cannot return or be overridden", () => {
  assert.match(ACCOUNT_RESTORE_UNAVAILABLE_MESSAGE, /temporarily unavailable/i);
  assert.throws(() => blockFullAccountRestore(), {
    message: ACCOUNT_RESTORE_UNAVAILABLE_MESSAGE,
  });
});

test("M0-A exact restore service blocks before any schema or SQL operation", () => {
  const code = source("lib/account-restore-v6.ts");
  const start = code.indexOf("export async function executeExactAccountRestore(");
  assert.ok(start > 0);
  const body = code.slice(start);
  assert.match(body, /^export async function executeExactAccountRestore\([^\n]+\n\s*\/\/ M0-A[^\n]*\n\s*blockFullAccountRestore\(\);/);
  assert.ok(body.indexOf("blockFullAccountRestore();") < body.indexOf("await Promise.all"));
  assert.ok(body.indexOf("blockFullAccountRestore();") < body.indexOf("MAX(id)"));
  assert.match(body, /DELETE FROM flight_audit_log/);
  assert.match(body, /INSERT INTO flight_audit_log/);
  // Historical SQL is present but deliberately unreachable until M0-B.
});

test("M0-A old legacy multi-transaction restore cannot be invoked", () => {
  const code = source("app/(protected)/export/actions.ts");
  assert.match(code, /async function restoreLegacy\([^\n]+\n\s*blockFullAccountRestore\(\);/);
});

test("M0-A server actions require authenticated user and stop restore before file or DB loading", () => {
  const code = source("app/(protected)/export/actions.ts");
  const actions = ["restorePortableBackup", "restoreStoredBackup"];
  for (const action of actions) {
    const start = code.indexOf("export async function " + action + "(");
    assert.ok(start >= 0, action + " must exist");
    const end = code.indexOf("\nexport async function ", start + 10);
    const scope = code.slice(start, end < 0 ? undefined : end);
    const auth = scope.indexOf("await requireUser()");
    const guard = scope.indexOf('form.get("intent")||"preview"');
    assert.ok(auth >= 0 && guard > auth, action + " must authorize before fail-closed gate");
    assert.match(scope, /return\{error:ACCOUNT_RESTORE_UNAVAILABLE_MESSAGE\}/);
    const load = action === "restoreStoredBackup" ? scope.indexOf("await loadStoredBackup") : scope.indexOf("await readBackup");
    assert.ok(load > guard, action + " must block before file/stored backup read");
  }
  const common = code.slice(code.indexOf("async function restoreParsedBackup("));
  const guard = common.indexOf('if(!allowedPreviewIntents.has(intent))return{error:ACCOUNT_RESTORE_UNAVAILABLE_MESSAGE}');
  assert.ok(guard > 0);
  assert.ok(guard < common.indexOf("prepareExactAccountRestore"));
  assert.ok(guard < common.indexOf("buildPreview(userId,parsed.backup"));
  assert.ok(guard < common.indexOf('createStoredBackup(userId,"pre_restore")'));
});

test("M0-A preview remains available; backup create/download and individual Trash restore survive", () => {
  const actions = source("app/(protected)/export/actions.ts");
  assert.match(actions, /if\(!allowedPreviewIntents\.has\(intent\)\)return\{error:ACCOUNT_RESTORE_UNAVAILABLE_MESSAGE\}/);
  assert.match(actions, /export async function createManualBackup\(/);
  assert.match(actions, /export async function restoreDeletedFlight\(/);
  assert.match(source("components/data-hub.tsx"), /href="\/api\/export\?format=json"/);
  const center = source("components/backup-center.tsx");
  assert.match(center, /<PendingActionButton/);
  assert.match(center, /href=\{\x60\/api\/backups\/\$\{backup.id\}\x60\}/);
});

test("M0-A both client screens can only submit preview and explicitly announce disabled recovery", () => {
  for (const pathName of ["components/backup-center.tsx", "components/backup-restore.tsx"]) {
    const code = source(pathName);
    assert.match(code, /data.set\("intent","preview"\)/);
    assert.doesNotMatch(code, /data.set\("intent","restore"\)/);
    assert.doesNotMatch(code, /onClick=\{[^}]*run\([^)]*"restore"/);
    assert.doesNotMatch(code, /Type RESTORE|Restore missing data|Restoring…|Backup is ready/);
    assert.match(code, /role="status"[^>]*>\{ACCOUNT_RESTORE_UNAVAILABLE_MESSAGE\}/);
  }
  assert.match(source("components/backup-center.tsx"), /Check backup/);
  assert.match(source("components/backup-restore.tsx"), /Check backup/);
});
