import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(p:string)=>fs.readFileSync(path.join(root,p),"utf8");

test("V4.2 is a final scoped sidebar layer with the original V3 preserved",()=>{
  const layout=read("app/layout.tsx");
  assert.ok(layout.indexOf('import "./sidebar-adaptive-v3.css"')>=0);
  assert.ok(layout.indexOf('import "./sidebar-adaptive-v42.css"')>layout.indexOf('import "./sidebar-adaptive-v3.css"'));
});
test("V4.2 header owns the reversible toggle, footer owns the single notifications link",()=>{
  const s=read("components/sidebar.tsx");
  const brand=s.indexOf('<div className="sidebar-brand">');
  const nav=s.indexOf('<nav ref={menuRef}');
  const utility=s.indexOf('<div className="sidebar-utility">');
  assert.ok(brand>=0&&nav>brand&&utility>nav);
  assert.ok(s.indexOf('className="sidebar-layout-controls"')>brand&&s.indexOf('className="sidebar-layout-controls"')<nav);
  assert.equal((s.match(/<NotificationBell /g)??[]).length,1);
  assert.ok(s.indexOf('<NotificationBell')>utility);
  assert.match(s,/localStorage\.setItem\("logbook-sidebar",next\?"collapsed":"open"\)/);
  assert.match(s,/aria-label=\{collapsed\?"Expand navigation":"Collapse navigation"\}/);
  assert.match(s,/className="mobile-nav-backdrop"/);
});
test("V4.2 Compact has a shared 48px geometry, legible More and nonoverlay 44px header control",()=>{
  const s=read("components/sidebar.tsx");
  const css=read("app/sidebar-adaptive-v42.css");
  const icons=read("components/nav-icon.tsx");
  assert.match(s,/<NavIcon name="more"\/>/);
  assert.match(icons,/more:<>/);
  assert.match(css,/grid-template-columns:40px minmax\(0,1fr\) 44px/);
  assert.match(css,/\.sidebar\.collapsed nav a\{[\s\S]*?width:48px;[\s\S]*?min-height:48px;/);
  assert.match(css,/\.sidebar\.collapsed nav \.sidebar-more-trigger\{[\s\S]*?width:48px;/);
  assert.match(css,/\.sidebar-brand \.sidebar-layout-controls \.sidebar-toggle\{[\s\S]*?position:static;[\s\S]*?width:44px;/);
  const toggleRule=css.match(/\.sidebar-brand \.sidebar-layout-controls \.sidebar-toggle\{([^}]+)\}/)?.[1]??"";
  assert.match(toggleRule,/position:static;/);
  assert.match(toggleRule,/inset:auto;/);
  assert.doesNotMatch(toggleRule,/\b(?:left|right):\s*-\d+px/);
  assert.doesNotMatch(css,/\b(?:border-inline-start|border-left)\s*:/);
});
test("Notification is bottom desktop but still in mobile header; no duplicate fetching",()=>{
  const css=read("app/sidebar-adaptive-v42.css");
  assert.match(css,/\.sidebar \.sidebar-utility\{[\s\S]*?display:grid;/);
  assert.match(css,/\.sidebar \.sidebar-utility>a\[aria-label\^="Notifications"\]::after\{\s*content:"Notifications";/);
  assert.match(css,/@media screen and \(max-width:820px\)\{/);
  assert.match(css,/top:15px;\s*right:68px;/);
  assert.match(css,/\.sidebar \.sidebar-utility \.desktop-signout\{\s*display:none;/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test("V4.2 does not modify meaningful flight rails, time source or auth routes",()=>{
  const s=read("components/sidebar.tsx");
  const css=read("app/sidebar-adaptive-v42.css");
  assert.ok(s.includes('href="/flights/new"'));
  for(const r of ["/dashboard","/flights","/map","/statistics","/credentials","/database","/connections","/data","/profile","/admin"])assert.ok(s.includes('"'+r+'"'),r);
  assert.match(s,/document\.addEventListener\("pointerdown",outside\)/);
  assert.match(s,/requestAnimationFrame\(\(\)=>moreRef\.current\?\.focus\(\)\)/);
  assert.doesNotMatch(css,/\.flight-(?:summary|list-row|finder)|\.flights-table/);
  assert.match(read("app/flights-balanced-glassless.css"),/min-inline-size:1220px/);
});

test("Owner V4.2 visual correction centers the toggle glyph instead of inheriting V3 left-aligned grid tracks",()=>{
  const css=read("app/sidebar-adaptive-v42.css");
  const rule=css.match(/\.sidebar-brand \.sidebar-layout-controls \.sidebar-toggle\{([^}]+)\}/)?.[1]??"";
  assert.match(rule,/display:grid;/);
  assert.match(rule,/place-content:center;/);
  assert.match(rule,/justify-content:center;/);
  assert.match(rule,/place-items:center;/);
  assert.match(rule,/width:44px;/);
});
test("Every Compact destination, More, notification and Sign out uses the same 48px frame and centered icon",()=>{
  const css=read("app/sidebar-adaptive-v42.css");
  assert.match(css,/\.sidebar\.collapsed nav>a:not\(\.active\)\{\s*background:var\(--surface\);\s*border:1px solid var\(--line-soft\);/);
  assert.match(css,/\.sidebar\.collapsed nav>a>span\{\s*display:none;/);
  assert.match(css,/\.sidebar\.collapsed nav a i\{[\s\S]*?place-items:center;/);
  assert.match(css,/\.sidebar\.collapsed nav \.sidebar-more-trigger\{[\s\S]*?width:48px;[\s\S]*?border:1px solid var\(--line-soft\);[\s\S]*?background:var\(--surface\);/);
  assert.match(css,/\.sidebar\.collapsed \.sidebar-utility>a\[aria-label\^="Notifications"\],[\s\S]*?\.sidebar\.collapsed \.sidebar-utility \.desktop-signout \.ghost-button\{[\s\S]*?width:48px;[\s\S]*?border:1px solid var\(--line-soft\);/);
  assert.match(css,/\.sidebar\.collapsed \.sidebar-utility \.desktop-signout \.ghost-button span\{\s*display:none;/);
  assert.match(css,/\.sidebar\.collapsed \.sidebar-utility \.desktop-signout \.ghost-button i\{[\s\S]*?place-items:center;/);
  assert.match(css,/\.sidebar\.collapsed nav>a \.notification-badge\{[\s\S]*?position:absolute;/);
  assert.match(css,/\.sidebar nav a\.active\{[\s\S]*?background:var\(--accent-soft\);/);
});

test("Compact neutral frames retain clear hover and keyboard focus affordances",()=>{
  const css=read("app/sidebar-adaptive-v42.css");
  assert.match(css,/\.sidebar\.collapsed nav>a:not\(\.active\):is\(:hover,:focus-visible\)\{[\s\S]*?background:var\(--surface-hover\);/);
  assert.match(css,/\.sidebar\.collapsed \.sidebar-utility>a\[aria-label\^="Notifications"\]:is\(:hover,:focus-visible\)/);
  assert.match(css,/\.sidebar\.collapsed \.sidebar-utility \.desktop-signout \.ghost-button:is\(:hover,:focus-visible\)/);
  assert.match(css,/border-color:var\(--line-strong\);/);
});
