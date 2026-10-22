import { defineConfig } from "@playwright/test";
import standard from "./playwright.config.mjs";

// Dedicated destructive U3 acceptance. Not part of the frozen generic E2E suite.
// Point DATABASE_URL only at the independently verified disposable local U3 cluster.
export default defineConfig({
  ...standard,
  testDir:"./tooling/u3-browser",
  testMatch:"**/aircraft-delete-focus.spec.mjs",
  testIgnore:[],
  projects:standard.projects.filter(project=>project.name==="desktop-chromium"),
  webServer:{...standard.webServer,reuseExistingServer:false},
  retries:0,
  workers:1,
});
