import assert from "node:assert/strict";
import { createHash,randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";
import { cookSql } from "./production-sql.ts";

// Behavioural test of the public-share SQL in lib/flight-sharing.ts and the track read it uses
// (lib/data/tracks.ts). The public page itself, including which fields it exposes, is covered
// end to end by e2e/public-flight-share.spec.mjs.
const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_share_${randomUUID().replaceAll("-","")}`;
const quotedSchema=`"${schema}"`;
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const hash=(token:string)=>createHash("sha256").update(token).digest("hex");
const PILOT=31,OTHER=32;

function rawPsql(statement:string){
  const result=spawnSync("psql",["-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt"],{input:statement,encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});
  if(result.error)throw result.error;
  return result;
}
function run(statement:string){
  const result=rawPsql(`SET search_path TO ${quotedSchema};\n${statement}`);
  if(result.status!==0)throw new Error(`PostgreSQL command failed:\n${result.stderr||result.stdout}`);
  return String(result.stdout??"").trim();
}
function rows(statement:string){
  const clean=statement.trim().replace(/;\s*$/,"");
  return JSON.parse(run(`WITH q AS (${clean}) SELECT COALESCE(json_agg(row_to_json(q)),'[]'::json)::text FROM q`)||"[]") as Array<Record<string,unknown>>;
}
const literal=(value:unknown)=>typeof value==="number"||typeof value==="boolean"?String(value):`'${String(value).replaceAll("'","''")}'`;

const sharing=[...read("lib/flight-sharing.ts").matchAll(/sql`([\s\S]*?)`/g)].map(m=>cookSql(m[1]));
const find=(label:string,predicate:(b:string)=>boolean)=>{const found=sharing.find(predicate);assert.ok(found,`${label} not found in lib/flight-sharing.ts`);return found;};
const tableDdl=find("share table",b=>b.startsWith("CREATE TABLE IF NOT EXISTS flight_public_shares"));
// createFlightShare runs exactly three statements, in this order.
const createSource=read("lib/flight-sharing.ts").match(/export async function createFlightShare\([\s\S]*?\n/)?.[0]??"";
const createBlocks=[...createSource.matchAll(/sql`([\s\S]*?)`/g)].map(m=>cookSql(m[1]));
assert.equal(createBlocks.length,3,"createFlightShare changed: review this test");
const [ownedSql,revokeSql,insertSql]=createBlocks;
const publicSql=find("public lookup",b=>b.includes("FROM flight_public_shares s JOIN flights f"));
const countSql=find("count",b=>b.includes("COUNT(*)::int count"));
const revokeAllSql=find("revoke all",b=>b.startsWith("UPDATE flight_public_shares")&&!b.includes("flight_id"));
const purgeSql=find("purge",b=>b.startsWith("DELETE FROM flight_public_shares"));
const tracksBlock=[...read("lib/data/tracks.ts").matchAll(/sql`([\s\S]*?)`/g)].map(m=>cookSql(m[1])).find(b=>b.includes("t.coordinates_json")&&b.includes("t.flight_id=${flightId}"));

function render(block:string,values:Record<string,unknown>){
  return block.replace(/\$\{([^}]+)\}/g,(_m,expr)=>{
    const key=String(expr).trim();
    assert.ok(Object.prototype.hasOwnProperty.call(values,key),`No test value for \${${key}}`);
    return literal(values[key]);
  });
}
/** createFlightShare: refuse unless owned and certified, revoke the active link, insert the new one. */
function createShare(userId:number,flightId:number,token:string,options={showRegistration:false,showDate:true,showTrack:true}){
  if(!rows(render(ownedSql,{userId,flightId})).length)return false;
  run(render(revokeSql,{userId,flightId}));
  run(render(insertSql,{userId,flightId,"hash(token)":hash(token),"Boolean(options.showRegistration)":options.showRegistration,"options.showDate!==false":options.showDate,"options.showTrack!==false":options.showTrack}));
  return true;
}
const lookup=(token:string)=>rows(render(publicSql,{"hash(token)":hash(token)}))[0]??null;

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required");
  const result=rawPsql(`
    CREATE SCHEMA ${quotedSchema};
    SET search_path TO ${quotedSchema};
    CREATE TABLE flights(
      id BIGINT PRIMARY KEY,user_id BIGINT NOT NULL,date TEXT NOT NULL DEFAULT '2026-10-14',departure TEXT NOT NULL DEFAULT 'LKPR',arrival TEXT NOT NULL DEFAULT 'LKTB',
      registration TEXT NOT NULL DEFAULT 'OK-SHR',aircraft_type TEXT NOT NULL DEFAULT '',aircraft_make TEXT,aircraft_model TEXT,evidence TEXT NOT NULL DEFAULT 'EASA',
      off_block TEXT NOT NULL DEFAULT '10:00',on_block TEXT NOT NULL DEFAULT '11:00',landings_day INTEGER,landings_night INTEGER,certified_at TIMESTAMPTZ,
      UNIQUE(id,user_id)
    );
    CREATE TABLE flight_tracks(id BIGINT PRIMARY KEY,user_id BIGINT NOT NULL,flight_id BIGINT NOT NULL,coordinates_json TEXT NOT NULL DEFAULT '[]',distance_km NUMERIC);
    CREATE TABLE airports(id BIGSERIAL PRIMARY KEY,user_id BIGINT,ident TEXT,latitude_deg NUMERIC,longitude_deg NUMERIC,active INTEGER NOT NULL DEFAULT 1,closed INTEGER,source TEXT);
    ${tableDdl};
    INSERT INTO flights(id,user_id,certified_at,landings_day,landings_night) VALUES
      (1,${PILOT},NOW(),2,NULL),(2,${PILOT},NULL,1,0),(3,${OTHER},NOW(),1,0),(4,${PILOT},NOW(),1,0);
    INSERT INTO flight_tracks(id,user_id,flight_id,distance_km) VALUES(11,${PILOT},1,25),(12,${OTHER},1,99),(13,${OTHER},3,40);
    INSERT INTO airports(user_id,ident,latitude_deg,longitude_deg,source) VALUES
      (NULL,'LKPR',50.1,14.26,'ourairports'),(${OTHER},'LKTB',1,1,'manual');
  `);
  if(result.status!==0)throw new Error(`Share fixture setup failed:\n${result.stderr||result.stdout}`);
});

