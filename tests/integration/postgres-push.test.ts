import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1",databaseUrl=process.env.DATABASE_URL??"",root=path.resolve(import.meta.dirname,"../..");
const schemaName=`ft_push_${randomUUID().replaceAll("-","")}`,quoted=`"${schemaName}"`;
function raw(statement:string){return spawnSync("psql",[databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}})}
function run(statement:string){const result=raw(`SET search_path TO ${quoted};\n${statement}`);if(result.status!==0)throw new Error(result.stderr||result.stdout);return String(result.stdout??"").trim()}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl);
  const setup=raw(`CREATE SCHEMA ${quoted};SET search_path TO ${quoted};
    CREATE TABLE users(id BIGINT PRIMARY KEY);
    CREATE TABLE auth_sessions(id TEXT PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id),expires_at TIMESTAMPTZ NOT NULL,revoked_at TIMESTAMPTZ);
    CREATE TABLE flytally_feature_migrations(migration_key TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    INSERT INTO users(id) VALUES(1),(2);
    INSERT INTO auth_sessions(id,user_id,expires_at) VALUES('s1',1,NOW()+INTERVAL '7 days'),('s2',2,NOW()+INTERVAL '7 days');`);
  if(setup.status!==0)throw new Error(setup.stderr||setup.stdout);
  const source=fs.readFileSync(path.join(root,"lib/push-schema.ts"),"utf8");
  const blocks=[...source.matchAll(/sql\`([\s\S]*?)\`/g)].map(match=>match[1]).filter(value=>value.startsWith("CREATE TABLE IF NOT EXISTS push_preferences")||value.startsWith("CREATE TABLE IF NOT EXISTS push_subscriptions")||value.startsWith("CREATE INDEX IF NOT EXISTS idx_push_subscriptions_"));
  assert.ok(blocks.length>=4);
  for(const block of blocks)run(block);
});
after(()=>{if(enabled)raw(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)});

test("push endpoints are unique and can move to a new authenticated session",{skip:!enabled},()=>{
  run("INSERT INTO push_subscriptions(user_id,session_id,endpoint) VALUES(1,'s1','https://fcm.googleapis.com/fcm/send/device')");
  const duplicate=raw(`SET search_path TO ${quoted};INSERT INTO push_subscriptions(user_id,session_id,endpoint) VALUES(2,'s2','https://fcm.googleapis.com/fcm/send/device')`);
  assert.notEqual(duplicate.status,0);
  run("INSERT INTO push_subscriptions(user_id,session_id,endpoint) VALUES(2,'s2','https://fcm.googleapis.com/fcm/send/device') ON CONFLICT(endpoint) DO UPDATE SET user_id=EXCLUDED.user_id,session_id=EXCLUDED.session_id");
  assert.equal(run("SELECT user_id||'|'||session_id FROM push_subscriptions WHERE endpoint='https://fcm.googleapis.com/fcm/send/device'"),"2|s2");
});

test("push subscriptions cascade with auth session deletion",{skip:!enabled},()=>{
  run("INSERT INTO push_subscriptions(user_id,session_id,endpoint) VALUES(1,'s1','https://updates.push.services.mozilla.com/wpush/v2/device')");
  run("DELETE FROM auth_sessions WHERE id='s1'");
  assert.equal(run("SELECT COUNT(*) FROM push_subscriptions WHERE user_id=1"),"0");
});

test("push preferences are account-owned with safe defaults",{skip:!enabled},()=>{
  run("INSERT INTO push_preferences(user_id) VALUES(1)");
  assert.equal(run("SELECT enabled||'|'||compliance||'|'||activity||'|'||security FROM push_preferences WHERE user_id=1"),"t|t|t|t");
});
