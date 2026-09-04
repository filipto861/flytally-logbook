import assert from "node:assert/strict";
import test from "node:test";
import { intelligentFlightReview,intelligentLogbookAttention,intelligentMinutes,latestContinuationSuggestion,type IntelligentFlightHistory } from "../lib/intelligent-logbook.ts";

const history:IntelligentFlightHistory[]=[
  {id:6,date:"2026-09-02",registration:"OK-AAA",aircraftType:"C172",aircraftClass:"SEP",regulatoryCategory:"AEROPLANE",evidence:"EASA",engineType:"PISTON",role:"PIC",operationType:"SP",departure:"LKPR",arrival:"LKBE",offBlock:"10:00",onBlock:"11:00",blockMinutes:60,starts:1,landingsDay:1,certified:true},
  {id:5,date:"2026-09-01",registration:"OK-AAA",aircraftType:"C172",aircraftClass:"SEP",regulatoryCategory:"AEROPLANE",evidence:"EASA",engineType:"PISTON",role:"PIC",operationType:"SP",departure:"LKBE",arrival:"LKPR",offBlock:"09:00",onBlock:"10:05",blockMinutes:65,starts:1,landingsDay:1,certified:true},
  {id:4,date:"2026-08-28",registration:"OK-AAA",aircraftType:"C172",aircraftClass:"SEP",regulatoryCategory:"AEROPLANE",evidence:"EASA",engineType:"PISTON",role:"PIC",operationType:"SP",departure:"LKPR",arrival:"LKLT",offBlock:"12:00",onBlock:"13:10",blockMinutes:70,starts:1,landingsDay:1,certified:true},
  {id:3,date:"2026-08-25",registration:"OK-AAA",aircraftType:"C172",aircraftClass:"SEP",regulatoryCategory:"AEROPLANE",evidence:"EASA",engineType:"PISTON",role:"PIC",operationType:"SP",departure:"LKLT",arrival:"LKPR",offBlock:"14:00",onBlock:"15:00",blockMinutes:60,starts:1,landingsDay:1,certified:true},
  {id:2,date:"2026-08-20",registration:"OK-AAA",aircraftType:"C172",aircraftClass:"SEP",regulatoryCategory:"AEROPLANE",evidence:"EASA",engineType:"PISTON",role:"PIC",operationType:"SP",departure:"LKPR",arrival:"LKBE",offBlock:"08:00",onBlock:"09:10",blockMinutes:70,starts:1,landingsDay:1,certified:true},
  {id:1,date:"2026-08-18",registration:"OK-AAA",aircraftType:"C172",aircraftClass:"SEP",regulatoryCategory:"AEROPLANE",evidence:"EASA",engineType:"PISTON",role:"PIC",operationType:"SP",departure:"LKBE",arrival:"LKPR",offBlock:"11:00",onBlock:"12:00",blockMinutes:60,starts:1,landingsDay:1,certified:true},
];

test("v1.67 duration helper handles midnight without inventing a date",()=>{
  assert.equal(intelligentMinutes("23:50","00:20"),30);
  assert.equal(intelligentMinutes("bad","00:20"),0);
});

test("v1.67 continuation is advisory and comes only from the latest stored arrival",()=>{
  assert.deepEqual(latestContinuationSuggestion(history),{airport:"LKBE",date:"2026-09-02",registration:"OK-AAA",flightId:6});
  assert.equal(latestContinuationSuggestion([]),null);
});

test("v1.67 detects an exact duplicate before the existing server-side hard blocker and explains why",()=>{
  const result=intelligentFlightReview({date:"2026-09-02",registration:"ok-aaa",departure:"lkpr",arrival:"lkbe",offBlock:"10:00",onBlock:"11:00"},history),duplicate=result.find(item=>item.code==="exact_duplicate");
  assert.equal(duplicate?.tone,"attention");
  assert.ok(duplicate?.evidence?.some(item=>item.label==="Existing record"&&item.value==="#6"));
});

test("v1.67 catches incomplete, invalid and impossible timeline combinations",()=>{
  const incomplete=intelligentFlightReview({date:"2026-09-03",registration:"OK-AAA",departure:"LKPR",arrival:"LKBE",offBlock:"10:00",takeoff:"10:10"},history);
  assert.ok(incomplete.some(item=>item.code==="incomplete_block_pair"));
  assert.ok(incomplete.some(item=>item.code==="incomplete_air_pair"));
  const invalid=intelligentFlightReview({date:"2026-09-03",registration:"OK-AAA",departure:"LKPR",arrival:"LKBE",offBlock:"25:00",onBlock:"11:00"},history);
  assert.ok(invalid.some(item=>item.code==="invalid_time_off_block"));
  const outside=intelligentFlightReview({date:"2026-09-03",registration:"OK-AAA",departure:"LKPR",arrival:"LKBE",offBlock:"10:00",takeoff:"09:55",landing:"11:05",onBlock:"11:00"},history);
  assert.ok(outside.some(item=>item.code==="air_exceeds_block"));
  assert.ok(outside.some(item=>item.code==="takeoff_outside_block"));
  assert.ok(outside.some(item=>item.code==="landing_outside_block"));
});

