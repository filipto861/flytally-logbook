import { spawnSync } from "node:child_process";

const PRODUCTION_BRANCH = "codex/vercel-migration-v080";
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

function resolveProductionBase() {
  const parent = gitValue(["rev-parse", "HEAD^1"]);
  if (!commitExists(parent)) return "";
  console.error(`Vercel diff base: production first parent ${parent.slice(0, 12)}.`);
  return parent;
}

function isTrustedCandidateBase(ref) {
  if (!commitExists(ref)) return false;
  const parents = gitValue(["show", "-s", "--format=%P", ref]).split(/\s+/).filter(Boolean);
  const committerEmail = gitValue(["show", "-s", "--format=%ce", ref]).toLowerCase();
  return parents.length >= 2 && committerEmail === "noreply@github.com";
}

function resolvePreviewBase() {
  const parent = gitValue(["rev-parse", "HEAD^1"]);
  if (!isTrustedCandidateBase(parent)) {
    console.error("Vercel preview fallback rejected: candidate parent is not a trusted GitHub production merge commit.");
    return "";
  }
  console.error(`Vercel diff base: trusted candidate parent ${parent.slice(0, 12)}.`);
  return parent;
}

function resolveDiffBase() {
  const previous = String(process.env.VERCEL_GIT_PREVIOUS_SHA ?? "").trim();
  if (/^[0-9a-f]{40}$/i.test(previous) && commitExists(previous)) {
    console.error(`Vercel diff base: VERCEL_GIT_PREVIOUS_SHA ${previous.slice(0, 12)}.`);
    return previous;
  }

  const currentRef = String(process.env.VERCEL_GIT_COMMIT_REF ?? gitValue(["branch", "--show-current"])).trim();
  const production = process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_TARGET_ENV === "production" ||
    currentRef === PRODUCTION_BRANCH;

  return production ? resolveProductionBase() : resolvePreviewBase();
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

const argumentFiles = filesFromArguments(process.argv.slice(2));
const files = argumentFiles ?? changedFilesFromGit();

if (!files) process.exit(1);

if (shouldIgnoreVercelBuild(files)) {
  console.log(`Skipping Vercel build: ${files.length} development-only file(s) changed.`);
  process.exit(0);
}

console.log("Vercel build required: runtime, dependency, or deployment configuration changed.");
process.exit(1);
