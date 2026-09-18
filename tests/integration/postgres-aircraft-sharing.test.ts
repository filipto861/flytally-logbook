import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schemaName=`ft_aircraft_share_${randomUUID().replaceAll("-","")}`;
const quoted=`"${schemaName}"`;
function raw(statement:string){return spawnSync("psql",[databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}})}
function run(statement:string){const result=raw(`SET search_path TO ${quoted};\n${statement}`);if(result.status!==0)throw new Error(result.stderr||result.stdout);return String(result.stdout??"").trim()}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl);
  const setup=raw(`CREATE SCHEMA ${quoted};SET search_path TO ${quoted};
    CREATE TABLE users(id BIGINT PRIMARY KEY);
    CREATE TABLE aircraft(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,registration TEXT NOT NULL,UNIQUE(user_id,registration));
    INSERT INTO users(id) VALUES(1),(2),(3);
    INSERT INTO aircraft(id,user_id,registration) VALUES(10,1,'OK-ABC');`);
  if(setup.status!==0)throw new Error(setup.stderr||setup.stdout);
  const source=fs.readFileSync(path.join(root,"lib/v300-aircraft-sharing-schema.ts"),"utf8");
  const blocks=[...source.matchAll(/sql\`([\s\S]*?)\`/g)].map(match=>match[1]).filter(value=>value.startsWith("CREATE TABLE IF NOT EXISTS aircraft_photos")||value.startsWith("CREATE INDEX IF NOT EXISTS idx_aircraft_photos")||value.startsWith("CREATE TABLE IF NOT EXISTS aircraft_profile_shares")||value.startsWith("CREATE UNIQUE INDEX IF NOT EXISTS uq_aircraft_profile_share_pending")||value.startsWith("CREATE INDEX IF NOT EXISTS idx_aircraft_profile_shares_"));
  assert.ok(blocks.length>=6);
  for(const block of blocks)run(block);
});
after(()=>{if(enabled)raw(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)});

test("aircraft cover photos stay user-owned and follow aircraft deletion",{skip:!enabled},()=>{
  run(`INSERT INTO aircraft_photos(aircraft_id,user_id,mime_type,image_base64) VALUES(10,1,'image/jpeg','YWJj')`);
  assert.equal(run("SELECT user_id||'|'||mime_type FROM aircraft_photos WHERE aircraft_id=10"),"1|image/jpeg");
});

test("only one pending profile share exists per source aircraft and recipient",{skip:!enabled},()=>{
  run(`INSERT INTO aircraft_profile_shares(source_user_id,recipient_user_id,source_aircraft_id,snapshot_data) VALUES(1,2,10,'{"profile":{"registration":"OK-ABC"}}'::jsonb)`);
  const duplicate=raw(`SET search_path TO ${quoted};INSERT INTO aircraft_profile_shares(source_user_id,recipient_user_id,source_aircraft_id,snapshot_data) VALUES(1,2,10,'{}'::jsonb)`);
  assert.notEqual(duplicate.status,0);
  run("UPDATE aircraft_profile_shares SET status='accepted' WHERE source_user_id=1 AND recipient_user_id=2");
  run(`INSERT INTO aircraft_profile_shares(source_user_id,recipient_user_id,source_aircraft_id,snapshot_data) VALUES(1,2,10,'{}'::jsonb)`);
  assert.equal(run("SELECT COUNT(*) FROM aircraft_profile_shares WHERE source_user_id=1 AND recipient_user_id=2"),"2");
});

test("aircraft profile shares reject self-sharing and cascade with source aircraft",{skip:!enabled},()=>{
  const self=raw(`SET search_path TO ${quoted};INSERT INTO aircraft_profile_shares(source_user_id,recipient_user_id,source_aircraft_id,snapshot_data) VALUES(1,1,10,'{}'::jsonb)`);
  assert.notEqual(self.status,0);
  run("DELETE FROM aircraft WHERE id=10");
  assert.equal(run("SELECT COUNT(*) FROM aircraft_photos"),"0");
  assert.equal(run("SELECT COUNT(*) FROM aircraft_profile_shares"),"0");
});
