import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.2 U7 brings remaining core routes onto the canonical page stack",()=>{
  const routes=[
    "app/(protected)/statistics/page.tsx",
    "app/(protected)/credentials/page.tsx",
    "app/(protected)/map/page.tsx",
    "app/(protected)/fstd/page.tsx",
    "app/(protected)/actions/page.tsx",
    "app/(protected)/notifications/page.tsx",
    "app/(protected)/flights/new/page.tsx",
  ];
  for(const route of routes)assert.match(read(route),/ui-page-stack/,route);
  const css=read("app/ui-system.css");
  for(const selector of [".period-control",".metric-grid",".flight-summary",".saved-next-flight",".map-panel"])assert.ok(css.includes(selector),selector);
  assert.match(css,/page-header > \.connection-actions/);
});

test("v3.2 U7 gives FSTD mutations explicit pending feedback",()=>{
  const source=read("app/(protected)/fstd/page.tsx");
  assert.match(source,/PendingActionButton/);
  for(const label of ["Saving…","Opening…","Certifying…","Deleting…"])assert.ok(source.includes(`pendingLabel="${label}"`),label);
  assert.doesNotMatch(source,/<button className="primary-button">Save FSTD session<\/button>/);
});

test("v3.2 U7 gives action and notification mutations explicit pending feedback",()=>{
  const actions=read("app/(protected)/actions/page.tsx");
  const notifications=read("app/(protected)/notifications/page.tsx");
  for(const source of [actions,notifications])assert.match(source,/PendingActionButton/);
  for(const label of ["Accepting…","Declining…"])assert.ok(actions.includes(`pendingLabel="${label}"`),label);
  for(const label of ["Marking…","Clearing…","Declining…","Deleting…"])assert.ok(notifications.includes(`pendingLabel="${label}"`),label);
});

test("v3.2 U7 converges remaining high-frequency async actions on the shared loading contract",()=>{
  for(const file of ["components/flight-form.tsx","components/kml-import-form.tsx","components/backup-center.tsx"]){
    assert.match(read(file),/PendingActionButton/,file);
  }
  for(const file of ["components/backup-restore.tsx","components/flight-trash.tsx","components/quick-aircraft-form.tsx","components/push-notification-controls.tsx"]){
    const source=read(file);
    assert.match(source,/aria-busy=/,file);
    assert.match(source,/data-loading=/,file);
  }
});



