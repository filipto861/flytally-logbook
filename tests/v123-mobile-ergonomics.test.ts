import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.23 mobile navigation is dismissible and includes sign out",()=>{
  const sidebar=read("components/sidebar.tsx");
  assert.match(sidebar,/mobile-nav-backdrop/);
  assert.match(sidebar,/event\.key==="Escape"/);
  assert.match(sidebar,/document\.body\.style\.overflow="hidden"/);
  assert.match(sidebar,/mobile-only-signout/);
  assert.match(sidebar,/aria-controls="primary-navigation"/);
});

test("v1.23 mobile controls use safe touch sizing and iOS-safe form text",()=>{
  const css=read("app/globals.css");
  assert.match(css,/FlyTally 1\.23 — mobile ergonomics/);
  assert.match(css,/input,select,textarea\{font-size:16px;min-height:48px\}/);
  assert.match(css,/\.primary-button,\.primary-link,\.secondary-button,\.secondary-link,\.detail-button,\.danger-button\{min-height:44px\}/);
  assert.match(css,/padding-bottom:calc\(28px \+ env\(safe-area-inset-bottom\)\)!important/);
});

test("v1.23 sticky tabs and dialogs clear the mobile application shell",()=>{
  const css=read("app/globals.css");
  assert.match(css,/\.detail-tabs\{top:calc\(var\(--mobile-shell-height\) \+ env\(safe-area-inset-top\) \+ 8px\)\}/);
  assert.match(css,/\.modal-backdrop\{z-index:1600/);
  assert.match(css,/\.settings-save\{position:static;bottom:auto/);
});

test("v1.23 prevents accidental page overflow while preserving intentional scrollers",()=>{
  const css=read("app/globals.css");
  assert.match(css,/body\{overflow-x:clip\}/);
  assert.match(css,/\.table-scroll,\.readonly-fcl-table-wrap\{max-width:100%;overscroll-behavior-inline:contain/);
  assert.match(css,/scroll-snap-type:x proximity/);
  assert.match(css,/\.settings-nav>\*,\.data-hub-nav>\*,\.scope-links>\*\{flex:0 0 auto;scroll-snap-align:start\}/);
  assert.match(css,/\.pagination\{max-width:100%;overflow-x:auto;flex-wrap:nowrap/);
});
