import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.26 uses opaque revocable server-side sessions",()=>{
  const source=read("lib/auth/session.ts"),migration=read("lib/db-optimization.ts");
  assert.match(source,/randomBytes\(32\)/);
  assert.match(source,/token_hash/);
  assert.match(source,/revoked_at IS NULL/);
  assert.match(source,/sameSite:"lax"/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS auth_sessions/);
});

test("password sign-in is throttled and transparently upgrades old hashes",()=>{
  const login=read("app/login/actions.ts"),password=read("lib/auth/password.ts");
  assert.match(login,/isLoginLimited/);
  assert.match(login,/passwordNeedsRehash/);
  assert.match(password,/CURRENT_N=131072/);
  assert.match(login,/Invalid email or password/);
});

test("Google sign-in validates OIDC state, nonce and PKCE",()=>{
  const start=read("app/api/auth/google/start/route.ts"),callback=read("app/api/auth/google/callback/route.ts");
  assert.match(start,/randomState\(\)/);
  assert.match(start,/randomNonce\(\)/);
  assert.match(start,/randomPKCECodeVerifier\(\)/);
  assert.match(callback,/expectedState:flow\.state/);
  assert.match(callback,/expectedNonce:flow\.nonce/);
  assert.match(callback,/pkceCodeVerifier:flow\.verifier/);
  assert.match(callback,/email_verified!==true/);
});

test("private beta registration requires a matching unused invitation",()=>{
  const join=read("app/join/actions.ts"),google=read("app/api/auth/google/callback/route.ts"),admin=read("app/(protected)/admin/actions.ts");
  assert.match(join,/used_at IS NULL AND revoked_at IS NULL AND expires_at>NOW\(\)/);
  assert.match(google,/LOWER\(BTRIM\(email\)\)=\$\{email\}/);
  assert.match(admin,/randomBytes\(32\)/);
  assert.match(admin,/tokenHash\(raw\)/);
});

test("security settings expose Google linking and device revocation",()=>{
  const profile=read("app/(protected)/profile/page.tsx"),actions=read("app/(protected)/profile/actions.ts"),css=read("app/globals.css");
  assert.match(profile,/Connect Google/);
  assert.match(profile,/Active sessions/);
  assert.match(actions,/revokeOtherSessions/);
  assert.match(actions,/credentials\[0\]/);
  assert.match(css,/FlyTally v1\.26 — private beta authentication/);
});

test("password recovery is generic, single-use and revokes active sessions",()=>{
  const request=read("app/forgot-password/actions.ts"),reset=read("app/reset-password/actions.ts"),migration=read("lib/db-optimization.ts");
  assert.match(request,/return\{sent:true\}/);
  assert.match(request,/NOW\(\)\+INTERVAL '30 minutes'/);
  assert.match(reset,/used_at IS NULL AND expires_at>NOW\(\)/);
  assert.match(reset,/UPDATE auth_sessions SET revoked_at=NOW\(\)/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS auth_password_resets/);
});

test("invitations and password resets use the verified transactional sender",()=>{
  const email=read("lib/email.ts"),admin=read("app/(protected)/admin/actions.ts"),login=read("app/login/login-form.tsx");
  assert.match(email,/AUTH_EMAIL_FROM/);
  assert.match(email,/Idempotency-Key/);
  assert.match(admin,/sendInvitationEmail/);
  assert.match(login,/Forgot password\?/);
});

test("admin user activity combines legacy and modern login timestamps as text",()=>{
  const admin=read("app/(protected)/admin/page.tsx");
  assert.match(admin,/COALESCE\(c\.last_login_at::text,\(SELECT MAX\(last_login_at\)::text FROM auth_identities/);
  assert.doesNotMatch(admin,/COALESCE\(c\.last_login_at,\(SELECT MAX\(last_login_at\) FROM auth_identities/);
});
