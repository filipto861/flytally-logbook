import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(name:string)=>fs.readFileSync(path.join(root,name),"utf8");

test("Adaptive sidebar V3 loads after existing Glassless and shell layers",()=>{
  const layout=read("app/layout.tsx");
  const old=layout.indexOf('import "./ui-system.css"');
  const flights=layout.indexOf('import "./flights-balanced-glassless.css"');
  const adaptive=layout.indexOf('import "./sidebar-adaptive-v3.css"');
  assert.ok(old>=0&&flights>old&&adaptive>flights);
});

test("Compact and Slim are two reversible states of existing persistent sidebar",()=>{
  const s=read("components/sidebar.tsx");
  assert.match(s,/localStorage\.getItem\("logbook-sidebar"\)==="collapsed"/);
  assert.match(s,/localStorage\.setItem\("logbook-sidebar",next\?"collapsed":"open"\)/);
  assert.match(s,/aria-label=\{collapsed\?"Expand navigation":"Collapse navigation"\}/);
  assert.match(s,/className="sidebar-layout-controls"/);
  assert.match(s,/NavIcon name=\{collapsed\?"sidebar-expand":"sidebar-collapse"\}/);
  const icons=read("components/nav-icon.tsx");
  for(const icon of ["sidebar-expand","sidebar-collapse"])assert.ok(icons.includes('"'+icon+'"'));
});

test("Compact dock has accessible secondary navigation without hiding routes",()=>{
  const s=read("components/sidebar.tsx");
  const css=read("app/sidebar-adaptive-v3.css");
  for(const route of ["/dashboard","/flights","/map","/statistics","/credentials","/database","/connections","/data","/profile","/admin"])assert.ok(s.includes('"'+route+'"'),route);
  assert.match(s,/aria-label="More navigation — Pilot & records"/);
  assert.match(s,/aria-expanded=\{moreOpen\}/);
  assert.match(s,/aria-controls="sidebar-more-panel"/);
  assert.match(s,/morePanelRef/);
  assert.match(s,/if\(event.key!=="Escape"\)return/);
  assert.match(s,/document\.addEventListener\("pointerdown",outside\)/);
  assert.match(s,/requestAnimationFrame\(\(\)=>moreRef\.current\?\.focus\(\)\)/);
  assert.match(s,/moreActive=recordLinks\.some/);
  assert.match(css,/\.sidebar-more-panel\{/);
  assert.match(css,/min-height:44px;/);
});

test("Active nav uses full tinted rounded surface, not left decoration",()=>{
  const css=read("app/sidebar-adaptive-v3.css");
  assert.match(css,/\.sidebar nav a\.active\{[\s\S]*?background:var\(--accent-soft\);[\s\S]*?box-shadow:none;/);
  assert.match(css,/\.sidebar\.collapsed nav \.sidebar-more-trigger\.is-current\{/);
  assert.doesNotMatch(css,/\b(?:border-inline-start|border-left)\s*:/);
  assert.doesNotMatch(css,/\b(?:backdrop-filter|animation)\s*:/);
  assert.doesNotMatch(css,/!important/);
});

test("Tablet dock and slim heights remain touch sized and phone drawer preserved",()=>{
  const css=read("app/sidebar-adaptive-v3.css");
  const existing=read("components/sidebar.tsx");
  assert.match(css,/@media screen and \(min-width:821px\)\{/);
  assert.match(css,/width:218px;/);
  assert.match(css,/width:78px;/);
  assert.match(css,/min-height:46px;/);
  assert.match(css,/@media screen and \(max-width:820px\)\{/);
  assert.match(css,/\.sidebar nav \.sidebar-more-trigger\{\s*display:none;/);
  assert.match(existing,/className="mobile-nav-backdrop"/);
  assert.match(existing,/aria-label=\{mobile\?"Close navigation":"Open navigation"\}/);
  assert.match(existing,/if\(event.key==="Escape"\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test("Flight record state rails and iPad clock correction remain unmodified",()=>{
  const base=read("app/v140-flights.css");
  const glassless=read("app/flights-balanced-glassless.css");
  for(const state of ["certified","draft","correction","locked"])assert.ok(base.includes('data-record-state="'+state+'"'),state);
  assert.match(glassless,/min-inline-size:1220px/);
  assert.match(glassless,/min-inline-size:124px/);
  assert.doesNotMatch(read("app/sidebar-adaptive-v3.css"),/\.flight-(?:summary|list-row|finder)|\.flights-table/);
});
