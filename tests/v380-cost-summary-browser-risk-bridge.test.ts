import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const harness=fileURLToPath(new URL("../tooling/run-auth-browser.mjs",import.meta.url));
const runner=readFileSync(harness,"utf8");
const bridge=readFileSync(new URL("../tooling/run-v380-cost-summary-acceptance-local.ps1",import.meta.url),"utf8");
const browserRisk=readFileSync(new URL("../tooling/verify-browser-risk.mjs",import.meta.url),"utf8");
const args=["--currency-v21-risk","e2e/trash-integrity.spec.mjs","--project=desktop-chromium",
  "--grep=Currency","--retries=0","--workers=1"];
function rejected(argv:string[],overrides:Record<string,string>={}){
  const env:NodeJS.ProcessEnv={...process.env,
    FLYTALLY_LOCAL_POSTGRES:"1",FLYTALLY_AUTH_BROWSER:"1",
    FLYTALLY_CURRENCY_V21_BROWSER:"1",FLYTALLY_V21_RISK_BROWSER:"1",
    FLYTALLY_BROWSER_EVIDENCE_FILE:"dummy-browser-risk-evidence.json",
    DATABASE_URL:"postgresql://flytally@127.0.0.1:49500/flytally_currency_test",
    ...overrides};
  delete env.VERCEL;delete env.VERCEL_ENV;
  return spawnSync(process.execPath,[harness,...argv],{env,encoding:"utf8",timeout:8000});
}
test("PR340 v21 browser-risk intent is explicit and preserves separate legacy currency mode",()=>{
  assert.match(runner,/const currencyIntent=playwrightArgs\[0\]==="--currency-v21"/);
  assert.match(runner,/const riskCurrencyIntent=playwrightArgs\[0\]==="--currency-v21-risk"/);
  assert.match(runner,/if\(currencyIntent&&\(playwrightArgs\.length!==2\|\|playwrightArgs\[1\]!=="e2e\/trash-integrity\.spec\.mjs"\)\)/);
  assert.match(browserRisk,/FLYTALLY_V21_RISK_BROWSER==="1"\?\["--currency-v21-risk"\]:\[\]/);
  assert.match(runner,/if\(schemaFirstIntent\)/);
});
test("v21 browser-risk mode refuses any nonloopback database before destructive bootstrap",()=>{
  for(const url of [
    "postgresql://flytally@production.example.org:49500/flytally_currency_test",
    "postgresql://flytally@127.0.0.1:49500/neondb",
    "postgresql://flytally:password@127.0.0.1:49500/flytally_currency_test",
    "postgresql://flytally@127.0.0.1:55432/flytally_currency_test",
  ]){
    const result=rejected(args,{DATABASE_URL:url});
    assert.equal(result.status,2,url+" "+result.stderr);
    assert.match(result.stderr,/Currency browser is not the dedicated disposable fixture/);
    assert.doesNotMatch(result.stdout,/Browser smoke database ready/);
  }
});
test("v21 browser-risk mode fails without explicit risk purpose and exact selected Playwright args",()=>{
  for(const [argv,env] of [
    [args,{FLYTALLY_V21_RISK_BROWSER:"0"}],
    [["e2e/trash-integrity.spec.mjs"],{}],
    [[...args,"--update-snapshots"],{}],
    [[...args.slice(0,2),"--project=desktop-chromium","--grep=Currency","--retries=1","--workers=1"],{}],
    [["--currency-v21-risk","../tooling/other.mjs","--project=desktop-chromium","--grep=Currency","--retries=0","--workers=1"],{}],
  ] as const){
    const result=rejected([...argv],env as Record<string,string>);
    assert.equal(result.status,2,[...argv].join(" "));
    assert.doesNotMatch(result.stdout,/Browser smoke database ready/);
  }
});
test("local wrapper allocates and validates its own temporary PG16 cluster, never user or Neon DB",()=>{
  assert.match(bridge,/initdb -D \$dataDir -U flytally -A trust/);
  assert.match(bridge,/-h 127\.0\.0\.1 -p \$port/);
  assert.match(bridge,/flytally_currency_test\|flytally\|127\.0\.0\.1\|\$port/);
  assert.match(bridge,/\$env:DATABASE_URL = "postgresql:\/\/flytally@127\.0\.0\.1:\$port\/flytally_currency_test"/);
  assert.match(bridge,/\$env:FLYTALLY_V21_RISK_BROWSER = "1"/);
  assert.match(bridge,/git rev-parse "refs\/remotes\/origin\/\$expectedBranch"/);
  assert.match(bridge,/npm\.cmd run verify:release:risk -- --base origin\/main/);
  assert.match(bridge,/Restore-Env "DATABASE_URL" \$oldDatabaseUrl/);
  assert.match(bridge,/Restore-Env "FLYTALLY_V21_RISK_BROWSER" \$oldRiskBrowser/);
  assert.match(bridge,/Remove-Item -LiteralPath \$temporaryRoot -Recurse -Force/);
});
