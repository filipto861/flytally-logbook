import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.0 U4 makes Save hand off directly to final Logbook review",()=>{
  const actions=read("app/(protected)/flights/actions.ts"),page=read("app/(protected)/flights/new/page.tsx"),form=read("components/flight-form.tsx"),panel=read("components/intelligent-flight-entry-panel.tsx");
  assert.match(actions,/redirect\(String\(form\.get\("intent"\)\)==="another"\?"\/flights\/new\?added=1":`\/flights\/\$\{id\}\?tab=logbook&saved=1`\)/);
  assert.match(actions,/redirect\(`\/flights\/\$\{lastId\}\?tab=logbook&saved=1`\)/);
  assert.match(page,/takes you to review before certification/);
  assert.match(form,/editing\?"Save changes":"Save & review"/);
  assert.doesNotMatch(panel,/POST_SAVE_REVIEW_KEY|sessionStorage/);
});

test("v3.0 U4 shows one durable Saved Review Certify Share progression",()=>{
  const workflow=read("components/flight-workflow-progress.tsx"),detail=read("components/flight-detail-workspace.tsx"),page=read("app/(protected)/flights/[id]/page.tsx");
  assert.match(workflow,/stage\("Saved"/);
  assert.match(workflow,/stage\("Review"/);
  assert.match(workflow,/stage\("Certify"/);
  assert.match(workflow,/stage\("Share"/);
  assert.match(workflow,/Continue to certification/);
  assert.match(workflow,/className="primary-button" href=\{state\.shareHref\}>Share flight/);
  assert.doesNotMatch(detail,/flight-share-shortcut/);
  assert.doesNotMatch(page,/certified\?<Link className="secondary-link" href=\{`\/flights\/\$\{id\}\/share`\}>Share<\/Link>/);
  assert.match(detail,/FlightWorkflowProgress/);
  assert.doesNotMatch(detail,/Flight saved as an editable draft/);
  assert.match(detail,/history\.replaceState/);
  assert.match(page,/workflow=\{certified,correctionDraft,locked,blockers:blockers\.length,recordRevision,shareHref:/);
  assert.match(page,/postSave=\{context\.saved==="1"\}/);
  assert.doesNotMatch(detail,/↗ Share flight/);
});

test("v3.0 U4 keeps certification explicit and blocks sharing until the record is certified",()=>{
  const page=read("app/(protected)/flights/[id]/page.tsx"),sharing=read("lib/flight-sharing.ts"),sharePage=read("app/(protected)/flights/[id]/share/page.tsx");
  assert.match(page,/name="confirm" value="certify"/);
  assert.match(page,/disabled=\{easa&&blockers\.length>0\}/);
  assert.match(sharing,/WHERE id=\$\{flightId\} AND user_id=\$\{userId\} AND certified_at IS NOT NULL/);
  assert.match(sharing,/s\.revoked_at IS NULL AND f\.certified_at IS NOT NULL/);
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

test("v3.0 U4 ships responsive light-theme workflow UI and advances roadmap to U5",()=>{
  const layout=read("app/layout.tsx"),css=read("app/v300-u4-flight-workflow.css"),roadmap=read("ROADMAP.md"),audit=read("docs/product/V3_0_UX_CONSOLIDATION.md");
  assert.match(layout,/v300-u4-flight-workflow\.css/);
  assert.match(css,/flight-workflow-steps/);
  assert.match(css,/html\[data-theme="light"\] \.flight-workflow/);
  assert.match(css,/@media\(max-width:520px\)/);
  assert.match(roadmap,/U4 ✅ flight save → review → certify → share clarity/);
  assert.match(roadmap,/U5 ✅ Training learner polish/);
  assert.match(roadmap,/U6 ✅ mobile, accessibility and final UX acceptance/);
  assert.match(audit,/U4 ✅ Flight workflow clarity/);
  assert.match(audit,/U5 ✅ Training learner polish/);
  assert.match(audit,/U6 ✅ Mobile, accessibility and final UX acceptance/);
});


test("GPS player keeps the useful 2D replay and removes the fake 3D projection",()=>{
  const player=read("components/flight-track-player.tsx");
  assert.match(player,/Synchronized GPS track map/);
  assert.match(player,/Track position/);
  assert.match(player,/Playback speed/);
  assert.doesNotMatch(player,/3D flight path/);
  assert.doesNotMatch(player,/Perspective three dimensional flight path/);
  assert.doesNotMatch(player,/GPS altitude perspective/);
  assert.doesNotMatch(player,/function scene\(/);
});
