import test from "node:test";
import assert from "node:assert/strict";
import { flightAuditChanges } from "../lib/flight-audit.ts";

test("audit exposes only changed logbook fields",()=>{
  const changes=flightAuditChanges(
    {id:12,user_id:3,registration:"OK-BID",departure:"LKSZ",arrival:"LKRO",starts:1},
    {id:12,user_id:3,registration:"OK-BID",departure:"LKSZ",arrival:"LKLT",starts:2},
  );
  assert.deepEqual(changes.map(change=>change.field),["arrival","starts"]);
  assert.deepEqual(changes.find(change=>change.field==="arrival"),{field:"arrival",label:"Arrival",before:"LKRO",after:"LKLT"});
});

test("audit formats locking and empty values for humans",()=>{
  const changes=flightAuditChanges({locked_at:null,note:""},{locked_at:"2026-08-22T10:00:00Z",note:"Checked"});
  assert.deepEqual(changes,[
    {field:"note",label:"Notes",before:"—",after:"Checked"},
    {field:"locked_at",label:"Lock status",before:"Unlocked",after:"Locked"},
  ]);
});

test("audit creation contains all populated visible fields",()=>{
  const changes=flightAuditChanges(null,{date:"2026-08-22",registration:"OK-BID",departure:"LKSZ",arrival:"LKRO"});
  assert.ok(changes.some(change=>change.field==="date"&&change.after==="2026-08-22"));
  assert.ok(changes.some(change=>change.field==="registration"&&change.after==="OK-BID"));
  assert.equal(changes.some(change=>change.field==="user_id"),false);
});
