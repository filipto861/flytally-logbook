# FlyTally Logbook — Agent Skills V1 (Apple Design V2 proposal pending)

This is the task-specific skill registry for filipto861/flytally-logbook ONLY. Never apply to flytally-training.

## Authority and loading
1. AGENTS.md is the mandatory session entrypoint; the live repository, executable contracts and actual runtime evidence take precedence over all prose.
2. ROADMAP.md owns current priorities/owner decisions; FEATURES.md capabilities; ARCHITECTURE.md domain boundaries; DEVELOPMENT.md evidence/testing; CHANGELOG.md dated changes; docs/PROJECT_MEMORY/* rolling pointers only.
3. Select ONLY the skill(s) implicated by the user request and code paths. Read the full SKILL.md for each selected skill before designing or editing. For multi-domain work, combine skills without letting one override another. If skill guidance conflicts with code/canonical docs, stop and reconcile.
4. A skill is a procedure, not authority to change product scope, production resources, or approved designs. No implicit merge/deploy, DB/flag changes or automatic data prefill.
5. When no suitable skill exists, follow AGENTS.md and canonical docs; propose a new skill only when a genuinely repeatable workflow emerges.

## Apple Design default for user-visible Logbook changes (pending V2 approval)
Every UI/UX task — including a small button, spacing, form, typography, focus, feedback or mobile correction — must ALSO read the full apple-design/SKILL.md AND its required references/APPLE_DESIGN_PLAYBOOK.md. Apple Design defines evaluation and interaction craft, not permission to add animation, dependencies or change the FlyTally brand. This is a proposed V2 addition until merged.

## Activation registry

| Request / changed boundary | Primary skills | Add when relevant |
| --- | --- | --- |
| Add/Edit/Quick Add, flight sharing, audit, roles, GPS import | flight-integrity | aviation-regulatory, database-security, testing-quality |
| Pilot licences, recency, evidence, regulatory claims | aviation-regulatory | flight-integrity, testing-quality |
| Page redesign, consistency, forms, buttons, loading | ui-ux-design + apple-design | design-engineering, mobile-ipad, ui-quality-audit |
| Gestures, transitions, typography, subtle motion | apple-design + design-engineering | ui-ux-design, mobile-ipad |
| PWA, touch, iPad, responsive/Safari | mobile-ipad + apple-design | ui-ux-design, ui-quality-audit |
| UI audit, accessibility, hostile fixture data | ui-quality-audit + apple-design | mobile-ipad, testing-quality |
| Auth, permissions, database, schema, data recovery | database-security | flight-integrity, testing-quality |
| Tests, candidate selection, Playwright, failures | testing-quality | affected domain skill |
| Branch/PR, docs, releases, handoff, Vercel | release-workflow | testing-quality |

New Apple Design skill (proposed V2): apple-design — read SKILL.md + its REQUIRED playbook together.

Paths for each skill: .agents/skills/<skill-name>/SKILL.md.

## External design reference
The user-provided skills-main.zip (15 skills) was reviewed for design practice. Relevant approaches from Emil Kowalski's design engineering, apple-design, mobile-native, break-ui, animate and animation-performance are ADAPTED in our project skills, not activated as unfiltered commands. See docs/skills/THIRD_PARTY_SOURCES.md. Vendor library choices, imposed introductory responses, and generic examples do not override FlyTally-specific architecture, accessibility, or safety.

## Authoring rules
Every skill includes YAML frontmatter name/description, trigger, steps, hard stops, references and verification. Keep skills narrow; avoid duplicating ROADMAP release status, code maps or frozen decisions. New skills or updates require a scoped branch, review of canonical docs, and explicit user approval for merge.