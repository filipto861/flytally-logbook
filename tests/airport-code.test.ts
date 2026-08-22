import test from "node:test";
import assert from "node:assert/strict";
import { isLegacyCzechAirportIdent,preferredAirportCode } from "../lib/airport-code.ts";

test("airport code preference uses ICAO, GPS, local code, then internal ident",()=>{
  assert.equal(preferredAirportCode({icao:"LKPR",gps:"LKPR",local:"PRG",ident:"CZ-9999"}),"LKPR");
  assert.equal(preferredAirportCode({gps:"LKXX",local:"LKLOCAL",ident:"CZ-9998"}),"LKXX");
  assert.equal(preferredAirportCode({local:"LKKEJZ",ident:"CZ-0169"}),"LKKEJZ");
  assert.equal(preferredAirportCode({ident:"CZ-0060"}),"CZ-0060");
});

test("only four-digit Czech internal identifiers are migration candidates",()=>{
  assert.equal(isLegacyCzechAirportIdent("cz-0169"),true);
  assert.equal(isLegacyCzechAirportIdent("LKKEJZ"),false);
  assert.equal(isLegacyCzechAirportIdent("CZ-169"),false);
});
