import test from "node:test";
import assert from "node:assert/strict";
import { airspaceCapability, parseAirspaceTile } from "../lib/openaip-airspace-contract.ts";

test("A2A tile coordinate parser accepts exact canonical xyz only", () => {
  assert.deepEqual(parseAirspaceTile({ z: "0", x: "0", y: "0" }), { z: 0, x: 0, y: 0 });
  assert.deepEqual(parseAirspaceTile({ z: "8", x: "255", y: "255" }), { z: 8, x: 255, y: 255 });
  for (const input of [
    { z: "8", x: "256", y: "0" },
    { z: "8", x: "0", y: "256" },
    { z: "-1", x: "0", y: "0" },
    { z: "23", x: "0", y: "0" },
    { z: "08", x: "0", y: "0" },
    { z: "2", x: "1.0", y: "0" },
    { z: "2", x: "NaN", y: "0" },
    { z: "2", x: "1", y: "+1" },
    { z: "2", x: "1", y: "1?token=secret" },
    { z: "9007199254740993", x: "0", y: "0" },
  ]) assert.equal(parseAirspaceTile(input), null);
});

test("A2A overlay capability is disabled until explicitly requested", () => {
  assert.equal(airspaceCapability({
    requested: false, authenticated: true, deploymentEnabled: true, providerContractVerified: true,
  }), "disabled");
});

test("A2A overlay fails closed if any required permission is missing", () => {
  for (const missing of ["authenticated", "deploymentEnabled", "providerContractVerified"] as const) {
    const input = {
      requested: true, authenticated: true, deploymentEnabled: true, providerContractVerified: true,
    };
    input[missing] = false;
    assert.equal(airspaceCapability(input), "unavailable", missing);
  }
});

test("A2A capability only becomes ready when all explicit gates are true", () => {
  assert.equal(airspaceCapability({
    requested: true, authenticated: true, deploymentEnabled: true, providerContractVerified: true,
  }), "ready");
});