test("v1.67 duration outlier requires enough same-aircraft history and remains advisory",()=>{
  const result=intelligentFlightReview({date:"2026-09-03",registration:"OK-AAA",departure:"LKPR",arrival:"LOWW",offBlock:"08:00",onBlock:"12:00"},history);
  assert.ok(result.some(item=>item.code==="duration_outlier"&&item.tone==="warning"));
  const sparse=intelligentFlightReview({date:"2026-09-03",registration:"OK-BBB",departure:"LKPR",arrival:"LOWW",offBlock:"08:00",onBlock:"12:00"},history);
  assert.ok(!sparse.some(item=>item.code==="duration_outlier"));
});

test("v1.67 checks explicit pilot role against SP/MP without rewriting or inferring either field",()=>{
  const result=intelligentFlightReview({date:"2026-09-03",registration:"OK-AAA",regulatoryCategory:"AEROPLANE",role:"Co-pilot",operationType:"SP",departure:"LKPR",arrival:"LKBE",offBlock:"08:00",onBlock:"09:00"},history),issue=result.find(item=>item.code==="copilot_single_pilot");
  assert.equal(issue?.tone,"attention");
  assert.ok(issue?.evidence?.some(item=>item.label==="Role"&&item.value==="CO-PILOT"));
  assert.ok(issue?.message.includes("will not change"));
  const missingOperation=intelligentFlightReview({date:"2026-09-03",registration:"OK-AAA",regulatoryCategory:"AEROPLANE",role:"Co-pilot",operationType:"",departure:"LKPR",arrival:"LKBE",offBlock:"08:00",onBlock:"09:00"},history);
  assert.ok(!missingOperation.some(item=>item.code==="copilot_single_pilot"));
});

test("v1.67 movement review catches implausible T/O/L patterns and history outliers",()=>{
  const result=intelligentFlightReview({date:"2026-09-03",registration:"OK-AAA",regulatoryCategory:"AEROPLANE",departure:"LKPR",arrival:"LKPR",offBlock:"08:00",onBlock:"08:20",movementEvidenceRecorded:"yes",takeoffsDay:"12",landingsDay:"1"},history);
  assert.ok(result.some(item=>item.code==="movement_count_gap"));
  assert.ok(result.some(item=>item.code==="movement_density_high"));
  assert.ok(result.some(item=>item.code==="movement_history_outlier"));
});

test("v1.67 registration profile only warns when the user's own history has a strong pattern",()=>{
  const result=intelligentFlightReview({date:"2026-09-03",registration:"OK-AAA",aircraftClass:"MEP",regulatoryCategory:"AEROPLANE",evidence:"EASA",engineType:"PISTON",departure:"LKPR",arrival:"LKBE",offBlock:"08:00",onBlock:"09:00"},history),issue=result.find(item=>item.code==="registration_profile_aircraft_class");
  assert.equal(issue?.tone,"warning");
  assert.ok(issue?.evidence?.some(item=>item.value.includes("SEP")));
  const sparse=intelligentFlightReview({date:"2026-09-03",registration:"OK-BBB",aircraftClass:"MEP",regulatoryCategory:"AEROPLANE",departure:"LKPR",arrival:"LKBE",offBlock:"08:00",onBlock:"09:00"},history);
  assert.ok(!sparse.some(item=>item.code.startsWith("registration_profile_")));
});

test("v1.67 professional review validates only explicit context and never guesses CAT/NCC/SPO/PICUS",()=>{
  const explicit=intelligentFlightReview({date:"2026-09-03",registration:"OK-AAA",evidence:"ULL",regulatoryCategory:"AEROPLANE",operatorName:"Example Air",operationContext:"CAT",departure:"LKPR",arrival:"LKBE",offBlock:"08:00",onBlock:"09:00"},history);
  assert.ok(explicit.some(item=>item.code==="professional_context_scope"&&item.tone==="attention"));
  const absent=intelligentFlightReview({date:"2026-09-03",registration:"OK-AAA",evidence:"EASA",regulatoryCategory:"AEROPLANE",departure:"LKPR",arrival:"LKBE",offBlock:"08:00",onBlock:"09:00"},history);
  assert.ok(!absent.some(item=>item.code.startsWith("professional_")));
  assert.ok(absent.every(item=>!/(?:CAT|NCC|SPO|PICUS)/.test(item.message)));
});

test("v1.67 needs-attention review evaluates stored flights read-only without self-duplicate false positives",()=>{
  const stored:IntelligentFlightHistory[]=[
    ...history,
    {id:7,date:"2026-09-03",registration:"OK-AAA",aircraftClass:"SEP",regulatoryCategory:"AEROPLANE",evidence:"EASA",role:"Co-pilot",operationType:"SP",departure:"LKPR",arrival:"LKBE",offBlock:"10:00",onBlock:"",blockMinutes:0},
  ];
  const queue=intelligentLogbookAttention(stored),flagged=queue.find(item=>item.flightId===7);
  assert.ok(flagged?.insights.some(item=>item.code==="copilot_single_pilot"));
  assert.ok(flagged?.insights.some(item=>item.code==="incomplete_block_pair"));
  assert.ok(!flagged?.insights.some(item=>item.code==="exact_duplicate"));
});
