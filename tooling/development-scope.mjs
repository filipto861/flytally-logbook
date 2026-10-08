import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const manifestPath = fileURLToPath(new URL("./development-modules.json", import.meta.url));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const normalize = (value) => String(value ?? "").replaceAll("\\", "/").replace(/^\.\/+/, "");
const emptyGates = () => ({ postgres: false, scale: false, browser: false, fullTests: false, build: false });

function mergeGates(target, source = {}) {
  for (const key of Object.keys(target)) target[key] = Boolean(target[key] || source[key]);
}

function pathMatches(entry, file) {
  const path = normalize(file);
  return (entry.files ?? []).includes(path) || (entry.prefixes ?? []).some((prefix) => path.startsWith(prefix));
}

function hasExtension(file, extensions = []) {
  return extensions.some((extension) => file.endsWith(extension));
}

function isDocumentation(file) {
  return hasExtension(file, manifest.documentation.extensions) ||
    manifest.documentation.prefixes.some((prefix) => file.startsWith(prefix));
}

function isPresentation(file) {
  return hasExtension(file, manifest.presentation.extensions);
}

function isScalePath(file) {
  return (manifest.scalePaths ?? []).includes(file) ||
    (manifest.postgresAcceptance?.scaleTests ?? []).includes(file);
}

function owningTestGroups(file) {
  const groups = [];
  for (const [id, group] of Object.entries(manifest.testGroups)) {
    if ((group.tests ?? []).includes(file)) groups.push(id);
  }
  return groups;
}

function addEvidenceClass(evidenceClass, requiredEvidence) {
  if (!evidenceClass || evidenceClass === "aggregate-regression") return;
  const allowed = manifest.evidencePolicy?.behavioralClasses ?? [];
  if (!allowed.includes(evidenceClass)) throw new Error("Unknown behavioral evidence class: " + evidenceClass);
  requiredEvidence.add(evidenceClass);
}

function addTestGroup(id, selectedGroups, targetedTests, risks, gates, requiredEvidence) {
  const group = manifest.testGroups[id];
  if (!group) throw new Error("Unknown development test group: " + id);
  selectedGroups.add(id);
  addEvidenceClass(group.evidenceClass, requiredEvidence);
  for (const risk of group.risks ?? []) risks.add(risk);
  mergeGates(gates, group.gates);
  for (const test of group.tests ?? []) targetedTests.add(test);
}

function addRule(entry, selectedGroups, targetedTests, risks, gates, requiredEvidence) {
  for (const risk of entry.risks ?? []) risks.add(risk);
  mergeGates(gates, entry.gates);
  for (const id of entry.testGroups ?? []) addTestGroup(id, selectedGroups, targetedTests, risks, gates, requiredEvidence);
}

function addPolicyEvidence(risks, gates, requiredEvidence) {
  for (const risk of risks) {
    for (const evidenceClass of manifest.evidencePolicy?.riskRequirements?.[risk] ?? []) {
      addEvidenceClass(evidenceClass, requiredEvidence);
    }
  }
  for (const [gate, evidenceClass] of Object.entries(manifest.evidencePolicy?.gateRequirements ?? {})) {
    if (gates[gate]) addEvidenceClass(evidenceClass, requiredEvidence);
  }
}

