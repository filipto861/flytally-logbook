import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const manifestPath = fileURLToPath(new URL("./development-modules.json", import.meta.url));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const normalize = (value) => String(value ?? "").replaceAll("\\", "/").replace(/^\.\/+/, "");

function isLightweight(file) {
  const path = normalize(file);
  return manifest.lightweight.extensions.some((extension) => path.endsWith(extension)) ||
    manifest.lightweight.prefixes.some((prefix) => path.startsWith(prefix));
}

const fastUiTests = new Set([
  "tests/v121-ui-simplification.test.ts",
  "tests/v1342-ui-polish.test.ts",
  "tests/v156-mobile-layout-audit.test.ts",
  "tests/v300-navigation-hierarchy.test.ts",
  "tests/v300-u6-final-ux.test.ts",
  "tests/v320-ui-consistency.test.ts",
  "tests/v321-route-ui-audit.test.ts",
  "tests/v322-browser-smoke.test.ts",
  "tests/v323-auth-browser.test.ts",
  "tests/v324-auth-mutations.test.ts",
]);

function isFastUiTest(file) {
  return fastUiTests.has(normalize(file));
}

function moduleMatches(module, file) {
  const path = normalize(file);
  return module.files.includes(path) || module.prefixes.some((prefix) => path.startsWith(prefix));
}

export function classifyDevelopmentScope(files, title = "") {
  const normalizedFiles = files.map(normalize).filter(Boolean);
  const forceFull = title.includes("[full-ci]");
  const scale = forceFull || normalizedFiles.some((file) => manifest.scalePaths.includes(file));
  const runtimeFiles = normalizedFiles.filter((file) => !isLightweight(file) && !isFastUiTest(file));
  const postgres = forceFull || scale || runtimeFiles.length > 0;
  const fullTests = forceFull || runtimeFiles.length > 0;
  const modules = new Set();

  for (const file of normalizedFiles) {
    let matched = false;
    for (const module of manifest.modules) {
      if (!moduleMatches(module, file)) continue;
      modules.add(module.id);
      matched = true;
    }
    if (!matched) modules.add(isLightweight(file) || isFastUiTest(file) ? "documentation-style" : "shared");
  }

  return {
    postgres,
    scale,
    fullTests,
    modules: [...modules].sort(),
  };
}

function readArguments(argv) {
  let filesPath = "";
  let title = "";
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--files") {
      filesPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (value === "--title") {
      title = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    positional.push(value);
  }

  const files = filesPath
    ? readFileSync(filesPath, "utf8").split(/\r?\n/)
    : positional;

  return { files: files.filter(Boolean), title };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { files, title } = readArguments(process.argv.slice(2));
  if (files.length === 0) {
    console.error("No changed files supplied. Pass paths directly or use --files <file>.");
    process.exit(2);
  }

  const result = classifyDevelopmentScope(files, title);
  process.stdout.write(`postgres=${result.postgres}\n`);
  process.stdout.write(`scale=${result.scale}\n`);
  process.stdout.write(`full_tests=${result.fullTests}\n`);
  process.stdout.write(`modules=${result.modules.join(",") || "none"}\n`);
  console.error(`Development scope: ${result.modules.join(", ") || "none"}; PostgreSQL=${result.postgres}; scale=${result.scale}; fullTests=${result.fullTests}`);
}
