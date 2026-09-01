import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css=fs.readFileSync("app/v156-mobile-hardening.css","utf8");
const layout=fs.readFileSync("app/layout.tsx","utf8");
const audit=fs.readFileSync("MOBILE_UX_AUDIT_V156.md","utf8");
const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
const lock=JSON.parse(fs.readFileSync("package-lock.json","utf8"));

test("v1.56 package metadata remains synchronized",()=>{
  const parts=String(pkg.version).split(".").map(Number);
  assert.ok(parts[0]>1||(parts[0]===1&&parts[1]>=56));
  assert.equal(lock.version,pkg.version);
  assert.equal(lock.packages[""].version,pkg.version);
});

test("v1.56 mobile hardening is the final application CSS layer",()=>{
  const v153=layout.indexOf('import "./v153-everyday-ux.css"');
  const v156=layout.indexOf('import "./v156-mobile-hardening.css"');
  assert.ok(v153>=0&&v156>v153);
});

test("v1.56 constrains WebKit native date and time controls instead of hiding page overflow",()=>{
  assert.match(css,/input\[type="date"\]/);
  assert.match(css,/input\[type="time"\]/);
  assert.match(css,/-webkit-appearance:none/);
  assert.match(css,/inline-size:100%/);
  assert.match(css,/min-inline-size:0/);
  assert.match(css,/max-inline-size:100%/);
  assert.match(css,/::-webkit-date-and-time-value/);
  assert.doesNotMatch(css,/body\s*\{[^}]*overflow-x\s*:\s*hidden/i);
});

test("v1.56 shared control containment excludes semantic small controls",()=>{
  assert.match(css,/input:not\(\[type="hidden"\]\):not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):not\(\[type="range"\]\):not\(\[type="file"\]\)/);
  assert.match(css,/\.table-scroll/);
  assert.match(css,/overflow-x:auto/);
});

test("v1.56 audit covers every primary navigation destination",()=>{
  for(const label of ["Dashboard","Flights","FSTD sessions","Add flight","Map","Notifications","Connections","Licences","Settings","Aircraft & airports","Print & data","Administration"]){
    assert.ok(audit.includes(`**${label}**`),`missing mobile audit row for ${label}`);
  }
  assert.match(audit,/does \*\*not\*\* change flight semantics/i);
});

test("v1.56 retains the regulatory and aircraft-integrity regression safety net",()=>{
  for(const path of [
    "tests/v151-regulatory-correctness.test.ts",
    "tests/v1511-legacy-recency.test.ts",
    "tests/v1512-recency-provenance.test.ts",
    "tests/v1513-automatic-ull-credit.test.ts",
    "tests/v1531-aircraft-state.test.ts",
    "tests/v1543-aircraft-catalog.test.ts",
    "tests/v155-flight-entry-layout.test.ts",
  ])assert.equal(fs.existsSync(path),true,`${path} must remain`);
});
