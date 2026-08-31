import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { releaseAtLeast } from "./release-version.ts";
const root=path.resolve(import.meta.dirname,".."),read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.50 is the current UI system release and its CSS is the final application layer",()=>{
  const pkg=JSON.parse(read("package.json")),layout=read("app/layout.tsx"),roadmap=read("ROADMAP.md");
  assert.ok(releaseAtLeast(pkg.version,1,50,0));
  assert.match(roadmap,/Current release — v1\.50\.0 · UI system & theme convergence/);
  assert.ok(layout.indexOf('v148-training.css')<layout.indexOf('v149-linkage.css'));
  assert.ok(layout.indexOf('v149-linkage.css')<layout.indexOf('v150-ui-system.css'));
});

test("system light dark resolve before normal protected content and remain reactive",()=>{
  const rootLayout=read("app/layout.tsx"),shell=read("components/app-shell.tsx"),bootstrap=read("components/theme-bootstrap.tsx"),manager=read("components/theme-manager.tsx");
  assert.match(rootLayout,/ThemeBootstrap preference="system"/);
  assert.match(shell,/data-appearance=\{appearance\}/);assert.match(shell,/ThemeBootstrap preference=\{appearance\}/);
  assert.match(bootstrap,/prefers-color-scheme: light/);assert.match(bootstrap,/dataset\.theme/);assert.match(bootstrap,/style\.colorScheme/);
  assert.match(manager,/addEventListener\("change"/);assert.match(manager,/flytally:themechange/);assert.doesNotMatch(manager,/querySelector\(['"]meta\[name=/);
});

test("semantic theme tokens cover surfaces controls states focus and charts in both modes",()=>{
  const css=read("app/v150-ui-system.css");
  for(const token of ["--surface","--surface-raised","--surface-hover","--control-bg","--control-border","--success-bg","--warning-bg","--danger-bg","--info-bg","--focus-ring","--chart-primary","--chart-cursor"])assert.match(css,new RegExp(token));
  assert.match(css,/html\[data-theme="dark"\]/);assert.match(css,/html\[data-theme="light"\]/);assert.match(css,/@media\(prefers-color-scheme:light\)/);assert.match(css,/app-grid\[data-appearance="system"\]/);assert.match(css,/:focus-visible/);
});

test("maps use one no-key OSM basemap and adapt overlays when theme changes",()=>{
  const helper=read("components/leaflet-mobile.ts"),runtime=read("components/theme-runtime.ts");
  assert.match(helper,/addFlyTallyBasemap/);assert.match(helper,/tile\.openstreetmap\.org/);assert.match(helper,/DARK_TILE_FILTER/);assert.match(helper,/MutationObserver/);
  assert.match(runtime,/useResolvedTheme/);assert.match(runtime,/mapThemePalette/);assert.match(runtime,/flytally:themechange/);
  for(const file of ["components/route-overview-map.tsx","components/tracks-map.tsx","components/flight-track-player.tsx","components/gps-import-review-player.tsx"]){const source=read(file);assert.match(source,/addFlyTallyBasemap/);assert.doesNotMatch(source,/dark_all/)}
});

test("chart and GPS profile colors follow semantic tokens instead of a hardcoded dark cursor",()=>{
  const monthly=read("components/monthly-chart.tsx"),player=read("components/flight-track-player.tsx"),importPlayer=read("components/gps-import-review-player.tsx");
  assert.match(monthly,/var\(--chart-primary\)/);assert.match(monthly,/var\(--chart-secondary\)/);
  for(const source of [player,importPlayer]){assert.match(source,/var\(--chart-primary\)/);assert.match(source,/var\(--chart-secondary\)/);assert.match(source,/var\(--chart-cursor\)/);assert.doesNotMatch(source,/stroke="#f8fafc"/)}
});

test("UI convergence preserves reduced motion and leaves printable logbook styling isolated",()=>{
  const polish=read("app/v1342-ui-polish.css"),theme=read("app/v150-ui-system.css"),print=read("app/(protected)/print/print.module.css");
  assert.match(polish,/prefers-reduced-motion:reduce/);assert.doesNotMatch(theme,/logbook-sheet|print\.module|@media\s+print/);assert.match(print,/@media print/);
});
