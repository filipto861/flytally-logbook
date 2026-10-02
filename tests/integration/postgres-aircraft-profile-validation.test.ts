import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { after,before,test } from "node:test";
import { validateAircraftProfile,type AircraftProfileValidationInput } from "../../lib/aircraft-profile-validation.ts";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const schemaName=`ft_aircraft_profile_${randomUUID().replaceAll("-","")}`;
const quoted=`"${schemaName}"`;

function raw(statement:string){
  return spawnSync("psql",["-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt"],{input:statement,encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});
}
function run(statement:string){
  const result=raw(`SET search_path TO ${quoted};\n${statement}`);
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
  return String(result.stdout??"").trim().replace(/\r\n/g,"\n");
}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl);
  const setup=raw(`CREATE SCHEMA ${quoted};SET search_path TO ${quoted};
    CREATE TABLE aircraft(
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      registration TEXT NOT NULL,
      evidence TEXT NOT NULL DEFAULT '',
      aircraft_class TEXT NOT NULL DEFAULT '',
      regulatory_category TEXT NOT NULL DEFAULT '',
      balloon_class TEXT NOT NULL DEFAULT '',
      balloon_group TEXT NOT NULL DEFAULT '',
      UNIQUE(user_id,registration)
    );`);
  if(setup.status!==0)throw new Error(setup.stderr||setup.stdout);
});

after(()=>{if(enabled)raw(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)});

function persistValidated(registration:string,input:AircraftProfileValidationInput){
  const result=validateAircraftProfile(input);
  if(!result.profile)return false;
  const p=result.profile;
  const quote=(value:string)=>`'${value.replaceAll("'","''")}'`;
  run(`INSERT INTO aircraft(user_id,registration,evidence,aircraft_class,regulatory_category,balloon_class,balloon_group)
    VALUES(1,${quote(registration)},${quote(p.evidence)},${quote(p.aircraftClass)},${quote(p.regulatoryCategory)},${quote(p.balloonClass)},${quote(p.balloonGroup)})`);
  return true;
}

test("M1 malformed shared regulatory profile cannot reach PostgreSQL persistence",{skip:!enabled},()=>{
  const persisted=persistValidated("N-BAD",{
    aircraftMake:"Robinson",aircraftModel:"R44",
    evidence:"EASA",aircraftClass:"HELICOPTER",regulatoryCategory:"AEROPLANE",
  });
  assert.equal(persisted,false);
  assert.equal(run("SELECT COUNT(*) FROM aircraft WHERE registration='N-BAD'"),"0");
});

test("M1 canonical shared regulatory profile reaches PostgreSQL with normalized fields",{skip:!enabled},()=>{
  const persisted=persistValidated("N-GOOD",{
    aircraftMake:"Robinson",aircraftModel:"R44",
    evidence:"EASA",aircraftClass:"HELICOPTER",regulatoryCategory:"HELICOPTER",
  });
  assert.equal(persisted,true);
  assert.equal(run("SELECT evidence||'|'||aircraft_class||'|'||regulatory_category FROM aircraft WHERE registration='N-GOOD'"),"EASA|HELICOPTER|HELICOPTER");
});

test("M1 incomplete hot-air balloon profile fails before PostgreSQL persistence",{skip:!enabled},()=>{
  const persisted=persistValidated("OK-BAL",{
    aircraftMake:"Cameron",aircraftModel:"Z-105",
    evidence:"EASA",aircraftClass:"BALLOON",regulatoryCategory:"BALLOON",
    balloonClass:"HOT_AIR_BALLOON",balloonGroup:"",
  });
  assert.equal(persisted,false);
  assert.equal(run("SELECT COUNT(*) FROM aircraft WHERE registration='OK-BAL'"),"0");
});
