import assert from "node:assert/strict";
import test from "node:test";
import { intelligentFlightReview,intelligentMinutes,latestContinuationSuggestion,type IntelligentFlightHistory } from "../lib/intelligent-logbook.ts";

const history:IntelligentFlightHistory[]=[
  {id:6,date:"2026-09-02",registration:"OK-AAA",departure:"LKPR",arrival:"LKBE",offBlock:"10:00",onBlock:"11:00",blockMinutes:60,certified:true},
  {id:5,date:"2026-09-01",registration:"OK-AAA",departure:"LKBE",arrival:"LKPR",offBlock:"09:00",onBlock:"10:05",blockMinutes:65,certified:true},
  {id:4,date:"2026-08-28",registration:"OK-AAA",departure:"LKPR",arrival:"LKLT",offBlock:"12:00",onBlock:"13:10",blockMinutes:70,certified:true},
  {id:3,date:"2026-08-25",registration:"OK-AAA",departure:"LKLT",arrival:"LKPR",offBlock:"14:00",onBlock:"15:00",blockMinutes:60,certified:true},
  {id:2,date:"2026-08-20",registration:"OK-AAA",departure:"LKPR",arrival:"LKBE",offBlock:"08:00",onBlock:"09:10",blockMinutes:70,certified:true},
  {id:1,date:"2026-08-18",registration:"OK-AAA",departure:"LKBE",arrival:"LKPR",offBlock:"11:00",onBlock:"12:00",blockMinutes:60,certified:true},
];

test("v1.67 duration helper handles midnight without inventing a date",()=>{
  assert.equal(intelligentMinutes("23:50","00:20"),30);
  assert.equal(intelligentMinutes("bad","00:20"),0);
});

test("v1.67 continuation is advisory and comes only from the latest stored arrival",()=>{
  assert.deepEqual(latestContinuationSuggestion(history),{airport:"LKBE",date:"2026-09-02",registration:"OK-AAA",flightId:6});
  assert.equal(latestContinuationSuggestion([]),null);
});

test("v1.67 detects an exact duplicate before the existing server-side hard blocker",()=>{
  const result=intelligentFlightReview({date:"2026-09-02",registration:"ok-aaa",departure:"lkpr",arrival:"lkbe",offBlock:"10:00",onBlock:"11:00"},history);
  assert.ok(result.some(item=>item.code==="exact_duplicate"&&item.tone==="attention"));
});

test("v1.67 timeline review catches AIR or movement times outside BLOCK",()=>{
  const result=intelligentFlightReview({date:"2026-09-03",registration:"OK-AAA",departure:"LKPR",arrival:"LKBE",offBlock:"10:00",takeoff:"09:55",landing:"11:05",onBlock:"11:00"},history);
  assert.ok(result.some(item=>item.code==="air_exceeds_block"));
  assert.ok(result.some(item=>item.code==="takeoff_outside_block"));
  assert.ok(result.some(item=>item.code==="landing_outside_block"));
});

test("v1.67 duration outlier requires enough same-aircraft history and remains a warning",()=>{
  const result=intelligentFlightReview({date:"2026-09-03",registration:"OK-AAA",departure:"LKPR",arrival:"LOWW",offBlock:"08:00",onBlock:"12:00"},history);
  assert.ok(result.some(item=>item.code==="duration_outlier"&&item.tone==="warning"));
  const sparse=intelligentFlightReview({date:"2026-09-03",registration:"OK-BBB",departure:"LKPR",arrival:"LOWW",offBlock:"08:00",onBlock:"12:00"},history);
  assert.ok(!sparse.some(item=>item.code==="duration_outlier"));
});

test("v1.67 intelligence never changes or classifies regulatory data",()=>{
  const result=intelligentFlightReview({date:"2026-09-03",registration:"OK-AAA",departure:"LKPR",arrival:"LKBE",offBlock:"08:00",onBlock:"09:00"},history);
  assert.ok(result.every(item=>!["evidence","regulatory_category","role","operation_context"].includes(item.code)));
});
