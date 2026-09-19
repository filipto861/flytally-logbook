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
