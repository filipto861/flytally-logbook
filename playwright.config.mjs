import { defineConfig,devices } from "@playwright/test";

const evidenceReporter=process.env.FLYTALLY_BROWSER_EVIDENCE_FILE
  ?[["line"],["./tooling/playwright-evidence-reporter.mjs"]]
  :process.env.CI?[["line"],["html",{outputFolder:"playwright-report",open:"never"}]]:"line";

export default defineConfig({
  testDir:"./e2e",
  timeout:30_000,
  expect:{timeout:5_000},
  fullyParallel:false,
  // Authenticated browser tests share one isolated mutable PostgreSQL fixture; serialize across projects locally and in CI.
  workers:1,
  retries:process.env.CI?1:0,
  reporter:evidenceReporter,
  use:{
    baseURL:"http://127.0.0.1:3000",
    trace:"retain-on-failure",
    screenshot:"only-on-failure",
    video:"off",
  },
  projects:[
    {name:"desktop-chromium",use:{...devices["Desktop Chrome"]}},
    {name:"mobile-chromium",grepInvert:/@self-managed-presentation/,use:{...devices["Pixel 7"]}},
  ],
  webServer:{
    command:"npm start",
    url:"http://127.0.0.1:3000",
    reuseExistingServer:!process.env.CI,
    timeout:120_000,
  },
});
