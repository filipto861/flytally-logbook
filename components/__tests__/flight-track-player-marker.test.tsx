import fs from "node:fs";
import path from "node:path";

describe("FlightTrackPlayer aircraft marker", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "components/flight-track-player.tsx"), "utf8");

  it("uses a custom north-up SVG instead of the platform airplane emoji", () => {
    expect(source).toContain("AIRCRAFT_MARKER_SVG");
    expect(source).toContain('class="aircraft-marker-svg"');
    expect(source).not.toContain("✈");
  });

  it("rotates the north-up SVG directly by the computed bearing", () => {
    expect(source).toContain("rotate(${current.bearing}deg)");
    expect(source).not.toContain("current.bearing-90");
  });
});
