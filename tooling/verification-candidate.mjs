import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

export class CandidateInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "CandidateInputError";
    this.exitCode = 2;
  }
}

function runGit(args, cwd = repositoryRoot) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.error) {
    throw new CandidateInputError("Git command could not run: " + result.error.message);
  }
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || "").trim();
    throw new CandidateInputError("Git command failed: git " + args.join(" ") + (detail ? "\n" + detail : ""));
  }
  return String(result.stdout ?? "").trim();
}

export function normalizeCandidatePath(value) {
  const raw = String(value ?? "").trim().replaceAll("\\", "/").replace(/^\.\/+/, "");
  if (!raw) throw new CandidateInputError("Candidate paths must not be empty.");
  if (path.isAbsolute(raw) || /^[A-Za-z]:\//.test(raw)) {
    throw new CandidateInputError("Candidate paths must be repository-relative: " + raw);
  }
  const normalized = path.posix.normalize(raw);
  if (normalized === ".." || normalized.startsWith("../") || normalized.startsWith("/")) {
    throw new CandidateInputError("Candidate path escapes the repository: " + raw);
  }
  return normalized;
}

function parseLines(value) {
  return String(value ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function parseVerificationArgs(argv) {
  const positional = [];
  let filesPath = "";
  let baseRef = "";
  let all = false;
  let json = false;
  let forceAll = false;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--files") {
      filesPath = argv[index + 1] ?? "";
      if (!filesPath) throw new CandidateInputError("--files requires a path.");
      index += 1;
      continue;
    }
    if (value === "--base") {
      baseRef = argv[index + 1] ?? "";
      if (!baseRef) throw new CandidateInputError("--base requires an explicit Git ref.");
      index += 1;
      continue;
    }
    if (value === "--all") {
      all = true;
      continue;
    }
    if (value === "--json") {
      json = true;
      continue;
    }
    if (value === "--force-all") {
      forceAll = true;
      continue;
    }
    if (value.startsWith("--")) {
      throw new CandidateInputError("Unknown verification option: " + value);
    }
    positional.push(value);
  }

  const sourceCount = Number(positional.length > 0) + Number(Boolean(filesPath)) + Number(Boolean(baseRef)) + Number(all);
  if (sourceCount === 0) {
    throw new CandidateInputError("No candidate supplied. Pass repository-relative paths, --files <path>, --base <git-ref>, or --all.");
  }
  if (sourceCount !== 1) {
    throw new CandidateInputError("Exactly one candidate source is required: positional paths, --files, --base, or --all.");
  }

  return { positional, filesPath, baseRef, all, json, forceAll };
}

function candidateFilesFromArgs(parsed) {
  if (parsed.positional.length > 0) {
    return { kind: "paths", value: null, files: parsed.positional };
  }
  if (parsed.filesPath) {
    let contents;
    try {
      contents = readFileSync(parsed.filesPath, "utf8");
    } catch (error) {
      throw new CandidateInputError("Could not read candidate file list " + parsed.filesPath + ": " + (error instanceof Error ? error.message : String(error)));
    }
    return { kind: "files", value: parsed.filesPath, files: parseLines(contents) };
  }
  if (parsed.baseRef) {
    const headSha = runGit(["rev-parse", "HEAD"]);
    const baseSha = runGit(["rev-parse", "--verify", parsed.baseRef + "^{commit}"]);
    runGit(["merge-base", baseSha, headSha]);
    const files = parseLines(runGit(["diff", "--name-only", "--diff-filter=ACMRD", baseSha + "..."+ headSha]));
    return { kind: "base", value: parsed.baseRef, baseSha, headSha, files };
  }
  return { kind: "all", value: null, files: parseLines(runGit(["ls-files"])) };
}

function hashCandidateFiles(files, root = repositoryRoot) {
  const aggregate = createHash("sha256");
  for (const file of files) {
    const absolute = path.resolve(root, ...file.split("/"));
    const relative = path.relative(root, absolute).replaceAll("\\", "/");
    if (relative === ".." || relative.startsWith("../") || path.isAbsolute(relative)) {
      throw new CandidateInputError("Candidate path escapes the repository: " + file);
    }

    let contentHash = "MISSING";
    if (existsSync(absolute)) {
      const stat = statSync(absolute);
      if (!stat.isFile()) throw new CandidateInputError("Candidate path is not a file: " + file);
      contentHash = createHash("sha256").update(readFileSync(absolute)).digest("hex");
    }

    aggregate.update(file);
    aggregate.update("\0");
    aggregate.update(contentHash);
    aggregate.update("\0");
  }
  return aggregate.digest("hex");
}

export function resolveVerificationCandidate(argv, root = repositoryRoot) {
  const parsed = parseVerificationArgs(argv);
  const source = candidateFilesFromArgs(parsed);
  const files = [...new Set(source.files.map(normalizeCandidatePath))].sort();
  if (files.length === 0) {
    throw new CandidateInputError("The explicit candidate contains no files.");
  }

  const headSha = source.headSha ?? runGit(["rev-parse", "HEAD"], root);
  const baseSha = source.baseSha ?? null;
  const filesHash = hashCandidateFiles(files, root);
  const candidateId = createHash("sha256")
    .update("flytally-verification-candidate-v1\0")
    .update(headSha)
    .update("\0")
    .update(filesHash)
    .digest("hex");

  return {
    candidate: {
      schemaVersion: 1,
      candidateId,
      headSha,
      baseSha,
      filesHash,
      source: { kind: source.kind, value: source.value },
      files,
    },
    options: {
      json: parsed.json,
      forceAll: parsed.forceAll,
    },
  };
}
