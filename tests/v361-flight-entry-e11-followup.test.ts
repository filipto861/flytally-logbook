import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("E1.1 GPS import no longer exposes or writes the synthetic GPS import Task",()=>{
  const gps=read("components/kml-import-form.tsx");
  assert.doesNotMatch(gps,/Task<input name="task" defaultValue="GPS import"/);
  assert.doesNotMatch(gps,/defaultValue="GPS import"/);
  assert.match(gps,/<input type="hidden" name="task" value=""\/>/);
});

test("E1.1 Manual and Edit keep the existing optional Task exercise field",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/Task \/ exercise<input name="task" defaultValue=\{storedTask\}/);
  assert.match(form,/storedTask=storedPurpose\.length\?stripFlightPurposeTasks\(field\("task"\)\):field\("task"\)/);
});

test("E1.1 does not change certification Task integrity semantics",()=>{
  const integrity=read("lib/certification-integrity.ts");
  const certification=read("app/(protected)/flights/certification-actions.ts");
  assert.match(integrity,/remarks:\{task:text\(row\.task\),note:text\(row\.note\)/);
  assert.match(certification,/f\.task/);
  assert.match(certification,/flight_certified_revisions/);
});

test("E1.1 route assistance has one dedicated live region after the aligned route inputs",()=>{
  const form=read("components/flight-form.tsx");
  const routeStart=form.indexOf('className="essential-group essential-route-group"');
  const routeEnd=form.indexOf('className="essential-group essential-time-group"',routeStart);
  assert.ok(routeStart>=0&&routeEnd>routeStart);
  const route=form.slice(routeStart,routeEnd);
  const departure=route.indexOf('name="departure"');
  const arrival=route.indexOf('name="arrival"');
  const assistance=route.indexOf('data-intelligent-route-assistance');
  assert.ok(departure>=0&&arrival>departure&&assistance>arrival);
  assert.match(route,/className="intelligent-route-assistance" data-intelligent-route-assistance aria-live="polite" aria-atomic="false"/);
});

test("E1.1 continuation and return suggestions target the route assistance row, not individual labels",()=>{
  const intelligent=read("components/intelligent-flight-entry-panel.tsx");
  assert.match(intelligent,/querySelector<HTMLElement>\("\[data-intelligent-route-assistance\]"\)/);
  assert.match(intelligent,/className="intelligent-route-assistance-content"/);
  assert.match(intelligent,/data-intelligent-review="continuation"/);
  assert.match(intelligent,/data-intelligent-review="return-leg"/);
  assert.doesNotMatch(intelligent,/const departureTarget=fieldTarget\(form,"departure"\)/);
  assert.doesNotMatch(intelligent,/const arrivalTarget=fieldTarget\(form,"arrival"\)/);
});

test("E1.1 route assistance CSS stays full-width, wrapping and overflow-safe",()=>{
  const css=read("app/v158-flight-entry-polish.css");
  assert.match(css,/\.intelligent-route-assistance\{min-width:0;margin-top:8px\}/);
  assert.match(css,/\.intelligent-route-assistance-content\{display:grid;gap:6px;min-width:0\}/);
  assert.match(css,/@media\(max-width:700px\).*\.intelligent-route-suggestion \.detail-button\{margin-left:0!important;margin-top:6px\}/s);
});
