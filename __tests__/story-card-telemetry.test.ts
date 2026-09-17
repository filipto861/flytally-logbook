import fs from "node:fs";
import path from "node:path";

describe("Story card telemetry polish",()=>{
  const source=fs.readFileSync(path.join(process.cwd(),"components/flight-story-card.tsx"),"utf8");
  it("renders dual-unit telemetry scales",()=>{
    expect(source).toContain("ALTITUDE · FT");
    expect(source).toContain("GPS SPEED · KT");
    expect(source).toContain("scale.altMax");
    expect(source).toContain("scale.speedMax");
  });
  it("keeps branding quiet and avoids max-stat clutter",()=>{
    expect(source).toContain("fly-tally.com");
    expect(source).not.toContain("MAX ALT");
    expect(source).not.toContain("MAX SPEED");
  });
});
