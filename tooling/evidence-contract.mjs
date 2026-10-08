import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const manifestPath = fileURLToPath(new URL("./development-modules.json", import.meta.url));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const policy = manifest.evidencePolicy ?? {};

const behavioralClasses = new Set(policy.behavioralClasses ?? []);
const aggregateSources = new Set(policy.aggregateGates ?? []);
if (policy.buildArtifact) aggregateSources.add(policy.buildArtifact);

const integerCount = (value, name) => {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  return value;
};

function sourceGates(observation) {
  const values = observation?.sourceGates ?? (observation?.sourceGate ? [observation.sourceGate] : []);
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || !value)) {
    throw new Error("sourceGates must contain non-empty strings");
  }
  return values;
}

function sourceSupportsClass(evidenceClass, source) {
  if (aggregateSources.has(source)) return false;

  const group = manifest.testGroups?.[source];
  if (group) return group.evidenceClass === evidenceClass;

  const dedicated = policy.dedicatedAcceptanceSources?.[evidenceClass];
  if (dedicated) return source === dedicated;

  const direct = policy.directEvidenceSources?.[evidenceClass];
  if (direct) return source === direct;

  return false;
}

export function evaluateEvidenceObservation(evidenceClass, observation) {
  if (!behavioralClasses.has(evidenceClass)) throw new Error(`Unknown behavioral evidence class: ${evidenceClass}`);
  if (!observation) return { status: "NOT RUN", reason: "No observation was supplied." };
  if (typeof observation.command !== "string" || observation.command.trim() === "") {
    throw new Error("Evidence observation command is required");
  }
  if (!['targeted', 'full'].includes(observation.coverage)) {
    throw new Error("Evidence observation coverage must be targeted or full");
  }

  const planned = integerCount(observation.planned, "planned");
  const passed = integerCount(observation.passed, "passed");
  const failed = integerCount(observation.failed, "failed");
  const skipped = integerCount(observation.skipped, "skipped");
  const notApplicable = integerCount(observation.notApplicable, "notApplicable");
  const retries = integerCount(observation.retries, "retries");
  const executed = passed + failed + skipped + notApplicable;
  const sources = sourceGates(observation);

  if (planned === 0 || executed === 0) return { status: "NOT RUN", reason: "No evidence cases executed." };
  if (executed !== planned) return { status: "PARTIAL", reason: "Executed evidence count does not match the declared plan." };
  if (failed > 0) return { status: "FAIL", reason: "One or more evidence cases failed." };
  if (skipped > 0) return { status: "PARTIAL", reason: "Raw skipped cases are not acceptance evidence; classify intentional exclusions as N/A." };
  if (sources.length === 0 || sources.some((source) => !sourceSupportsClass(evidenceClass, source))) {
    return { status: "PARTIAL", reason: "The reported source gate is not authoritative for this evidence class." };
  }

  const dedicated = policy.dedicatedAcceptanceSources?.[evidenceClass];
  const requiredCoverage = policy.dedicatedAcceptanceCoverage?.[evidenceClass] ?? "full";
  if (dedicated && observation.coverage !== requiredCoverage) {
    return { status: "PARTIAL", reason: "Acceptance evidence coverage does not match the canonical source contract." };
  }
  if (dedicated && retries !== 0) {
    return { status: "PARTIAL", reason: "Acceptance evidence requires retries=0." };
  }

  return {
    status: "PASS",
    reason: notApplicable > 0
      ? `${passed} passed; ${notApplicable} explicitly N/A; 0 failed.`
      : `${passed} passed; 0 failed.`,
  };
}

export function evaluateEvidenceMatrix({
  requiredEvidence = [],
  observations = {},
  buildRequired = false,
  buildObservation = null,
} = {}) {
  const required = new Set(requiredEvidence);
  for (const evidenceClass of required) {
    if (!behavioralClasses.has(evidenceClass)) throw new Error(`Unknown required evidence class: ${evidenceClass}`);
  }

  const evidence = {};
  for (const evidenceClass of policy.behavioralClasses ?? []) {
    const observation = observations[evidenceClass];
    if (!observation) {
      evidence[evidenceClass] = {
        status: required.has(evidenceClass) ? "NOT RUN" : "N/A",
        reason: required.has(evidenceClass) ? "Required evidence has not run." : "Evidence class is not required for this candidate.",
      };
      continue;
    }
    evidence[evidenceClass] = evaluateEvidenceObservation(evidenceClass, observation);
  }

  let build;
  if (!buildObservation) {
    build = {
      status: buildRequired ? "NOT RUN" : "N/A",
      reason: buildRequired ? "Required build artifact has not run." : "Build artifact is not required for this candidate.",
    };
  } else if (buildObservation.sourceGate !== policy.buildArtifact) {
    build = { status: "PARTIAL", reason: "Build observation did not come from the canonical build gate." };
  } else if (buildObservation.ran !== true) {
    build = { status: "NOT RUN", reason: "Build gate did not run." };
  } else if (buildObservation.failed === true) {
    build = { status: "FAIL", reason: "Build gate failed." };
  } else {
    build = { status: "PASS", reason: "Build gate completed successfully." };
  }

  const requiredStatuses = [...required].map((evidenceClass) => evidence[evidenceClass].status);
  if (buildRequired) requiredStatuses.push(build.status);
  const overallStatus = requiredStatuses.some((status) => status === "FAIL" || status === "PARTIAL")
    ? "FAIL"
    : requiredStatuses.some((status) => status === "NOT RUN")
      ? "NOT RUN"
      : "PASS";

  return { evidence, build, overallStatus, overallPass: overallStatus === "PASS" };
}
