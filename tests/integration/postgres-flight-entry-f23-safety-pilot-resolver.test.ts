import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_f23_pic_${randomUUID().replaceAll("-","")}`;
const quoted=`"${schema}"`;

function raw(statement:string){
  return spawnSync("psql",["-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});
}
function run(statement:string){
  const result=raw(`SET search_path TO ${quoted};\n${statement}`);
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
  return String(result.stdout??"").trim();
}
function resolverSql(){
  const source=fs.readFileSync(path.join(root,"lib/flight-connected-crew.ts"),"utf8");
  const blocks=[...source.matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]);
  const block=blocks.find(value=>value.includes("WHERE u.id=${connectedUserId}")&&value.includes("pc.status='accepted'"));
  assert.ok(block,"F2.3 accepted PIC snapshot SQL is present");
  return block;
}
function literal(value:unknown){return typeof value==="number"?String(value):`'${String(value).replaceAll("'","''")}'`}
function render(block:string,values:Record<string,unknown>){
  const rendered=block.replace(/\$\{([^}]+)\}/g,(_all,expression)=>{
    const key=String(expression).trim();
    assert.ok(Object.prototype.hasOwnProperty.call(values,key),`No SQL test value for ${key}`);
    return literal(values[key]);
  });
  assert.doesNotMatch(rendered,/\$\{/);
  return rendered;
}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for F2.3 PostgreSQL tests");
  const result=raw(`
    CREATE SCHEMA ${quoted};
    SET search_path TO ${quoted};
    CREATE TABLE users(id BIGINT PRIMARY KEY,display_name TEXT NOT NULL);
    CREATE TABLE pilot_connections(
      id BIGSERIAL PRIMARY KEY,
      requester_user_id BIGINT NOT NULL REFERENCES users(id),
      recipient_user_id BIGINT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL
    );
    INSERT INTO users(id,display_name) VALUES
      (1,'Source Pilot'),
      (2,'Connected PIC'),
      (3,'Pending Pilot'),
      (4,'   ');
    INSERT INTO pilot_connections(requester_user_id,recipient_user_id,status) VALUES
      (1,2,'accepted'),
      (3,1,'pending'),
      (1,4,'accepted');
  `);
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
});

after(()=>{if(enabled)raw(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)});

test("F2.3 production resolver query returns only an accepted other-user identity", {skip:!enabled},()=>{
  const sql=resolverSql();
  assert.equal(run(render(sql,{sourceUserId:1,connectedUserId:2})),"2|Connected PIC");
  assert.equal(run(render(sql,{sourceUserId:1,connectedUserId:1})),"");
  assert.equal(run(render(sql,{sourceUserId:1,connectedUserId:3})),"");
  assert.equal(run(render(sql,{sourceUserId:1,connectedUserId:4})),"");
});

test("F2.3 production resolver query snapshots the current server display name by account id", {skip:!enabled},()=>{
  const sql=resolverSql();
  run("UPDATE users SET display_name='Renamed Server PIC' WHERE id=2");
  assert.equal(run(render(sql,{sourceUserId:1,connectedUserId:2})),"2|Renamed Server PIC");
});

test("F2.3 production resolver query fails closed after Connection revocation", {skip:!enabled},()=>{
  const sql=resolverSql();
  run("UPDATE pilot_connections SET status='cancelled' WHERE requester_user_id=1 AND recipient_user_id=2");
  assert.equal(run(render(sql,{sourceUserId:1,connectedUserId:2})),"");
});