after(()=>{
  if(!enabled)return;
  rawPsql(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
});

test("only the owner of a certified flight can create a link",{skip:!enabled},()=>{
  assert.equal(createShare(PILOT,2,"draft-token-000000000000"),false,"a draft is not shareable");
  assert.equal(createShare(OTHER,1,"foreign-token-0000000000"),false,"another pilot's flight is not shareable");
  assert.equal(createShare(PILOT,3,"foreign-token-1111111111"),false);
  assert.equal(run(`SELECT COUNT(*) FROM flight_public_shares`),"0");
});

test("a link reads only its own certified flight and stores only the token hash",{skip:!enabled},()=>{
  assert.ok(createShare(PILOT,1,"pilot-token-aaaaaaaaaaaa",{showRegistration:true,showDate:false,showTrack:true}));
  assert.equal(run(`SELECT COUNT(*) FROM flight_public_shares WHERE token_hash='pilot-token-aaaaaaaaaaaa'`),"0");
  const row=lookup("pilot-token-aaaaaaaaaaaa");
  assert.ok(row);
  assert.deepEqual([row.user_id,row.flight_id,row.show_registration,row.show_date,row.show_track,row.landings],[PILOT,1,true,false,true,2]);
  assert.equal(lookup("pilot-token-unknown00000"),null);
  // The database refuses a share row for a flight the pilot does not own.
  const mismatch=rawPsql(`SET search_path TO ${quotedSchema}; INSERT INTO flight_public_shares(user_id,flight_id,token_hash) VALUES(${PILOT},3,'${hash("mismatch-token-000000000")}')`);
  assert.notEqual(mismatch.status,0);
  assert.match(String(mismatch.stderr),/flight_public_shares_owner_fk/);
  // The shared track is the owner's own track only.
  assert.ok(tracksBlock,"getFlightTracks SQL not found");
  const tracks=rows(render(tracksBlock,{userId:PILOT,flightId:1}));
  assert.deepEqual(tracks.map(t=>t.id),[11]);
  assert.equal(Number(tracks[0].dep_lat),50.1);
  assert.equal(tracks[0].arr_lat,null,"another pilot's private airport is never used");
  assert.deepEqual(rows(render(tracksBlock,{userId:PILOT,flightId:3})),[],"another pilot's flight has no tracks for this pilot");
});

test("a new link revokes the previous one, and revocation is per flight and per pilot",{skip:!enabled},()=>{
  assert.ok(createShare(PILOT,4,"first-token-bbbbbbbbbbbb"));
  assert.ok(createShare(PILOT,4,"second-token-cccccccccccc"));
  assert.equal(lookup("first-token-bbbbbbbbbbbb"),null);
  assert.ok(lookup("second-token-cccccccccccc"));
  assert.ok(lookup("pilot-token-aaaaaaaaaaaa"),"rotating flight 4 leaves the link of flight 1 alone");
  assert.ok(createShare(OTHER,3,"other-token-dddddddddddd"));
  // Active links of the pilot: flights 1 and 4.
  assert.equal(rows(render(countSql,{userId:PILOT}))[0].count,2);
  run(render(revokeAllSql,{userId:PILOT}));
  assert.equal(rows(render(countSql,{userId:PILOT}))[0].count,0);
  assert.equal(lookup("pilot-token-aaaaaaaaaaaa"),null);
  assert.ok(lookup("other-token-dddddddddddd"),"revoking all of one pilot's links leaves other pilots alone");
});

test("a link stops resolving when the flight is no longer certified or is deleted",{skip:!enabled},()=>{
  run(`INSERT INTO flights(id,user_id,certified_at) VALUES(5,${PILOT},NOW())`);
  assert.ok(createShare(PILOT,5,"correct-token-eeeeeeeeeeee"));
  run(`UPDATE flights SET certified_at=NULL WHERE id=5`);
  assert.equal(lookup("correct-token-eeeeeeeeeeee"),null);
  run(`DELETE FROM flights WHERE id=5`);
  assert.equal(run(`SELECT COUNT(*) FROM flight_public_shares WHERE flight_id=5`),"0","shares are deleted with their flight");
});

test("the retention sweep removes only links revoked more than 30 days ago",{skip:!enabled},()=>{
  run(`INSERT INTO flights(id,user_id,certified_at) VALUES(6,${PILOT},NOW());
    INSERT INTO flight_public_shares(user_id,flight_id,token_hash,revoked_at) VALUES
      (${PILOT},6,'old-revoked',NOW()-INTERVAL '31 days'),(${PILOT},6,'recent-revoked',NOW()-INTERVAL '29 days'),(${PILOT},6,'active',NULL);`);
  run(purgeSql);
  assert.equal(run(`SELECT string_agg(token_hash,',' ORDER BY token_hash) FROM flight_public_shares WHERE flight_id=6`),"active,recent-revoked");
});
