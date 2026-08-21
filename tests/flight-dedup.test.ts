import test from "node:test";
import assert from "node:assert/strict";
import { flightFingerprint } from "../lib/flight-dedup.ts";

test("flight fingerprint normalizes form values",()=>{
  const first=flightFingerprint(7,{date:"2026-08-21",registration:" ok-bid ",offBlock:"13:18",departure:"lkkapl",arrival:"lksz"});
  const second=flightFingerprint(7,{date:"2026-08-21",registration:"OK-BID",offBlock:"13:18",departure:"LKKAPL",arrival:"LKSZ"});
  assert.equal(first,second);
  assert.notEqual(first,flightFingerprint(8,{date:"2026-08-21",registration:"OK-BID",offBlock:"13:18",departure:"LKKAPL",arrival:"LKSZ"}));
});