export function classifyDevelopmentScope(files, title = "") {
  const normalizedFiles = files.map(normalize).filter(Boolean);
  const forceFull = title.includes("[full-ci]");
  const gates = emptyGates();
  const modules = new Set();
  const risks = new Set();
  const selectedGroups = new Set();
  const targetedTests = new Set();
  const requiredEvidence = new Set();

  for (const file of normalizedFiles) {
    const matchedModules = manifest.modules.filter((module) => pathMatches(module, file));
    for (const module of matchedModules) modules.add(module.id);

    const ownedGroups = owningTestGroups(file);
    for (const groupId of ownedGroups) addTestGroup(groupId, selectedGroups, targetedTests, risks, gates, requiredEvidence);

    const specialRules = manifest.specialRules.filter((rule) => pathMatches(rule, file));
    for (const rule of specialRules) addRule(rule, selectedGroups, targetedTests, risks, gates, requiredEvidence);

    if (isDocumentation(file)) {
      risks.add("documentation");
      continue;
    }

    if (isPresentation(file)) {
      addRule(manifest.presentation, selectedGroups, targetedTests, risks, gates, requiredEvidence);
      continue;
    }

    if (file.startsWith("tests/")) {
      risks.add("test-contract");
      if (ownedGroups.length === 0 && specialRules.length === 0) {
        risks.add("unowned-test");
        gates.fullTests = true;
      }
      if (isScalePath(file)) {
        risks.add("scale-performance");
        gates.postgres = true;
        gates.scale = true;
      }
      continue;
    }

    if (matchedModules.length > 0) {
      for (const module of matchedModules) addRule(module, selectedGroups, targetedTests, risks, gates, requiredEvidence);
    } else if (/^(app|components|lib)\//.test(file)) {
      modules.add("shared");
      risks.add("shared-runtime");
      gates.fullTests = true;
      gates.build = true;
    } else if (specialRules.length === 0) {
      modules.add("shared");
      risks.add("shared-tooling");
      gates.fullTests = true;
      gates.build = true;
    }

    if (isScalePath(file)) {
      risks.add("scale-performance");
      gates.postgres = true;
      gates.scale = true;
      gates.fullTests = true;
    }
  }

  if (forceFull) {
    risks.add("full-ci");
    for (const key of Object.keys(gates)) gates[key] = true;
    for (const id of Object.keys(manifest.testGroups)) addTestGroup(id, selectedGroups, targetedTests, risks, gates, requiredEvidence);
  }

  addPolicyEvidence(risks, gates, requiredEvidence);
  const aggregateGates = gates.fullTests ? [...(manifest.evidencePolicy?.aggregateGates ?? [])] : [];
  const typecheck = forceFull || normalizedFiles.some((file) => !isDocumentation(file));

  return {
    ...gates,
    typecheck,
    schemaVersion: manifest.schemaVersion ?? manifest.version,
    modules: [...modules].sort(),
    risks: [...risks].sort(),
    testGroups: [...selectedGroups].sort(),
    targetedTests: [...targetedTests].sort(),
    requiredEvidence: [...requiredEvidence].sort(),
    aggregateGates: [...aggregateGates].sort(),
    buildArtifactRequired: Boolean(gates.build),
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

  try {
    const result = classifyDevelopmentScope(files, title);
    process.stdout.write("schema_version=" + result.schemaVersion + "\n");
    process.stdout.write("typecheck=" + result.typecheck + "\n");
    process.stdout.write("postgres=" + result.postgres + "\n");
    process.stdout.write("scale=" + result.scale + "\n");
    process.stdout.write("browser=" + result.browser + "\n");
    process.stdout.write("full_tests=" + result.fullTests + "\n");
    process.stdout.write("build=" + result.build + "\n");
    process.stdout.write("modules=" + (result.modules.join(",") || "none") + "\n");
    process.stdout.write("risks=" + (result.risks.join(",") || "none") + "\n");
    process.stdout.write("test_groups=" + (result.testGroups.join(",") || "none") + "\n");
    process.stdout.write("targeted_tests=" + (result.targetedTests.join(",") || "none") + "\n");
    process.stdout.write("required_evidence=" + (result.requiredEvidence.join(",") || "none") + "\n");
    process.stdout.write("aggregate_gates=" + (result.aggregateGates.join(",") || "none") + "\n");
    process.stdout.write("build_artifact=" + (result.buildArtifactRequired ? "required" : "not-required") + "\n");
    console.error(
      "Development scope: " + (result.modules.join(", ") || "none") +
      "; risks=" + (result.risks.join(", ") || "none") +
      "; typecheck=" + result.typecheck +
      "; PostgreSQL=" + result.postgres +
      "; scale=" + result.scale +
      "; browser=" + result.browser +
      "; fullTests=" + result.fullTests +
      "; build=" + result.build +
      "; testGroups=" + (result.testGroups.join(", ") || "none") +
      "; requiredEvidence=" + (result.requiredEvidence.join(", ") || "none") +
      "; aggregateGates=" + (result.aggregateGates.join(", ") || "none") +
      "; buildArtifact=" + (result.buildArtifactRequired ? "required" : "not-required"),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}
