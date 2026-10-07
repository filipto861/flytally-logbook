import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_void_collab_${randomUUID().replaceAll("-","")}`;
const quoted=`"${schema}"`;

function raw(statement:string){
  return spawnSync("psql",["-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt"],{
    input:statement,encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"},
  });
}
function run(statement:string){
  const result=raw(`SET search_path TO ${quoted};\n${statement}`);
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
  return String(result.stdout??"").trim().replace(/\r\n/g,"\n");
}
function migration20Blocks(){
  const source=fs.readFileSync(path.join(root,"lib/db-optimization.ts"),"utf8");
  const start=source.indexOf("if(version===20)return[");
  const end=source.indexOf("  ];",start);
  assert.ok(start>=0&&end>start,"schema v20 migration block exists");
  return [...source.slice(start,end).matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]);
}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for certified voiding collaboration PostgreSQL tests");
  const setup=raw(`
    CREATE SCHEMA ${quoted};
    SET search_path TO ${quoted};
    CREATE TABLE users(id BIGINT PRIMARY KEY);
    CREATE TABLE flights(
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,date TEXT NOT NULL DEFAULT '2026-10-07',note TEXT NOT NULL DEFAULT '',
      certified_at TIMESTAMPTZ,certified_by_user_id BIGINT,certification_hash TEXT NOT NULL DEFAULT '',certification_version INTEGER NOT NULL DEFAULT 8,
      locked_at TIMESTAMPTZ,locked_by_user_id BIGINT,record_revision INTEGER NOT NULL DEFAULT 1,correction_reason TEXT NOT NULL DEFAULT '',
      correction_opened_at TIMESTAMPTZ,correction_opened_by_user_id BIGINT
    );
    CREATE UNIQUE INDEX flights_id_user_owner_uq ON flights(id,user_id);
    CREATE TABLE flight_participations(
      id BIGINT PRIMARY KEY,source_flight_id BIGINT NOT NULL REFERENCES flights(id) ON DELETE CASCADE,source_user_id BIGINT NOT NULL,
      participant_user_id BIGINT NOT NULL,participant_role TEXT NOT NULL,pic_commander_basis TEXT,source_revision INTEGER NOT NULL,source_hash TEXT NOT NULL,
      status TEXT NOT NULL,participant_flight_id BIGINT REFERENCES flights(id) ON DELETE SET NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),responded_at TIMESTAMPTZ,
      superseded_at TIMESTAMPTZ,decision_note TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE instructor_flight_approvals(
      id BIGINT PRIMARY KEY,flight_id BIGINT NOT NULL REFERENCES flights(id) ON DELETE CASCADE,student_user_id BIGINT NOT NULL,instructor_user_id BIGINT NOT NULL,
      record_revision INTEGER NOT NULL,flight_hash TEXT NOT NULL,status TEXT NOT NULL,requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),decided_at TIMESTAMPTZ,decision_note TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE flight_public_shares(
      id BIGINT PRIMARY KEY,user_id BIGINT NOT NULL,flight_id BIGINT NOT NULL,revoked_at TIMESTAMPTZ,
      CONSTRAINT flight_public_shares_owner_fk FOREIGN KEY(flight_id,user_id) REFERENCES flights(id,user_id) ON DELETE CASCADE
    );
    CREATE TABLE user_notifications(
      id BIGINT PRIMARY KEY,user_id BIGINT NOT NULL,kind TEXT NOT NULL DEFAULT 'test',title TEXT NOT NULL DEFAULT 'test',body TEXT NOT NULL DEFAULT '',
      href TEXT NOT NULL DEFAULT '',dedupe_key TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),read_at TIMESTAMPTZ
    );
    INSERT INTO users(id) VALUES(1),(2),(3);
    INSERT INTO flights(id,user_id,note,certified_at,certified_by_user_id,certification_hash,locked_at,locked_by_user_id) VALUES
      (400,1,'void source',NOW(),1,repeat('a',64),NOW(),1),
      (500,2,'participant copy',NOW(),2,repeat('b',64),NOW(),2);
    INSERT INTO flight_participations(id,source_flight_id,source_user_id,participant_user_id,participant_role,source_revision,source_hash,status,participant_flight_id,responded_at) VALUES
      (10,400,1,2,'INSTRUCTOR',1,repeat('a',64),'accepted',500,NOW()),
      (11,400,1,3,'SAFETY PILOT',1,repeat('a',64),'pending',NULL,NULL);
    INSERT INTO instructor_flight_approvals(id,flight_id,student_user_id,instructor_user_id,record_revision,flight_hash,status) VALUES
      (21,400,1,3,1,repeat('a',64),'pending');
    INSERT INTO flight_public_shares(id,user_id,flight_id,revoked_at) VALUES(31,1,400,NULL);
    INSERT INTO user_notifications(id,user_id,href,dedupe_key) VALUES
      (41,1,'/flights/400','owner-flight'),
      (42,1,'/flights/400/audit','owner-audit'),
      (43,3,'/connections/shared/11','recipient-share'),
      (44,3,'/connections/flight/21','recipient-approval'),
      (45,3,'/connections','unrelated');
  `);
  if(setup.status!==0)throw new Error(setup.stderr||setup.stdout);
  for(const block of migration20Blocks())run(block);
});

after(()=>{if(enabled)raw(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)});

test("M5B void collaboration teardown preserves participant copy and retires dead notification links",{skip:!enabled},()=>{
  run(`BEGIN;
    WITH inserted AS (
      INSERT INTO voided_certified_flights(
        user_id,original_flight_id,record_revision,certification_hash,certification_version,certified_at,certified_by_user_id,
        flight_snapshot,flight_snapshot_sha256,voided_by_user_id,void_reason,operation_token
      )
      SELECT user_id,id,record_revision,certification_hash,certification_version,certified_at,certified_by_user_id,
        to_jsonb(f),repeat('c',64),1,'Incorrect certified record','00000000-0000-0000-0000-000000000010'
      FROM flights f WHERE id=400 RETURNING id
    )
    INSERT INTO voided_flight_archive_items(voided_flight_id,item_kind,source_key,source_data,source_sha256)
      SELECT i.id,'PARTICIPATION',p.id::text,to_jsonb(p),repeat('d',64) FROM inserted i CROSS JOIN flight_participations p WHERE p.source_flight_id=400;
    INSERT INTO voided_flight_archive_items(voided_flight_id,item_kind,source_key,source_data,source_sha256)
      SELECT v.id,'INSTRUCTOR_APPROVAL',a.id::text,to_jsonb(a),repeat('e',64) FROM voided_certified_flights v CROSS JOIN instructor_flight_approvals a
      WHERE v.original_flight_id=400 AND v.created_txid=txid_current() AND a.flight_id=400;
    INSERT INTO voided_flight_archive_items(voided_flight_id,item_kind,source_key,source_data,source_sha256)
      SELECT v.id,'PUBLIC_SHARE',s.id::text,to_jsonb(s),repeat('f',64) FROM voided_certified_flights v CROSS JOIN flight_public_shares s
      WHERE v.original_flight_id=400 AND v.created_txid=txid_current() AND s.flight_id=400;
    INSERT INTO voided_flight_archive_items(voided_flight_id,item_kind,source_key,source_data,source_sha256)
      SELECT v.id,'SOURCE_PROVENANCE',p.id::text,to_jsonb(p),repeat('1',64) FROM voided_certified_flights v CROSS JOIN flight_source_provenance p
      WHERE v.original_flight_id=400 AND v.created_txid=txid_current() AND p.source_flight_id=400;
    UPDATE user_notifications n SET read_at=COALESCE(n.read_at,NOW()),href='/audit/voided-flights/'||v.id::text
      FROM voided_certified_flights v
      WHERE n.user_id=1 AND n.href IN('/flights/400','/flights/400/audit') AND v.original_flight_id=400 AND v.created_txid=txid_current();
    UPDATE user_notifications n SET read_at=COALESCE(n.read_at,NOW()),href=''
      WHERE n.href IN('/connections/shared/11','/connections/flight/21');
    UPDATE flight_participations SET status='superseded',superseded_at=NOW(),responded_at=COALESCE(responded_at,NOW())
      WHERE source_user_id=1 AND source_flight_id=400 AND status='pending';
    UPDATE instructor_flight_approvals SET status='superseded',decided_at=COALESCE(decided_at,NOW())
      WHERE student_user_id=1 AND flight_id=400 AND status='pending';
    UPDATE flight_public_shares SET revoked_at=COALESCE(revoked_at,NOW()) WHERE user_id=1 AND flight_id=400 AND revoked_at IS NULL;
    UPDATE flight_source_provenance p SET source_voided_flight_id=v.id,updated_at=NOW()
      FROM voided_certified_flights v
      WHERE p.source_user_id=1 AND p.source_flight_id=400 AND v.original_flight_id=400 AND v.created_txid=txid_current();
    DELETE FROM flights WHERE id=400;
    COMMIT;`);

  assert.equal(run("SELECT COUNT(*) FROM flights WHERE id=400"),"0");
  assert.equal(run("SELECT COUNT(*) FROM flights WHERE id=500"),"1");
  assert.equal(run("SELECT COUNT(*) FROM flight_participations WHERE source_flight_id=400"),"0");
  assert.equal(run("SELECT COUNT(*) FROM instructor_flight_approvals WHERE flight_id=400"),"0");
  assert.equal(run("SELECT COUNT(*) FROM flight_public_shares WHERE flight_id=400"),"0");
  assert.equal(run("SELECT COUNT(*) FROM flight_source_provenance WHERE participant_flight_id=500 AND source_voided_flight_id IS NOT NULL"),"1");
  assert.equal(run("SELECT COUNT(*) FROM voided_flight_archive_items WHERE voided_flight_id=(SELECT id FROM voided_certified_flights WHERE original_flight_id=400)"),"5");
  assert.match(run("SELECT href FROM user_notifications WHERE id=41"),/^\/audit\/voided-flights\/\d+$/);
  assert.match(run("SELECT href FROM user_notifications WHERE id=42"),/^\/audit\/voided-flights\/\d+$/);
  assert.equal(run("SELECT href FROM user_notifications WHERE id=43"),"");
  assert.equal(run("SELECT href FROM user_notifications WHERE id=44"),"");
  assert.equal(run("SELECT href FROM user_notifications WHERE id=45"),"/connections");
  assert.equal(run("SELECT COUNT(*) FROM user_notifications WHERE id IN(41,42,43,44) AND read_at IS NOT NULL"),"4");
});
