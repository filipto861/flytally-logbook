import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const schema=`ft_recency_provenance_${randomUUID().replaceAll("-","")}`;
const quotedSchema=`"${schema}"`;
function rawPsql(statement:string){const result=spawnSync("psql",[databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});if(result.error)throw result.error;return result}
function run(statement:string){const result=rawPsql(`SET search_path TO ${quotedSchema};\n${statement}`);if(result.status!==0)throw new Error(result.stderr||result.stdout);return String(result.stdout??"").trim()}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for recency provenance acceptance tests");
  const setup=`CREATE SCHEMA ${quotedSchema};SET search_path TO ${quotedSchema};
    CREATE TABLE flights(id BIGINT PRIMARY KEY,user_id BIGINT NOT NULL);
    CREATE TABLE flight_audit_log(id BIGSERIAL PRIMARY KEY,flight_id BIGINT NOT NULL,user_id BIGINT NOT NULL,action TEXT NOT NULL,new_data JSONB,changed_at TIMESTAMPTZ NOT NULL);
    CREATE TABLE flytally_feature_migrations(migration_key TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL);
    INSERT INTO flytally_feature_migrations VALUES('v1.35.3-fcl060-structured-movements','2026-08-28T15:10:00Z');
    INSERT INTO flights VALUES(1,41),(2,41),(3,41),(4,41);
    INSERT INTO flight_audit_log(flight_id,user_id,action,new_data,changed_at) VALUES
      (1,41,'created','{}','2026-08-20T10:00:00Z'),
      (2,41,'created','{"movement_evidence_recorded":false}','2026-08-29T10:00:00Z'),
      (4,41,'created','{}','2026-08-20T10:00:00Z'),
      (4,41,'updated','{"movement_evidence_recorded":false}','2026-08-30T10:00:00Z');`;
  const result=rawPsql(setup);if(result.status!==0)throw new Error(result.stderr||result.stdout);
});
after(()=>{if(enabled)rawPsql(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`)});

test("legacy movement provenance follows creation time, not later serialized audit fields",{skip:!enabled},()=>{
  const result=run(`SELECT f.id||':'||(NOT EXISTS(SELECT 1 FROM flight_audit_log created_audit JOIN flytally_feature_migrations movement_migration ON movement_migration.migration_key='v1.35.3-fcl060-structured-movements' WHERE created_audit.flight_id=f.id AND created_audit.user_id=f.user_id AND created_audit.action='created' AND created_audit.changed_at>=movement_migration.applied_at))::text FROM flights f ORDER BY f.id`);
  assert.deepEqual(result.split("\n"),["1:true","2:false","3:true","4:true"]);
});
