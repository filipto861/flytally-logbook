import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";

const read=(file:string)=>readFileSync(join(process.cwd(),file),"utf8");

test("N3-M2 gives only Manual New Flight distinct basics and UTC route/time orientation",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/data-entry-flow=\{editing\?"edit":"new"\}/);
  assert.match(form,/\{editing\?"Flight essentials":"Flight basics"\}/);
  assert.match(form,/!editing\?<p className="n3-m2-section-intro"/);
  assert.match(form,/!editing\?<div className="n3-m2-route-lead"/);
  assert.match(form,/Route &amp; UTC times/);
  assert.match(form,/<strong>Times<\/strong><small>UTC<\/small>/);
  assert.match(form,/className="entry-section entry-section-experience"/);
  assert.match(form,/className="entry-section aircraft-context-section"/);
  assert.match(form,/className="entry-section entry-section-optional"/);
  assert.match(form,/No items flagged in quick review/);
  assert.match(form,/The quick review does not certify the flight/);
  assert.match(form,/Save draft keeps the record editable/);
});

test("N3-M2 does not rename fields, change value controls, or touch manual Edit layout",()=>{
  const form=read("components/flight-form.tsx");
  for(const name of ["date","registration","role","instructor","commander","departure","arrival","offBlock","takeoff","landing","onBlock","operationType","engineType","launchMethod","launches","landingsDay","landingsNight","billingBasis","note"]){
    assert.match(form,new RegExp('name="'+name+'"'),name+" still present");
  }
  assert.match(form,/editing=Boolean\(initial.id\)/);
  assert.match(form,/\{editing\?"Flight essentials":"Flight basics"\}/);
  assert.match(form,/!editing\?<EntryReviewSummary/);
  assert.match(form,/open=\{experienceRequiredOpen\|\|experienceOpen\}/);
  assert.match(form,/action=\{formAction\}/);
  assert.match(form,/onSubmitCapture=\{beginFormSubmit\}/);
  const css=read("app/ui-system.css");
  const n3m2Start=css.indexOf("/* N3-M2 —");
  const n3GpsStart=css.indexOf("/* N3 GPS single-source action:",n3m2Start);
  assert.ok(n3m2Start>=0&&n3GpsStart>n3m2Start,"N3-M2 Manual CSS ends before independent GPS picker CSS");
  const n3m2=css.slice(n3m2Start,n3GpsStart);
  assert.match(n3m2,/\.flight-form\[data-entry-flow="new"\]/);
  assert.doesNotMatch(n3m2,/data-entry-flow="edit"/);
  assert.doesNotMatch(n3m2,/(?:animation|transition|position|backdrop-filter)\s*:/);
  assert.match(n3m2, /--ui-space-3/);
  assert.match(n3m2, /--ui-space-4/);
});
