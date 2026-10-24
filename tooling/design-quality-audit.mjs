/**
 * FlyTally UI design source-quality audit: read-only heuristics, NOT WCAG/browser evidence.
 * Never modifies files, contacts networks, or connects to PostgreSQL.
 */
import { readdirSync, readFileSync, lstatSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const EXTENSIONS = new Set([".css", ".tsx", ".jsx", ".ts", ".js"]);
const SKIP_DIRS = new Set([".git", ".next", "node_modules", "dist", "build", "coverage"]);

export const RULES = [
  { id: "transition-all", severity: "review", re: /\btransition(?:-property)?\s*:\s*all\b/gi, note: "Specify intended transition properties; review legacy CSS context" },
  { id: "layout-transition", severity: "review", re: /\btransition(?:-property)?\s*:\s*(?:width|height|top|left)\b/gi, note: "Check layout reflow and prefer compositor motion when appropriate" },
  { id: "zoom-restriction", severity: "major", re: /\b(?:user-scalable\s*=\s*['"]?no|maximum-scale\s*=\s*['"]?1(?:\.0)?(?:\b|['"]))/gi, note: "Do not disable user zoom; verify actual viewport behavior" },
  { id: "suppressed-outline", severity: "review", re: /\boutline\s*:\s*(?:none|0)(?=\s*[;},])/gi, note: "Check for equivalent visible :focus-visible styling" },
  { id: "nonsemantic-click", severity: "review", re: /<(?:div|span)\b[^>]*\bonClick\s*=/gi, note: "Consider semantic button/link; verify keyboard access" },
];

function maskBlockComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (part) => part.replace(/[^\n]/g, " "));
}

export function auditSource(path, source) {
  const clean = maskBlockComments(source);
  const findings = [];
  for (const rule of RULES) {
    for (const hit of clean.matchAll(new RegExp(rule.re.source, rule.re.flags))) {
      const line = clean.slice(0, hit.index).split("\n").length;
      findings.push({ path, line, rule: rule.id, severity: rule.severity, note: rule.note });
    }
  }
  return findings.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
}

function collect(target, entries) {
  const full = resolve(ROOT, target);
  const local = relative(ROOT, full);
  if (local === ".." || local.startsWith(".." + sep) || full === ROOT) {
    throw new Error("Only repository subpaths may be scanned");
  }
  const info = lstatSync(full);
  if (info.isSymbolicLink()) return;
  if (info.isDirectory()) {
    for (const entry of readdirSync(full, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || SKIP_DIRS.has(entry.name)) continue;
      collect(join(target, entry.name), entries);
    }
  } else if (info.isFile() && EXTENSIONS.has(extname(full))) {
    entries.push({ file: local.replaceAll(sep, "/"), full });
  }
}

export function runAudit(args = process.argv.slice(2)) {
  const json = args.includes("--json");
  const strict = args.includes("--strict");
  const help = args.includes("--help");
  if (help) {
    console.log("Usage: node tooling/design-quality-audit.mjs [--json] [--strict] [app components ...]");
    return { scanned: 0, findings: [] };
  }
  const unexpectedFlags = args.filter((arg) => arg.startsWith("-") && !["--json", "--strict"].includes(arg));
  if (unexpectedFlags.length) throw new Error("Unknown flags: " + unexpectedFlags.join(", "));
  const targets = args.filter((arg) => !arg.startsWith("-"));
  const files = [];
  for (const target of targets.length ? targets : ["app", "components"]) collect(target, files);
  files.sort((a, b) => a.file.localeCompare(b.file));
  const findings = files.flatMap(({ file, full }) => auditSource(file, readFileSync(full, "utf8")));
  if (json) {
    console.log(JSON.stringify({ evidence: "ADVISORY_STATIC_ONLY", scanned: files.length, findings }, null, 2));
  } else {
    console.log(`FlyTally design audit — ${files.length} source files, ${findings.length} heuristic findings`);
    for (const f of findings) console.log(`${f.path}:${f.line} [${f.rule}/${f.severity}] ${f.note}`);
    console.log("ADVISORY ONLY — not a browser, design approval, WCAG or safety test.");
  }
  if (strict && findings.length) process.exitCode = 1;
  return { scanned: files.length, findings };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runAudit();