test("v3.3 design batch 1 converges canonical geometry without changing the card-radius token",()=>{
  const ui=read("app/ui-system.css");
  const globals=read("app/globals.css");
  const adaptive=read("app/v160-adaptive-pilot-workspace.css");
  const recency=read("app/v250-recency-workspace.css");

  assert.match(ui,/--ui-radius-card:17px/);
  assert.match(globals,/\.page-header \{[^}]*margin-bottom:var\(--ui-section-gap\)/);
  assert.match(globals,/\.metric-grid \{[^}]*gap:var\(--ui-card-gap\)[^}]*margin-bottom:var\(--ui-section-gap\)/);
  assert.match(globals,/\.panel \{ padding:var\(--ui-card-padding\); \}/);
  assert.match(globals,/\.flight-form \{ display:grid;gap:var\(--ui-section-gap\); \}/);
  assert.match(globals,/\.form-grid \{[^}]*gap:var\(--ui-card-gap\)/);

  for(const source of [adaptive,recency]){
    assert.doesNotMatch(source,/font-size:(?:10|11|12|13|15)px/);
    assert.doesNotMatch(source,/border-radius:18px/);
  }
  assert.match(adaptive,/\.adaptive-workspace\{display:grid;gap:var\(--ui-card-gap\)/);
  assert.match(recency,/\.compliance-workspace\{display:grid;gap:var\(--ui-card-gap\)/);
  assert.match(recency,/box-shadow:var\(--shadow-soft\)/);
});

test("v3.3 design batch 1 centralizes recurring light compatibility colors",()=>{
  const colors=read("app/v150-ui-system.css");
  const theme=read("app/theme.css");
  const interactions=read("app/light-interactions.css");

  assert.match(colors,/--light-surface-hover-strong:#eef4f8/);
  assert.match(colors,/--light-border-hover-subtle:#b8c9d7/);
  assert.doesNotMatch(theme,/--panel:#ffffff/);
  for(const source of [theme,interactions]){
    assert.doesNotMatch(source,/#eef4f8(?![0-9a-f])/i);
    assert.doesNotMatch(source,/#f3f7fa(?![0-9a-f])/i);
    assert.doesNotMatch(source,/#b8c9d7(?![0-9a-f])/i);
  }
});

test("v3.3 design batch 1 standardizes motion and tabular figures",()=>{
  const globals=read("app/globals.css");
  const dashboard=read("app/v138-dashboard-insights.css");
  const credentials=read("app/v146-credentials.css");
  const sharing=read("app/v300-aircraft-sharing.css");
  const ui=read("app/ui-system.css");
  const stats=read("app/(protected)/statistics/page.tsx");

  assert.match(globals,/transition:width \.14s ease/);
  assert.match(globals,/transition:transform \.08s linear/);
  assert.doesNotMatch(dashboard,/\.15s ease/);
  assert.doesNotMatch(credentials,/\.15s ease/);
  assert.doesNotMatch(sharing,/\.16s ease/);
  for(const selector of [".time-pair",".pagination",".page-number-list",".track-stats",".rate-history-row",".numeric-table"])assert.ok(ui.includes(selector),selector);
  assert.match(stats,/className="numeric-table"/);
});


test("v3.3 design batch 2 hardens light normal-text contrast without changing brand fills",()=>{
  const theme=read("app/theme.css");
  const colors=read("app/v150-ui-system.css");

  assert.match(colors,/--accent:#0b946e/);
  assert.match(colors,/--accent2:#087fb8/);
  assert.match(theme,/\.eyebrow,[\s\S]*color:var\(--accent-strong\)/);
  assert.match(theme,/\.pagination a,[\s\S]*color:var\(--link\)/);
  assert.match(theme,/\.page-header \.muted,[\s\S]*color:var\(--text-soft\)/);
  assert.match(theme,/sidebar-sub-link\.active\{background:#edf4f8;color:var\(--link\);border-left-color:var\(--accent2\)\}/);
  assert.match(theme,/leaflet-control-attribution a\{color:var\(--link\)!important\}/);
  assert.match(theme,/entry-progress>span\.active\{background:#e6f3f9;color:var\(--link\)\}/);
});

test("v3.3 design batch 2 removes compounded footer opacity",()=>{
  const shell=read("components/app-shell.tsx");
  const legal=read("components/legal-footer.tsx");

  for(const source of [shell,legal]){
    assert.match(source,/color:"var\(--text-soft\)"/);
    assert.match(source,/opacity:1/);
    assert.doesNotMatch(source,/color:"var\(--muted\)",opacity:\.72/);
  }
});

test("v3.3 design batch 2 makes the legacy GPS profile use theme chart tokens",()=>{
  const profile=read("components/track-profile.tsx");

  assert.match(profile,/stopColor="var\(--chart-primary\)"/);
  assert.match(profile,/stopColor="var\(--chart-secondary\)"/);
  assert.match(profile,/stroke="var\(--chart-primary\)"/);
  assert.match(profile,/stroke="var\(--chart-cursor\)"/);
  assert.doesNotMatch(profile,/#38bdf8|#34d399|#f8fafc/i);
});


test("v3.3 design batch 3 uses only the approved NavIcon SVG contract for audited UI icons",()=>{
  const nav=read("components/nav-icon.tsx");
  assert.match(nav,/viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1\.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"/);
  for(const expected of [
    'close:<><path d="M6 6l12 12M18 6 6 18"/></>',
    'play:<><path d="m8 5 11 7-11 7z"/></>',
    'pause:<><path d="M9 5v14M15 5v14"/></>',
    'check:<><path d="m5 12 4 4L19 6"/></>',
    'warning:<><path d="M12 3 2.8 20h18.4z"/><path d="M12 9v4M12 17h.01"/></>',
  ])assert.ok(nav.includes(expected),expected);
  assert.doesNotMatch(nav,/(?:fill|stroke)="(?:#|rgb|hsl)/i);

  const audited=[
    "components/push-notification-controls.tsx",
    "components/flight-entry-workspace.tsx",
    "components/gps-import-review-player.tsx",
    "components/flight-track-player.tsx",
    "components/backup-validator.tsx",
    "components/monthly-chart.tsx",
  ];
  for(const file of audited){
    const source=read(file);
    for(const glyph of ["🔔","🔕","✈","✓","⚠","▶","❚","＋"])assert.ok(!source.includes(glyph),`${file}: ${glyph}`);
    assert.doesNotMatch(source,/>\s*×\s*</,`${file}: icon-only multiplication glyph`);
  }
});

test("v3.3 design batch 3 keeps icon-only controls accessible and shares the aircraft marker",()=>{
  const entry=read("components/flight-entry-workspace.tsx");
  const importPlayer=read("components/gps-import-review-player.tsx");
  const player=read("components/flight-track-player.tsx");
  const marker=read("components/aircraft-marker.ts");

  assert.match(entry,/aria-label="Close"[^>]*><NavIcon name="close"\/>/);
  for(const source of [importPlayer,player]){
    assert.match(source,/aria-label=\{playing\?"Pause track":"Play track"\}/);
    assert.match(source,/<NavIcon name=\{playing\?"pause":"play"\}\/>/);
    assert.match(source,/createAircraftMarkerIcon\(\)/);
    assert.match(source,/rotateAircraftMarker\(/);
  }
  assert.match(marker,/width="34" height="34"/);
  assert.match(marker,/iconSize:\[34,34\],iconAnchor:\[17,17\]/);
  assert.match(importPlayer,/rotateAircraftMarker\(markerRef\.current,current\.bearing,\{smooth:true\}\)/);
  assert.match(player,/rotateAircraftMarker\(markerRef\.current,current\.bearing\)/);
});


test("v3.3 design batch 4 moves audited legacy mutations onto PendingActionButton",()=>{
  const files:Record<string,string[]>={
    "app/(protected)/flights/[id]/page.tsx":["cancelApproval","requestApproval","cancelCrew","inviteCrew"],
    "app/(protected)/credentials/legacy-page.tsx":["savePilotLicence","saveQualification","archivePilotCredential","addQualification","addPilotLicence","saveDocumentCredential","toggleExpiry","deleteExpiry","addDocumentCredential"],
    "components/aircraft-qualifications-section.tsx":["saveAircraftQualification","cancelAircraftQualificationSignature","requestAircraftQualificationSignature","archiveAircraftQualification","addAircraftQualification"],
    "components/recency-panel.tsx":["saveRecencyMonitors","deleteRecencyRule","deleteRecencyEvidence","addRecencyEvidence","addRecencyRule"],
    "components/spl-recency-panel.tsx":["addSplProficiencyEvidence","deleteSplProficiencyEvidence"],
    "components/helicopter-recency-panel.tsx":["addHelicopterProficiencyEvidence","deleteHelicopterProficiencyEvidence"],
    "components/balloon-recency-panel.tsx":["addBalloonProficiencyEvidence","deleteBalloonProficiencyEvidence"],
  };
  for(const [file,actions] of Object.entries(files)){
    const source=read(file);
    assert.match(source,/PendingActionButton/,file);
    for(const action of actions){
      const start=source.indexOf(`<form action={${action}}`);
      assert.ok(start>=0,`${file}: ${action}`);
      const end=source.indexOf("</form>",start);
      assert.ok(end>start,`${file}: ${action} closing form`);
      assert.match(source.slice(start,end),/<PendingActionButton/,`${file}: ${action}`);
    }
  }
  const joined=Object.keys(files).map(read).join("\n");
  for(const label of ["Saving…","Archiving…","Removing…","Requesting…","Cancelling…","Adding…"])assert.ok(joined.includes(`current="${label}"`),label);
  const stable=read("components/pending-action-label.tsx");
  assert.match(stable,/pending-action-label-reserve/);
  assert.match(stable,/aria-hidden="true"/);
  assert.match(read("app/ui-system.css"),/\.pending-action-label-reserve\{visibility:hidden;pointer-events:none\}/);
});

test("v3.3 design batch 4 announces the four audited async result messages",()=>{
  for(const file of ["components/airport-detection-control.tsx","components/backup-center.tsx","components/flight-trash.tsx","components/track-manager.tsx"]){
    const source=read(file);
    assert.match(source,/className="form-error" role="alert"/,file);
    assert.match(source,/className="form-success" role="status"/,file);
  }
});

test("v3.3 design batch 4 keeps only compact and full empty-state patterns",()=>{
  const roots=["app","components"];
  const sourceFiles:string[]=[];
  const walk=(dir:string)=>{
    for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
      const rel=path.join(dir,entry.name);
      if(entry.isDirectory())walk(rel);
      else if(/\.(?:tsx|css)$/.test(entry.name))sourceFiles.push(rel);
    }
  };
  roots.forEach(walk);
  const allowed=new Set(["empty-state","flight-empty-state"]);
  for(const file of sourceFiles){
    const source=read(file);
    const names=source.match(/[A-Za-z0-9-]*empty-state[A-Za-z0-9-]*/g)??[];
    for(const name of names)assert.ok(allowed.has(name),`${file}: unexpected empty-state variant ${name}`);
  }
  const globals=read("app/globals.css");
  assert.match(globals,/\.empty-state \{/);
  assert.match(globals,/\.flight-empty-state\{/);
  assert.match(globals,/\.flight-empty-state h2,\.flight-empty-state h3/);
});

test("v3.3 design batch 4 removes photo-only aircraft elevation",()=>{
  const sharing=read("app/v300-aircraft-sharing.css");
  assert.doesNotMatch(sharing,/\.aircraft-card\.with-photo/);
  assert.match(sharing,/\.aircraft-card\{[^}]*align-self:stretch;[^}]*height:100%/);
});


test("v3.3 design batch 5 gives the aircraft photo editor the established modal focus lifecycle",()=>{
  const source=read("components/aircraft-photo-editor.tsx");
  assert.match(source,/cropOpener=useRef<HTMLElement\|null>/);
  assert.match(source,/cropClose=useRef<HTMLButtonElement\|null>/);
  assert.match(source,/requestAnimationFrame\(\(\)=>cropClose[.]current[?][.]focus\(\)\)/);
  assert.match(source,/event[.]key==="Escape"\)\{event[.]preventDefault\(\);cancelCover\(\);return\}/);
  assert.match(source,/event[.]key!=="Tab"\|\|!cropDialog[.]current/);
  assert.match(source,/event[.]shiftKey&&document[.]activeElement===first/);
  assert.match(source,/document[.]activeElement===last/);
  assert.match(source,/cropOpener[.]current=event[.]currentTarget/);
  assert.match(source,/requestAnimationFrame\(\(\)=>cropOpener[.]current[?][.]focus\(\)\)/);
});

test("v3.3 design batch 5 implements roving keyboard behavior for flight detail tabs",()=>{
  const source=read("components/flight-detail-workspace.tsx");
  assert.match(source,/const TABS:Tab\[\]=\["overview","gps","logbook"\]/);
  assert.match(source,/tabIndex=\{tab===value[?]0:-1\}/);
  for(const key of ["ArrowRight","ArrowLeft","Home","End"])assert.ok(source.includes(`event.key==="${key}"`),key);
  assert.match(source,/\(current\+1\)%TABS[.]length/);
  assert.match(source,/\(current-1\+TABS[.]length\)%TABS[.]length/);
  assert.match(source,/document[.]getElementById\(`flight-tab-\$\{nextTab\}`\)[?][.]focus\(\)/);
  assert.match(source,/aria-controls=\{`flight-panel-\$\{value\}`\}/);
  assert.match(source,/aria-labelledby=\{`flight-tab-\$\{tab\}`\}/);
});

test("v3.3 design batch 5 gives audited icon-only coarse-pointer controls a 44px logical minimum",()=>{
  const source=read("app/v300-u6-acceptance.css");
  const rule=/:where\(\.mobile-toggle,\.sidebar-toggle,\.modal-close,\.aircraft-crop-close,\.play-button,\.sidebar-brand a\[aria-label\^="Notifications"\]\)\{min-inline-size:44px\}/;
  assert.match(source,rule);
  assert.match(source,/@media \(max-width:820px\),\(pointer:coarse\)\{/);
});

test("v3.3 design batch 5 restores the canonical focus contract for both audited outliers",()=>{
  const globals=read("app/globals.css");
  const canonical=read("app/v150-ui-system.css");
  const publicViewer=read("app/v301-public-flight-viewer.css");
  assert.doesNotMatch(globals,/\.aircraft-catalog-results button:focus[^\{]*\{[^}]*outline:none/);
  assert.match(globals,/\.aircraft-catalog-results button:hover\{background:var\(--panel2\)\}/);
  assert.match(canonical,/:where\(a,button,input,select,textarea,summary,\[tabindex\]\):focus-visible\{outline:2px solid var\(--focus-color\);outline-offset:2px;box-shadow:var\(--focus-ring\)\}/);
  assert.match(publicViewer,/\.public-flight-theme-toggle button:focus-visible\{outline:2px solid var\(--focus-color\);outline-offset:2px\}/);
});


test("v3.3 design batch 6 marks native-required controls only in mixed forms",()=>{
  const cue='<span className="field-hint" aria-hidden="true">Required</span>';
  const checks:Record<string,string[]>={
    "app/(protected)/credentials/legacy-page.tsx":["Licence","Licence number","Qualification","Document"],
    "app/(protected)/database/page.tsx":["Code"],
    "app/(protected)/fstd/page.tsx":["Date","Device type","Qualification number","Total session time","FSTD instruction / exercise","Instruction"],
    "app/(protected)/profile/page.tsx":["Name"],
    "components/aircraft-manager.tsx":["Registration","Balloon class","Hot-air group","New rate CZK/h","Valid from"],
    "components/aircraft-qualifications-section.tsx":["Completed on","Connected signer"],
    "components/aircraft-share-panel.tsx":["Pilot"],
    "components/auth-invite-creator.tsx":["Tester email"],
    "components/balloon-recency-panel.tsx":["Balloon class","Date","Examiner","Reference"],
    "components/flight-expenses-editor.tsx":["Amount","Currency"],
    "components/flight-form.tsx":["Date","Registration","Role","Balloon operation","Launch method","Launches","Supervising PIC / FI","Countersignature reference","Logbook","Class / category","Billing time"],
    "components/helicopter-recency-panel.tsx":["Helicopter type","Date","Examiner","Reference"],
    "components/in-person-signature-pad.tsx":["Licence number","Qualification"],
    "components/kml-import-form.tsx":["KML, GPX or CSV","Registration","Balloon operation","Date"],
    "components/quick-aircraft-form.tsx":["Registration"],
    "components/recency-panel.tsx":["Date","Examiner / instructor","Certificate / reference","Rule name","Rolling window","Target"],
    "components/spl-recency-panel.tsx":["Date","Examiner / FE(S)","Reference"],
    "components/track-manager.tsx":["KML, GPX or CSV"],
  };
  for(const [file,labels] of Object.entries(checks)){
    const source=read(file);
    for(const label of labels)assert.ok(source.includes(`${label} ${cue}`),`${file}: ${label}`);
  }

  const picker=read("components/aircraft-type-picker.tsx");
  assert.match(picker,/<span>Make \{requireMake\?<span className="field-hint" aria-hidden="true">Required<\/span>:null\}<\/span>/);
  assert.match(picker,/<span>Aircraft type \/ model \{requireModel\?<span className="field-hint" aria-hidden="true">Required<\/span>:null\}<\/span>/);
  const expenses=read("components/flight-expenses-editor.tsx");
  assert.match(expenses,/<span>Description \{row\.category==="OTHER"\?<span className="field-hint" aria-hidden="true">Required<\/span>:null\}<\/span>/);
  const flight=read("components/flight-form.tsx");
  assert.match(flight,/<span>Instructor \/ PIC \{evidence==="EASA"\?<span className="field-hint" aria-hidden="true">Required<\/span>:null\}<\/span>/);
  assert.match(flight,/<span>\{role==="SAFETY PILOT"\?"Actual PIC":"Commander \/ PIC"\} \{evidence==="EASA"&&role==="SAFETY PILOT"\?<span className="field-hint" aria-hidden="true">Required<\/span>:null\}<\/span>/);
  const signature=read("components/in-person-signature-pad.tsx");
  assert.match(signature,/<span>\{allowExaminer\?"Instructor \/ examiner name":"Instructor name"\} <span className="field-hint" aria-hidden="true">Required<\/span><\/span>/);
  assert.match(signature,/confirm_in_person" value="yes" required\/><span>[^<]*<span className="field-hint" aria-hidden="true">Required<\/span><\/span>/);

  const joined=Object.keys(checks).map(read).join("\n")+"\n"+picker+"\n"+expenses+"\n"+signature;
  const requiredCueCount=(joined.match(/>Required<\/span>/g)??[]).length;
  const validCueCount=(joined.match(/<span className="field-hint" aria-hidden="true">Required<\/span>/g)??[]).length;
  assert.equal(requiredCueCount,validCueCount,"every Required cue must use field-hint and aria-hidden");
});

test("v3.3 design batch 6 keeps Required cues beside label text without adding layout CSS",()=>{
  const roots=["app","components"],files:string[]=[];
  const walk=(dir:string)=>{for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const rel=path.join(dir,entry.name);if(entry.isDirectory())walk(rel);else if(entry.name.endsWith(".tsx"))files.push(rel)}};
  roots.forEach(walk);
  for(const file of files){
    const source=read(file);
    if(!source.includes('className="field-hint" aria-hidden="true">Required'))continue;
    assert.doesNotMatch(source,/<label[^>]*>[^<{]*<span className="field-hint" aria-hidden="true">Required<\/span><(?:input|select|textarea)/,file);
  }
});

test("v3.3 design batch 6 leaves required-only and optional-only forms without Required cues",()=>{
  const cue=/field-hint" aria-hidden="true">Required/;
  for(const file of [
    "app/forgot-password/forgot-form.tsx",
    "app/login/login-form.tsx",
    "app/reset-password/reset-form.tsx",
    "app/join/join-form.tsx",
    "app/(protected)/connections/aircraft-training/[id]/page.tsx",
    "app/(protected)/connections/flight/[id]/page.tsx",
    "app/(protected)/connections/page.tsx",
    "app/(protected)/connections/shared/[id]/page.tsx",
    "app/(protected)/flights/[id]/page.tsx",
    "app/(protected)/flights/[id]/share/page.tsx",
    "app/(protected)/flights/page.tsx",
    "app/(protected)/map/page.tsx",
    "components/advanced-qualifications-panel.tsx",
    "components/dashboard-editor.tsx",
    "components/data-hub.tsx",
    "components/training-flight-candidates.tsx",
  ])assert.doesNotMatch(read(file),cue,file);

  const admin=read("app/(protected)/admin/page.tsx");
  assert.doesNotMatch(admin,cue,"unlabelled legacy admin form stays untouched");
});

test("v3.3 design batch 6 keeps one form-level alert for affected existing error states",()=>{
  const manager=read("components/aircraft-manager.tsx");
  for(const state of ["newStatus","profileStatus","deleteStatus"])assert.ok(manager.includes(`role={${state}.ok?"status":"alert"}`),state);
  const deleteStart=manager.indexOf("<form action={deleteSelected}>");
  const deleteEnd=manager.indexOf("</form>",deleteStart);
  assert.match(manager.slice(deleteStart,deleteEnd),/deleteStatus\?<p[^>]+role=\{deleteStatus\.ok\?"status":"alert"\}/);

  const photo=read("components/aircraft-photo-editor.tsx");
  const photoStart=photo.indexOf('<form action={action} className="stack-form">');
  const photoEnd=photo.indexOf("</form>",photoStart);
  const photoForm=photo.slice(photoStart,photoEnd);
  assert.equal((photoForm.match(/role="alert"/g)??[]).length,1);
  assert.match(photoForm,/error\|\|\(!state\.ok&&state\.message\)\?<p className="form-error" role="alert"/);
  assert.match(photoForm,/state\.ok&&state\.message\?<p className="form-success" role="status"/);

  const share=read("components/aircraft-share-panel.tsx");
  assert.match(share,/state\.ok\?"status":"alert"/);

  const invite=read("components/auth-invite-creator.tsx");
  const inviteStart=invite.indexOf("<form action={action}");
  const inviteEnd=invite.indexOf("</form>",inviteStart);
  assert.equal((invite.slice(inviteStart,inviteEnd).match(/role="alert"/g)??[]).length,1);

  const search=read("components/pilot-connection-search.tsx");
  const searchStart=search.indexOf('<form action={action} className="stack-form">');
  const searchEnd=search.indexOf("</form>",searchStart);
  assert.equal((search.slice(searchStart,searchEnd).match(/role="alert"/g)??[]).length,1);

  for(const file of ["components/flight-form.tsx","components/kml-import-form.tsx","components/quick-aircraft-form.tsx","components/track-manager.tsx"]){
    assert.equal((read(file).match(/role="alert"/g)??[]).length,1,file);
  }
});


test("v3.3 design batch 7 formats date-only values without timezone conversion",async()=>{
  const {formatDateOnly}=await import("../lib/display-format.ts");
  assert.equal(formatDateOnly("2026-01-01"),"01/01/2026");
  assert.equal(formatDateOnly("2026-12-31"),"31/12/2026");
  for(const invalid of ["","2026-02-29","2026-04-31","not-a-date"])assert.equal(formatDateOnly(invalid),invalid);

  const oldTz=process.env.TZ;
  try{
    for(const zone of ["America/Los_Angeles","Pacific/Auckland"]){
      process.env.TZ=zone;
      assert.equal(formatDateOnly("2026-01-01"),"01/01/2026",zone);
      assert.equal(formatDateOnly("2026-12-31"),"31/12/2026",zone);
    }
  }finally{
    if(oldTz===undefined)delete process.env.TZ;else process.env.TZ=oldTz;
  }

  const daysInMonth=(year:number,month:number)=>[31,year%4===0&&(year%100!==0||year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
  for(const year of [2024,2026])for(let month=1;month<=12;month++)for(let day=1;day<=daysInMonth(year,month);day++){
    const iso=`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const legacy=new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB");
    assert.equal(formatDateOnly(iso),legacy,iso);
  }

  const helper=read("lib/display-format.ts");
  const start=helper.indexOf("export function formatDateOnly");
  const end=helper.indexOf("\n}\n\nfunction parsedDate",start)+2;
  assert.ok(start>=0&&end>start);
  assert.doesNotMatch(helper.slice(start,end),/new Date|Date[.]/);
});

test("v3.3 design batch 7 keeps GPS timeline timestamps explicitly UTC",()=>{
  const player=read("components/flight-track-player.tsx");
  const legacy=read("components/track-profile.tsx");
  const manager=read("components/track-manager.tsx");
  const importReview=read("components/gps-import-review-player.tsx");
  assert.match(player,/formatUtcTime\(current\.time\)/);
  assert.match(legacy,/formatUtcTime\(current\.time\)/);
  assert.match(manager,/formatUtcDateTime\(t\.startUtc\)/);
  assert.match(importReview,/timeZone:"UTC"\}\)\+" UTC"/);
  assert.doesNotMatch(player,/toLocaleTimeString\("en-GB"/);
  assert.doesNotMatch(legacy,/toLocaleTimeString\(['"]en-GB['"]/);
  assert.doesNotMatch(manager,/toLocaleString\("en-GB"/);
});

test("v3.3 design batch 7 uses one altitude conversion contract and keeps chart geometry in metres",async()=>{
  const units=await import("../lib/aviation-units.ts");
  assert.equal(units.METERS_TO_FEET,3.28084);
  assert.equal(units.metersToFeet(1000),3281);
  for(const file of ["components/track-profile.tsx","components/flight-track-player.tsx","components/gps-import-review-player.tsx"]){
    const source=read(file);
    assert.match(source,/metersToFeet/);
    assert.doesNotMatch(source,/3[.]28084/);
  }
  const legacy=read("components/track-profile.tsx");
  assert.match(legacy,/metersToFeet\(maxAlt\)\} ft · \{Math\.round\(maxAlt\)\} m/);
  assert.match(legacy,/metersToFeet\(current\.alt\)\} ft · \{Math\.round\(Number\(current\.alt\)\)\} m/);
  assert.match(legacy,/const line=profile\.map/);
  assert.doesNotMatch(legacy,/<text\b|axis|tick/i);
});

test("v3.3 design batch 7 routes audited date-only displays through formatDateOnly",()=>{
  const checks:Record<string,string[]>={
    "app/(protected)/dashboard/page.tsx":["formatDateOnly(data.lastFlight.date)","formatDateOnly(recencySnapshot.nextDate)"],
    "app/(protected)/statistics/page.tsx":["formatDateOnly(data.career.firstDate)","formatDateOnly(data.career.lastDate)","formatDateOnly(row.firstDate)","formatDateOnly(row.lastDate)"],
    "components/recency-panel.tsx":["formatDateOnly(item.forecastDate)","formatDateOnly(item.deadline)","formatDateOnly(row.date)","formatDateOnly(row.dropOffDate)","formatDateOnly(item.date)"],
    "app/(protected)/flights/page.tsx":["formatDateOnly(f.date)"],
    "app/(protected)/flights/[id]/page.tsx":["formatDateOnly(flight.date)"],
    "components/aircraft-qualifications-section.tsx":["formatDateOnly(t(row.completed_on))","formatDateOnly(t(row.first_date))","formatDateOnly(t(row.last_date))"],
  };
  for(const [file,needles] of Object.entries(checks)){
    const source=read(file);
    for(const needle of needles)assert.ok(source.includes(needle),`${file}: ${needle}`);
  }
});
