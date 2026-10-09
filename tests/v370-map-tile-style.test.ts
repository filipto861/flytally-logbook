import test from "node:test";
import assert from "node:assert/strict";
import { parseMapTileStyle } from "../lib/map-tile-style.ts";

test("3.7.0 map tile style preserves the omitted legacy standard style", () => {
  assert.equal(parseMapTileStyle(new URLSearchParams()), "map");
});

test("3.7.0 map tile style accepts exactly one supported explicit value", () => {
  assert.equal(parseMapTileStyle(new URLSearchParams("style=map")), "map");
  assert.equal(parseMapTileStyle(new URLSearchParams("style=satellite")), "satellite");
});

test("3.7.0 map tile style fails closed on unknown or empty values", () => {
  for (const value of ["style=unknown", "style=satelite", "style=", "style=%20", "style=MAP"]) {
    assert.equal(parseMapTileStyle(new URLSearchParams(value)), null, value);
  }
});

test("3.7.0 map tile style fails closed on duplicates, including identical ones", () => {
  for (const query of ["style=map&style=satellite", "style=map&style=map", "style=satellite&style=satellite"]) {
    assert.equal(parseMapTileStyle(new URLSearchParams(query)), null, query);
  }
});
