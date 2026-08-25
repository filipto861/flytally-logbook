import test from "node:test";
import assert from "node:assert/strict";
import { selectAutomaticAirport } from "../lib/airport-selection.ts";
import { splitTrackFileName } from "../lib/track-file-name.ts";

test("automatic airport selection is limited to close track edges",()=>{
  assert.equal(selectAutomaticAirport([{distanceKm:4.1,score:4.1}]),null);
  assert.deepEqual(selectAutomaticAirport([{distanceKm:.8,score:.8},{distanceKm:1,score:1}]),{distanceKm:.8,score:.8});
});

test("an ambiguous airport a few kilometres from the track stays manual",()=>{
  assert.equal(selectAutomaticAirport([{distanceKm:3,score:3},{distanceKm:3.4,score:3.4}]),null);
  assert.deepEqual(selectAutomaticAirport([{distanceKm:3,score:3},{distanceKm:5,score:5}]),{distanceKm:3,score:3});
});

test("split GPS filenames preserve their original format",()=>{
  assert.equal(splitTrackFileName("flight.gpx",0,2),"flight__part1-of-2.gpx");
  assert.equal(splitTrackFileName("SkyDemon.csv",1,3),"SkyDemon__part2-of-3.csv");
  assert.equal(splitTrackFileName("ADSB.kml",0,1),"ADSB.kml");
});
