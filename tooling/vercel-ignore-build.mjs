import { spawnSync } from "node:child_process";

const normalize = (value) => String(value ?? "").replaceAll("\\", "/").replace(/^\.\/+/, "");

export function isDevelopmentOnlyPath(value) {
  const file = normalize(value);
  return file.endsWith(".md") ||
    file.startsWith("docs/") ||
    file.startsWith(".github/") ||
    file.startsWith("tests/") ||
    file.startsWith("tooling/");
}

export function shouldIgnoreVercelBuild(files) {
  const normalized = files.map(normalize).filter(Boolean);
  return normalized.length > 0 && normalized.every(isDevelopmentOnlyPath);
}

function changedFilesFromGit() {
  const base = String(process.env.VERCEL_GIT_PREVIOUS_SHA ?? "").trim();
  if (!/^[0-9a-f]{40}$/i.test(base)) {
    console.error("Vercel build required: VERCEL_GIT_PREVIOUS_SHA is unavailable or invalid.");
    return null;
  }

  const baseCheck = spawnSync("git", ["cat-file", "-e", `${base}^{commit}`], { encoding: "utf8" });
  if (baseCheck.status !== 0) {
    console.error("Vercel build required: previous deployment commit is not available in Git history.");
    return null;
  }

  const diff = spawnSync("git", ["diff", "--name-only", base, "HEAD"], { encoding: "utf8" });
  if (diff.status !== 0) {
    console.error(`Vercel build required: git diff failed. ${diff.stderr.trim()}`);
    return null;
  }

  return diff.stdout.split(/\r?\n/).filter(Boolean);
}

function filesFromArguments(argv) {
  const marker = argv.indexOf("--files");
  return marker === -1 ? null : argv.slice(marker + 1).filter(Boolean);
}

const argumentFiles = filesFromArguments(process.argv.slice(2));
const files = argumentFiles ?? changedFilesFromGit();

if (!files) process.exit(1);

if (shouldIgnoreVercelBuild(files)) {
  console.log(`Skipping Vercel build: ${files.length} development-only file(s) changed.`);
  process.exit(0);
}

console.log("Vercel build required: runtime, dependency, or deployment configuration changed.");
process.exit(1);
