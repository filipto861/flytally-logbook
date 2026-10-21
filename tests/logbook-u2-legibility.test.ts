import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const css=readFileSync(new URL("../app/ui-system.css",import.meta.url),"utf8");
const globalCss=readFileSync(new URL("../app/globals.css",import.meta.url),"utf8");
const browser=readFileSync(new URL("../e2e/logbook-u2-legibility.spec.mjs",import.meta.url),"utf8");
const layout=readFileSync(new URL("../app/layout.tsx",import.meta.url),"utf8");
const profile=readFileSync(new URL("../app/(protected)/profile/page.tsx",import.meta.url),"utf8");
const flight=readFileSync(new URL("../components/flight-form.tsx",import.meta.url),"utf8");

test("U2 typography is scoped to New Flight and Settings, without changing global Required hints",()=>{
  const block=css.split("/* Logbook U2 — observed secondary-copy legibility.")[1];
  assert.ok(block,"U2 override block must be present.");
  assert.match(block,/\.flight-entry-workspace \.field-hint,\s*\.u33-settings-workspace \.field-hint\s*\{\s*font-size:\.75rem;/);
  for(const selector of [
    ".flight-entry-workspace .entry-context-note",
    ".flight-entry-workspace .optional-detail-note",
    ".flight-entry-workspace .optional-detail-heading small",
    ".flight-entry-workspace .entry-certification-grid>div>span",
    ".flight-entry-workspace .entry-certification-grid>div>small",
  ])assert.ok(block.includes(selector),selector);
  assert.equal((block.match(/font-size:\.75rem;/g)||[]).length,2);
  assert.doesNotMatch(block, /!important|background:|color:|min-height:|min-width:|padding:|position:/);
  assert.ok(globalCss.includes("label>small,.field-hint{font-size:.65rem;font-weight:520}"));
  assert.match(layout,/import "\.\/ui-system\.css";/);
  assert.ok(profile.includes('className="u33-settings-workspace"'));
  assert.ok(flight.includes('className="entry-context-note"'));
});

test("U2 browser acceptance retains strict disposable DB opt-in and exact visual matrix",()=>{
  for(const literal of [
    'FLYTALLY_U2_LEGIBILITY_BROWSER==="1"',
    'FLYTALLY_AUTH_BROWSER==="1"',
    'FLYTALLY_LOCAL_POSTGRES==="1"',
    'u.port==="5433"',
    'u.pathname==="/flytally_ui_u0_20261021"',
    'u.username==="flytally_ui_u0_20261021"',
    'test.setTimeout(10*60_000)',
    'expect(reading.size',
    'toBeGreaterThanOrEqual(12)',
    'toBeLessThanOrEqual(1)',
    'expect(results).toHaveLength(20)',
  ])assert.ok(browser.includes(literal),literal);
  for(const name of ["desktop","ipad-landscape","ipad-portrait","mobile","mobile-narrow"])
    assert.ok(browser.includes(`name:"${name}"`),name);
  for(const theme of ["light","dark"])assert.ok(browser.includes(`"${theme}"`),theme);
  assert.ok(browser.includes("NOT native Safari/iPadOS"));
});

test("U2 browser explicitly opens the native Flight experience disclosure before sampling context copy",()=>{
  assert.ok(browser.includes('import {ensureDetailsOpen} from "./browser-actions.mjs";'));
  const selected=browser.indexOf('await registration.selectOption("OK-SP2E")');
  const experience=browser.indexOf('const experience=page.locator("form.flight-form details.entry-section-experience")');
  const opened=browser.indexOf("await ensureDetailsOpen(experience)");
  const visible=browser.indexOf('await expect(page.locator(".entry-context-note")).toBeVisible()');
  const optional=browser.indexOf("await ensureDetailsOpen(optionalDetails)");
  const measured=browser.indexOf('await checkLegibility(page,".flight-entry-workspace .entry-context-note")');
  assert.ok(selected>=0&&selected<experience&&experience<opened&&opened<visible&&visible<optional&&optional<measured,
    "Do not require visibility for a note inside a closed details element; open the native disclosure first.");
  assert.ok(browser.includes('await checkLegibility(page,".flight-entry-workspace .optional-detail-heading small")'));
});

test("U2 browser waits for actual client hydration and strict seeded aircraft state",()=>{
  const goto=browser.indexOf('await page.goto("/flights/new?mode=manual"');
  const gpsClick=browser.indexOf("await gpsMode.click()");
  const gpsState=browser.indexOf('await expect(gpsMode).toHaveAttribute("aria-pressed","true"');
  const manualClick=browser.indexOf("await manualMode.click()");
  const manualState=browser.indexOf('await expect(manualMode).toHaveAttribute("aria-pressed","true"');
  const select=browser.indexOf('await registration.selectOption("OK-SP2E")');
  const controlled=browser.indexOf('await expect(registration).toHaveValue("OK-SP2E")');
  const category=browser.indexOf('await expect(form).toHaveAttribute("data-aircraft-category",/^(?!unselected$).+/)');
  const opened=browser.indexOf("await ensureDetailsOpen(experience)");
  assert.ok(goto>=0&&goto<gpsClick&&gpsClick<gpsState&&gpsState<manualClick
    &&manualClick<manualState&&manualState<select&&select<controlled
    &&controlled<category&&category<opened,"Browser must verify hydration and controlled aircraft state before disclosure.");
  assert.ok(browser.includes('expect(available,"Missing canonical synthetic OK-SP2E aircraft").toContain("OK-SP2E")'));
  assert.ok(browser.includes('experience.locator(".entry-context-note")'));
  assert.ok(browser.includes("selectedRegistration:choice?.value"));
  assert.ok(browser.includes("noteCount:details?.querySelectorAll"));
  assert.doesNotMatch(browser,/selectOption\(available\.includes\("OK-SP2E"\)\?/);
});
