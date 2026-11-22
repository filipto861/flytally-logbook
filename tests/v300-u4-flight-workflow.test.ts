import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.0 U4 makes Save hand off directly to final Logbook review",()=>{
  const actions=read("app/(protected)/flights/actions.ts"),page=read("app/(protected)/flights/new/page.tsx"),form=read("components/flight-form.tsx"),panel=read("components/intelligent-flight-entry-panel.tsx");
  assert.match(actions,/intent=String\(form\.get\("intent"\)\|\|"draft"\)/);assert.match(actions,/if\(intent==="certify"\)/);assert.match(actions,/redirect\(`\/flights\/\$\{id\}\?certified=1`\)/);
  assert.match(actions,/`\/flights\/\$\{id\}\?tab=logbook&saved=1`/);
  assert.match(actions,/if\(completionIntent==="certify"&&prepared\.length===1\)/);assert.match(actions,/redirect\(`\/flights\/\$\{lastId\}\?certified=1`\)/);assert.match(actions,/redirect\(`\/flights\/\$\{lastId\}\?tab=logbook&saved=1`\)/);
  assert.doesNotMatch(page,/takes you to review before certification/);
  assert.match(form,/Save draft keeps the record editable/);
  assert.match(form,/Save &amp; certify flight/);
  assert.doesNotMatch(panel,/POST_SAVE_REVIEW_KEY|sessionStorage/);
});

test("v3.0 U4 keeps certification explicit and blocks sharing until the record is certified",()=>{
  const page=read("app/(protected)/flights/[id]/page.tsx"),sharePage=read("app/(protected)/flights/[id]/share/page.tsx");
  assert.match(page,/name="confirm" value="certify"/);
  assert.match(page,/disabled=\{certificationBlockers\.length>0\}/);
  // The sharing SQL itself runs in tests/integration/postgres-public-flight-share.test.ts.
  assert.match(sharePage,/if\(!f\.certified_at\)return/);
  assert.match(sharePage,/Certify the final record first/);
  assert.match(sharePage,/SHARE CERTIFIED R/);
});

test("v3.0 U4 invalidates public sharing when a certified record is opened for correction",()=>{
  const certification=read("app/(protected)/flights/certification-actions.ts");
  const correction=certification.slice(certification.indexOf("export async function startCertifiedCorrection"));
  assert.match(certification,/import \{ ensureFlightSharingSchema \} from "@\/lib\/flight-sharing"/);
  assert.match(correction,/ensureFlightSharingSchema\(\)/);
  assert.match(correction,/UPDATE flight_public_shares SET revoked_at=NOW\(\)/);
  assert.match(correction,/record_revision=COALESCE\(record_revision,1\)\+1/);
  assert.match(correction,/certified_at=NULL/);
});

test("v3.0 U4 preserves correction history and crew sharing semantics",()=>{
  const page=read("app/(protected)/flights/[id]/page.tsx"),certification=read("app/(protected)/flights/certification-actions.ts");
  assert.match(page,/Correct flight/);
  assert.match(page,/Crew & logbook sharing/);
  assert.match(page,/Invite another connected pilot/);
  assert.match(certification,/INSERT INTO flight_certified_revisions/);
  assert.match(certification,/status='superseded'/);
});

test("flight correction cannot discard a dirty edit by switching workflow tabs without confirmation",()=>{
  const workspace=read("components/flight-detail-workspace.tsx");
  const form=read("components/flight-form.tsx");
  assert.match(workspace,/FlightEditContext\.Provider/);
  assert.match(workspace,/if\(value===tab\)return true/);
  assert.match(workspace,/if\(submitting\)return false/);
  assert.match(workspace,/if\(unsaved&&!window\.confirm\([^\n]+\)\)return false/);
  assert.match(workspace,/if\(selectTab\(nextTab\)\)document\.getElementById\(`flight-tab-\$\{nextTab\}`\)\?\.focus\(\)/);
  assert.match(workspace,/unsaved&&!window\.confirm\("You have unsaved flight changes\. Switch tabs and discard them\?"\)/);
  assert.match(workspace,/if\(unsaved\)setUnsaved\(false\)/);
  assert.match(form,/useFlightEditState\(\)/);
  assert.match(form,/onChangeCapture=\{markFormDirty\}/);
  assert.match(form,/onSubmitCapture=\{beginFormSubmit\}/);
  assert.match(form,/flightEdit\?\.setUnsaved\(true\)/);
  assert.match(form,/flightEdit\?\.setSubmitting\(true\)/);
  assert.match(form,/if\(dirty\)flightEdit\?\.setUnsaved\(true\)/);
});

