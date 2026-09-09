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

function moduleMatches(module, file) {
  const path = normalize(file);
  return module.files.includes(path) || module.prefixes.some((prefix) => path.startsWith(prefix));
}

export function classifyDevelopmentScope(files, title = "") {
  const normalizedFiles = files.map(normalize).filter(Boolean);
  const forceFull = title.includes("[full-ci]");
  const scale = forceFull || normalizedFiles.some((file) => manifest.scalePaths.includes(file));
  const postgres = forceFull || scale || normalizedFiles.some((file) => !isLightweight(file));
  const modules = new Set();

  for (const file of normalizedFiles) {
    let matched = false;
    for (const module of manifest.modules) {
      if (!moduleMatches(module, file)) continue;
      modules.add(module.id);
      matched = true;
    }
    if (!matched) modules.add(isLightweight(file) ? "documentation-style" : "shared");
  }

  return {
    postgres,
    scale,
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
  process.stdout.write(`modules=${result.modules.join(",") || "none"}\n`);
  console.error(`Development scope: ${result.modules.join(", ") || "none"}; PostgreSQL=${result.postgres}; scale=${result.scale}`);
}
