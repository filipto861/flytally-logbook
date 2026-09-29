import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { crewRoleCredits } from "../lib/crew.ts";
import { evaluatePassengerCurrencyMode,type RecencyFlight } from "../lib/recency-engine.ts";
import { sharedFlightCreditMinutes } from "../lib/shared-flight-credit.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("PIC materialization uses explicit commander provenance while preserving canonical PIC credit",()=>{
  const actions=read("app/(protected)/flights/shared-actions.ts");
  const start=actions.indexOf("async function materializeParticipation");
  const end=actions.indexOf("async function insertPicParticipation",start);
  assert.ok(start>=0&&end>start);
  const materialize=actions.slice(start,end);
  assert.match(materialize,/p\.pic_commander_basis/);
  assert.match(materialize,/normalizePicCommanderBasis\(row\.pic_commander_basis\)\?\?\"CERTIFIED_SOURCE_COMMANDER\"/);
  assert.match(materialize,/picCommanderBasis===\"CERTIFIED_SOURCE_COMMANDER\"\?text\(row\.commander\):participantName/);
  assert.match(materialize,/credit=crewRoleCredits\(participantRole,creditMinutes\)/);
  assert.match(materialize,/recipientNote=pic\?text\(row\.note\)/);
});

test("PIC materialization rechecks Connection for every PIC and linked Actual-PIC evidence for certified-source commander basis",()=>{
  const actions=read("app/(protected)/flights/shared-actions.ts");
  const start=actions.indexOf("async function materializeParticipation");
  const end=actions.indexOf("async function insertPicParticipation",start);
  const materialize=actions.slice(start,end);
  assert.match(materialize,/participantRole!==\"PIC\"/);
  assert.match(materialize,/pc\.status='accepted'/);
  assert.match(materialize,/picCommanderBasis!==\"CERTIFIED_SOURCE_COMMANDER\"/);
  assert.match(materialize,/UPPER\(TRIM\(COALESCE\(sf\.role,''\)\)\)='SAFETY PILOT'/);
  assert.match(materialize,/linked\.connected_user_id=\$\{userId\}/);
  assert.match(materialize,/picCommanderBasis!==\"RECIPIENT_ACCOUNT\"/);
  assert.match(materialize,/lineage\.participant_flight_id=sf\.id/);
});

test("PIC recipient preview follows the stored commander provenance",()=>{
  const page=read("app/(protected)/connections/shared/[id]/page.tsx");
  assert.match(page,/p\.pic_commander_basis/);
  assert.match(page,/normalizePicCommanderBasis\(row\.pic_commander_basis\)\?\?\"CERTIFIED_SOURCE_COMMANDER\"/);
  assert.match(page,/picCommanderBasis===\"CERTIFIED_SOURCE_COMMANDER\"\?row\.commander:row\.participant_name/);
});

test("SP4 PIC materialization credit follows the canonical ordinary PIC path",()=>{
  const row={off_block:"10:00",on_block:"11:12",takeoff:"10:05",landing:"11:05",regulatory_category:"AEROPLANE",aircraft_class:"SEP",evidence:"EASA"};
  const minutes=sharedFlightCreditMinutes(row);
  assert.equal(minutes,72);
  assert.deepEqual(crewRoleCredits("PIC",minutes),{role:"PIC",pic:72,copilot:0,instructor:0});
  assert.deepEqual(crewRoleCredits("SAFETY PILOT",minutes),{role:"SAFETY PILOT",pic:0,copilot:0,instructor:0});
});

test("SP4 materialized PIC recency is identical to an equivalent ordinary PIC record while source Safety Pilot contributes no PF movements",()=>{
  const ordinary:RecencyFlight={
    date:"2026-09-20",evidence:"EASA",aircraftClass:"SEP",role:"PIC",minutes:72,starts:3,
    landingsDay:3,landingsNight:0,movementEvidenceRecorded:true,takeoffsDay:3,takeoffsNight:0,
    approachesDay:3,approachesNight:0,
  };
  const materialized={...ordinary,role:crewRoleCredits("PIC",72).role??""};
  const source={...ordinary,role:"SAFETY PILOT"};
  const ordinaryState=evaluatePassengerCurrencyMode([ordinary],"SEP",false,"2026-09-28","day");
  const materializedState=evaluatePassengerCurrencyMode([materialized],"SEP",false,"2026-09-28","day");
  const sourceState=evaluatePassengerCurrencyMode([source],"SEP",false,"2026-09-28","day");
  assert.deepEqual(materializedState,ordinaryState);
  assert.equal(materializedState.status,"current");
  assert.equal(sourceState.status,"not-current");
  assert.equal(sourceState.meta?.takeoffs,0);
  assert.equal(sourceState.meta?.landings,0);
});
