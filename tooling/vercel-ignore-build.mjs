import { spawnSync } from "node:child_process";

const PRODUCTION_BRANCH = "main";
const normalize = (value) => String(value ?? "").replaceAll("\\", "/").replace(/^\.\/+/, "");

function git(args) {
  return spawnSync("git", args, { encoding: "utf8" });
}

function gitValue(args) {
  const result = git(args);
  return result.status === 0 ? result.stdout.trim() : "";
}

function commitExists(ref) {
  return Boolean(ref) && git(["cat-file", "-e", `${ref}^{commit}`]).status === 0;
}

export function isDevelopmentOnlyPath(value) {
  const file = normalize(value);
  if (file === "tooling/vercel-ignore-build.mjs") return false;
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

function currentGitRef() {
  return String(process.env.VERCEL_GIT_COMMIT_REF ?? gitValue(["branch", "--show-current"])).trim();
}

function isProductionBuild() {
  const currentRef = currentGitRef();
  return process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_TARGET_ENV === "production" ||
    currentRef === PRODUCTION_BRANCH;
}

function resolveProductionBase() {
  const parent = gitValue(["rev-parse", "HEAD^1"]);
  if (!commitExists(parent)) return "";
  console.error(`Vercel diff base: production first parent ${parent.slice(0, 12)}.`);
  return parent;
}

function resolveDiffBase() {
  const previous = String(process.env.VERCEL_GIT_PREVIOUS_SHA ?? "").trim();
  if (/^[0-9a-f]{40}$/i.test(previous) && commitExists(previous)) {
    console.error(`Vercel diff base: VERCEL_GIT_PREVIOUS_SHA ${previous.slice(0, 12)}.`);
    return previous;
  }

  return resolveProductionBase();
}

function changedFilesFromGit() {
  const base = resolveDiffBase();
  if (!base) {
    console.error("Vercel build required: unable to establish a safe Git diff base.");
    return null;
  }

  const diff = git(["diff", "--name-only", base, "HEAD"]);
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

if (!isProductionBuild()) {
  const ref = currentGitRef() || "non-production ref";
  console.log(`Skipping Vercel preview build for ${ref}. Feature branches are validated by GitHub Actions; Vercel builds production only.`);
  process.exit(0);
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
