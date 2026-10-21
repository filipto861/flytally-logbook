import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const workspace=readFileSync(new URL("../components/flight-detail-workspace.tsx",import.meta.url),"utf8");
const browser=readFileSync(new URL("../e2e/manual-authority-certification.spec.mjs",import.meta.url),"utf8");

test("flight detail keyboard focus moves only when tab switch is accepted",()=>{
  assert.match(workspace,/const selectTab=\(value:Tab\):boolean=>\{/);
  assert.match(workspace,/if\(value===tab\)return true;/);
  assert.match(workspace,/if\(submitting\)return false;/);
  assert.match(workspace,/if\(unsaved&&!window\.confirm\("You have unsaved flight changes\. Switch tabs and discard them\?"\)\)return false;/);
  assert.match(workspace,/if\(unsaved\)setUnsaved\(false\);\s*setTab\(value\);\s*return true;/);
  assert.match(workspace,/if\(selectTab\(nextTab\)\)document\.getElementById\(`flight-tab-\$\{nextTab\}`\)\?\.focus\(\)/);
  assert.doesNotMatch(workspace,/selectTab\(nextTab\);document\.getElementById/);
});

test("browser acceptance dismisses keyboard-switch dialog without moving focus or altering correction",()=>{
  assert.match(browser,/activeLogbookTab\.press\("ArrowLeft"\)/);
  assert.match(browser,/cancelledKeyboardSwitch=page\.waitForEvent\("dialog"\)/);
  assert.match(browser,/await expect\(activeLogbookTab\)\.toBeFocused\(\)/);
  assert.match(browser,/await expect\(activeLogbookTab\)\.toHaveAttribute\("aria-selected","true"\)/);
  assert.match(browser,/await expect\(revisionForm\.locator\('input\[name="arrival"\]'\)\)\.toHaveValue\("LKMT"\)/);
});

test("certification E2E synchronizes on redirects before success and retained R2 evidence",()=>{
  // This test is source evidence only. The real browser assertion must still run.
  assert.ok(browser.includes('await expect(page).toHaveURL(/\\/flights\\/\\d+(?:\\?.*)?$/,{timeout:20_000});'));
  assert.ok(browser.includes('await expect(page.getByText("Flight saved and certified.")).toBeVisible({timeout:20_000});'));
  assert.ok(browser.includes('await expect(page.locator(".flight-lock-badge")).toContainText("CERTIFIED R1");'));
  assert.ok(browser.includes('await expect(page.locator(".flight-lock-badge")).toContainText("CERTIFIED R2");'));
});
