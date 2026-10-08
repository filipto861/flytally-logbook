import { fileURLToPath } from "node:url";
import { classifyDevelopmentScope } from "./development-scope.mjs";
import { selectBrowserEvidence } from "./browser-risk-selection.mjs";
import { selectDirectEvidenceForModules } from "./development-evidence.mjs";
import { CandidateInputError, resolveVerificationCandidate } from "./verification-candidate.mjs";

export function createVerificationPlan(argv) {
  const { candidate, options } = resolveVerificationCandidate(argv);
  const classification = classifyDevelopmentScope(
    candidate.files,
    options.forceAll ? "[full-ci] verify:plan --force-all" : "",
  );
  const domainRequired=classification.requiredEvidence.includes("domain-unit");
  const directDomain=domainRequired
    ?selectDirectEvidenceForModules(classification.modules,"domain-unit")
    :{evidenceClass:"domain-unit",modules:[],tests:[],missingModules:[]};
  const domainBlocked=domainRequired
    ?directDomain.missingModules.map((moduleId)=>"domain-unit:"+moduleId+":missing-approved-tests")
    :[];
  const browserEvidence=selectBrowserEvidence(candidate,classification);
  const blockedEvidence=[...domainBlocked,...browserEvidence.blockers];

  return {
    schemaVersion: 1,
    candidate,
    forceAll: options.forceAll,
    plan: {
      typecheck: classification.typecheck,
      postgres: classification.postgres,
      scale: classification.scale,
      browser: classification.browser,
      fullTests: classification.fullTests,
      build: classification.build,
      modules: classification.modules,
      risks: classification.risks,
      testGroups: classification.testGroups,
      targetedTests: classification.targetedTests,
      requiredEvidence: classification.requiredEvidence,
      aggregateGates: classification.aggregateGates,
      buildArtifactRequired: classification.buildArtifactRequired,
      browserEvidence,
      directEvidence: {
        "domain-unit": {
          required: domainRequired,
          modules: directDomain.modules,
          tests: directDomain.tests,
          missingModules: directDomain.missingModules,
        },
      },
      blockedEvidence,
    },
  };
}

function printHuman(result) {
  const { candidate, plan } = result;
  const line = (key, value) => process.stdout.write(key + "=" + value + "\n");
  line("candidate_id", candidate.candidateId);
  line("head_sha", candidate.headSha);
  line("base_sha", candidate.baseSha ?? "none");
  line("candidate_source", candidate.source.kind + (candidate.source.value ? ":" + candidate.source.value : ""));
  line("files_hash", candidate.filesHash);
  line("files", candidate.files.join(",") || "none");
  line("typecheck", plan.typecheck);
  line("postgres", plan.postgres);
  line("scale", plan.scale);
  line("browser", plan.browser);
  line("full_tests", plan.fullTests);
  line("build", plan.build);
  line("modules", plan.modules.join(",") || "none");
  line("risks", plan.risks.join(",") || "none");
  line("test_groups", plan.testGroups.join(",") || "none");
  line("targeted_tests", plan.targetedTests.join(",") || "none");
  line("required_evidence", plan.requiredEvidence.join(",") || "none");
  line("aggregate_gates", plan.aggregateGates.join(",") || "none");
  line("build_artifact", plan.buildArtifactRequired ? "required" : "not-required");
  line("browser_source",plan.browserEvidence.authoritativeSource);
  line("browser_selection_hash",plan.browserEvidence.selectionHash);
  line("browser_targets",plan.browserEvidence.targets.map((target)=>target.id).join(",")||"none");
  line("browser_blockers",plan.browserEvidence.blockers.join(",")||"none");
  line("domain_unit_modules", plan.directEvidence["domain-unit"].modules.join(",") || "none");
  line("domain_unit_tests", plan.directEvidence["domain-unit"].tests.join(",") || "none");
  line("blocked_evidence", plan.blockedEvidence.join(",") || "none");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const result = createVerificationPlan(process.argv.slice(2));
    if (process.argv.includes("--json")) {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    } else {
      printHuman(result);
    }
    if(result.plan.blockedEvidence.length>0)process.exitCode=3;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(error instanceof CandidateInputError ? error.exitCode : 2);
  }
}
