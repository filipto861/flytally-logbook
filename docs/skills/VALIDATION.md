# Skills V1 — validation and acceptance

This documentation-only change must not modify app/, components/, lib/, sql/, migrations, production configuration, dependencies or package scripts.

## Source-level acceptance
1. Nine distinct .agents/skills/<name>/SKILL.md files exist.
2. Each begins with frontmatter containing unique name and actionable description.
3. Router has one activation entry per skill and differentiates Flight Integrity, Regulatory, Security and UI.
4. AGENTS.md directs agents to read the registry and task-relevant full skill before modifying code.
5. Canonical precedence is explicit: code/runtime > ROADMAP > FEATURES > CHANGELOG > design methodology and handoffs.
6. Safe fail-closed aviation, exact SHA evidence, DB isolation and no implicit merge/deploy remain intact.
7. Third-party license/attribution is retained and source content is adapted rather than silently installed.
8. ChatGPT Project Instructions addendum identifies manual paste/enablement; GitHub commit alone does not alter Project settings.

## Runtime and release evidence
For a docs-only candidate, run a read-only source checker or inspect complete GitHub file tree, cross-links/frontmatter and PR changed files. Consult DEVELOPMENT.md for candidate risk plan; selected gates cannot be assumed N/A. Browser/native Safari, PostgreSQL, build and production smoke may be NOT RUN, not PASS. No deployment, migration or flag change is needed for this capability.

## Test scenarios
- "Pokračuj" -> verify GitHub and read AGENTS/ROADMAP/Project Memory, then route to task skill.
- "Simplify New Flight" -> ui-ux-design + flight-integrity + relevant testing; never auto-fill last aircraft.
- "Fix recency" -> aviation-regulatory + flight-integrity; require source/effectivity.
- "Polish mobile iPad modal" -> ui-ux-design + mobile-ipad + ui-quality-audit.
- "Deploy" -> release-workflow; require separately explicit approval and exact SHA preflight.
- "No GitHub access" -> say UNVERIFIED; do not claim skill was loaded.