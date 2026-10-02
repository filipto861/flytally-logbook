import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const schema=`ft_f43_gps_${randomUUID().replaceAll("-","")}`;
const quoted=`"${schema}"`;

function raw(statement:string){
  return spawnSync("psql",["-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt"],{input:statement,encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});
}
function run(statement:string){
  const result=raw(`SET search_path TO ${quoted};\n${statement}`);
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
  return String(result.stdout??"").trim().replace(/\r\n/g,"\n");
}
function partStatement({offBlock,connectedUserId}:{offBlock:string;connectedUserId:number}){
  return `
WITH inserted AS (
  INSERT INTO flights(user_id,off_block,role,commander)
  SELECT 1,'${offBlock}',CASE WHEN ${connectedUserId}>0 THEN 'SAFETY PILOT' ELSE 'PIC' END,
    CASE WHEN ${connectedUserId}>0 THEN 'Connected PIC' ELSE '' END
  WHERE (${connectedUserId}=0 OR EXISTS(
    SELECT 1 FROM users u
    WHERE u.id=${connectedUserId}
      AND u.id<>1
      AND NULLIF(TRIM(u.display_name),'') IS NOT NULL
      AND EXISTS(
        SELECT 1 FROM pilot_connections pc
        WHERE pc.status='accepted'
          AND ((pc.requester_user_id=1 AND pc.recipient_user_id=u.id)
            OR (pc.recipient_user_id=1 AND pc.requester_user_id=u.id))
      )
  ))
  RETURNING id
),connected_crew AS (
  INSERT INTO flight_connected_crew(source_flight_id,source_user_id,connected_user_id,intended_role)
  SELECT inserted.id,1,${connectedUserId},'PIC'
  FROM inserted
  WHERE ${connectedUserId}>0
  RETURNING id
),track_insert AS (
  INSERT INTO flight_tracks(user_id,flight_id)
  SELECT 1,inserted.id FROM inserted
  RETURNING flight_id
),validated AS (
  SELECT
    (SELECT id FROM inserted) flight_id,
    1/(SELECT COUNT(*)::integer FROM inserted) inserted_ok,
    1/(SELECT COUNT(*)::integer FROM track_insert) track_ok,
    CASE WHEN ${connectedUserId}>0 THEN 1/(SELECT COUNT(*)::integer FROM connected_crew) ELSE 1 END crew_ok
)
SELECT flight_id FROM validated;
`;
}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for F4.3 PostgreSQL tests");
  const result=raw(`
    CREATE SCHEMA ${quoted};
    SET search_path TO ${quoted};
    CREATE TABLE users(id BIGINT PRIMARY KEY,display_name TEXT NOT NULL);
    CREATE TABLE pilot_connections(id BIGSERIAL PRIMARY KEY,requester_user_id BIGINT NOT NULL,recipient_user_id BIGINT NOT NULL,status TEXT NOT NULL);
    CREATE TABLE flights(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,off_block TEXT NOT NULL,role TEXT NOT NULL,commander TEXT NOT NULL DEFAULT '');
    CREATE TABLE flight_tracks(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,flight_id BIGINT NOT NULL REFERENCES flights(id) ON DELETE CASCADE);
    CREATE TABLE flight_connected_crew(
      id BIGSERIAL PRIMARY KEY,
      source_flight_id BIGINT NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
      source_user_id BIGINT NOT NULL,
      connected_user_id BIGINT NOT NULL,
      intended_role TEXT NOT NULL,
      UNIQUE(source_flight_id,intended_role)
    );
    INSERT INTO users(id,display_name) VALUES(1,'Source Pilot'),(2,'Connected PIC');
    INSERT INTO pilot_connections(requester_user_id,recipient_user_id,status) VALUES(1,2,'accepted');
  `);
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
});

after(()=>{if(enabled)raw(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)});

test("F4.3 accepted connected Safety Pilot creates one flight track and child row",{skip:!enabled},()=>{
  const id=run(partStatement({offBlock:"10:00",connectedUserId:2}));
  assert.match(id,/^\d+$/);
  assert.equal(run("SELECT role||'|'||commander FROM flights WHERE id="+id),"SAFETY PILOT|Connected PIC");
  assert.equal(run("SELECT COUNT(*) FROM flight_tracks WHERE flight_id="+id),"1");
  assert.equal(run("SELECT connected_user_id||'|'||intended_role FROM flight_connected_crew WHERE source_flight_id="+id),"2|PIC");
});

test("F4.3 revoked Connection aborts the complete multi-part transaction without partial rows",{skip:!enabled},()=>{
  run("DELETE FROM flight_connected_crew; DELETE FROM flight_tracks; DELETE FROM flights; UPDATE pilot_connections SET status='cancelled';");
  const result=raw(`
    SET search_path TO ${quoted};
    BEGIN;
    ${partStatement({offBlock:"11:00",connectedUserId:0})}
    ${partStatement({offBlock:"11:10",connectedUserId:2})}
    COMMIT;
  `);
  assert.notEqual(result.status,0);
  assert.match(String(result.stderr??""),/division by zero/i);
  assert.equal(run("SELECT COUNT(*) FROM flights"),"0");
  assert.equal(run("SELECT COUNT(*) FROM flight_tracks"),"0");
  assert.equal(run("SELECT COUNT(*) FROM flight_connected_crew"),"0");
});
