import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const schemaName=`ft_heli_snapshot_${randomUUID().replaceAll("-","")}`;
const quoted=`"${schemaName}"`;

function raw(statement:string){
  return spawnSync("psql",[databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});
}
function run(statement:string){
  const result=raw(`SET search_path TO ${quoted};\n${statement}`);
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
  return String(result.stdout??"").trim();
}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl);
  const setup=raw(`CREATE SCHEMA ${quoted};SET search_path TO ${quoted};
    CREATE TABLE aircraft(
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      registration TEXT NOT NULL,
      aircraft_model TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE flights(
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      registration TEXT NOT NULL,
      aircraft_type TEXT NOT NULL DEFAULT '',
      aircraft_model TEXT NOT NULL DEFAULT '',
      regulatory_category TEXT NOT NULL DEFAULT 'HELICOPTER'
    );
    INSERT INTO aircraft(user_id,registration,aircraft_model) VALUES(1,'OK-HEL','R22 Beta II');
    INSERT INTO flights(id,user_id,registration,aircraft_type,aircraft_model) VALUES
      (1,1,'OK-HEL','R44 legacy label','R44 Raven II'),
      (2,1,'OK-HEL','R44 legacy label',''),
      (3,1,'OK-HEL','','');
  `);
  if(setup.status!==0)throw new Error(setup.stderr||setup.stdout);
});

after(()=>{if(enabled)raw(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)});

const historicalTypeSql=`SELECT id||'|'||COALESCE(NULLIF(TRIM(f.aircraft_model),''),NULLIF(TRIM(f.aircraft_type),''),'') FROM flights f ORDER BY id`;

test("helicopter historical type uses flight model then bounded legacy flight type",{skip:!enabled},()=>{
  assert.equal(run(historicalTypeSql),"1|R44 Raven II\n2|R44 legacy label\n3|");
});

test("editing the current aircraft model cannot rewrite historical helicopter type resolution",{skip:!enabled},()=>{
  run("UPDATE aircraft SET aircraft_model='H145' WHERE user_id=1 AND registration='OK-HEL'");
  assert.equal(run(historicalTypeSql),"1|R44 Raven II\n2|R44 legacy label\n3|");
});
