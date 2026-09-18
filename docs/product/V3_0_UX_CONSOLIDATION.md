# FlyTally v3.0 — UX & Product Consolidation

Status: **current product track**  
Scope: FlyTally Logbook + FlyTally Training  
Principle: improve the workflows already in production before adding new product capability.

## Product objective

FlyTally should answer three questions without requiring the user to understand its internal architecture:

1. **Where do I go for the task I have right now?**
2. **What is the next action?**
3. **What is detail/evidence that I can ignore until I need it?**

v3.0 is therefore not a visual redesign and not a feature expansion. It is an information-architecture, progressive-disclosure and workflow-quality release.

## Primary pilot tasks

The product is optimized around these everyday jobs:

1. record a flight;
2. find/review an existing flight;
3. understand licence, rating and recency status;
4. manage aircraft and airport records;
5. print/export/recover logbook data;
6. open Training and choose an aircraft;
7. in Training, choose between Fly, Learn and Reference.

Everything else is secondary navigation or contextual detail.

## Audit findings

### Logbook global navigation — high friction

Before v3.0 U1 the sidebar mixed:

- destinations: Dashboard, Flights, Map, Statistics;
- contextual sub-workflows: Needs attention, FSTD sessions;
- a primary action: Add flight;
- asynchronous state: Actions, Notifications;
- account/data management.

That makes the global navigation encode implementation structure rather than user intent.

**U1 decision:** keep only durable destinations global. Make Add flight a visually distinct action. Move Needs attention and FSTD into a local Flights workspace. Notifications are application chrome, not navigation: expose one bell with a live unread badge. The Action Center remains available from contextual entry points such as Notifications and Dashboard, but it is not a second global navigation signal. Keep account/data destinations in Pilot & records.

### Dashboard — generally correct, review later

Dashboard is already an all-time at-a-glance surface rather than a second Statistics page. The primary Add flight action is clear. Later v3.0 work should reduce duplicate explanatory text and ensure the dashboard prioritizes current pilot state over secondary analytics.

### Flights — strong search, weak hierarchy

The Flights list is capable but previously depended on sidebar sublinks for related records. After removing those global links, U1 adds one local records navigation shared by All flights, Needs attention and FSTD sessions.

The advanced filter set is intentionally retained; U4 will review whether progressive disclosure and result density can be improved without removing capability.

### Licences & recency — next major audit target

The workspace already has section tabs, but it still combines licence/rating management, recency, aircraft training, documents and professional experience. This is technically complete but cognitively dense.

**U2 target:** make Overview answer only “am I current / what needs action?”, then reveal editing/evidence only in the relevant section.

### Aircraft, airports, data and settings — management density

Aircraft & airports, Print & data and Settings are all valid destinations but contain multiple administrative concepts and substantial explanatory copy.

**U3 target:** simplify section hierarchy and defaults without removing recovery, privacy or regulatory evidence.

### Flight save → review → certify → share — conceptually correct, still multi-stage

The safety model should remain. v3.0 must not collapse certification/evidence into an unsafe “one click” workflow.

**U4 target:** make the current stage and next safe action obvious while preserving revision, certification and sharing semantics.

### Training navigation — good baseline

Training already has a strong primary model:

`Home / Fly / Learn / Reference`

Progress is secondary and aircraft variant is a utility rather than a navigation destination. This should be preserved.

One U1 friction was the mobile install prompt appearing before the aircraft list, interrupting the primary “choose aircraft” task. It now follows the aircraft list.

**U5 target:** review learner pages for repeated headings, source/evidence prominence, terminology and cockpit-use density without rebuilding the existing navigation architecture.

### Mobile — release gate, not cleanup

U6 will re-audit the core tasks on narrow/touch layouts. Mobile changes must preserve safe areas, keyboard/focus behavior, large tables and Training bottom navigation.

## v3.0 sequence

- **U0 ✅ Product UX audit and task model**
- **U1 ✅ Navigation & task hierarchy**
  - simplify Logbook global navigation;
  - contextualize Flights sub-workflows;
  - preserve Training task navigation;
  - keep installation secondary to aircraft selection;
  - move Notifications out of navigation into a live unread bell;
  - U1.2: remove the redundant Activity section, flatten Pilot & records navigation, fix light-theme section contrast, stack collapsed desktop chrome cleanly and constrain the wide-screen notification inbox;
  - U1.3: use the notification bell as the only global activity signal, group bell + mobile menu together in the top-right chrome, and visually separate Administration from pilot records.
- **U2 ✅ Licences & recency**
  - Overview now answers only current status / required action;
  - Recency shows flying recency only and keeps evidence/settings one level deeper;
  - licence, document and aircraft-training editors live under a dedicated Records layer;
  - professional experience is no longer mixed into the Licences overview.
- **U3 ✅ Aircraft / Data / Settings**
  - **U3.1 ✅ Aircraft & airports:** Aircraft, Airports and Data health are now separate workspaces; the default page shows only aircraft management, the worldwide airport catalogue is search-on-demand, and diagnostics / historical code maintenance no longer interrupt everyday management.
  - **U3.1a ✅ Personal aircraft sharing & identity:** an aircraft profile can be sent to an accepted Connection as a one-time copy with sender-selected photo, defaults, current rate, rate history and notes. Existing recipient registrations are merged by explicit import choices instead of duplicated; no fleet ownership or ongoing synchronization is introduced.
  - **U3.2 ✅ Print & data:** Print/export, backup/restore and deleted-flight recovery are separate task workspaces; portable JSON backup now lives with recovery, technical output notes use progressive disclosure, and backup/trash data is loaded only when its workspace is opened.
  - **U3.3 ✅ Settings:** General, Account & security and Privacy are separate task workspaces; security/privacy queries load only in their own workspace, licence management is no longer duplicated in Settings, portable backup is handed off to Print & data, and access/data-retention detail uses progressive disclosure.
- **Cross-cutting UX ✅ Push notifications:** the existing notification inbox remains the source of truth while standards-based Web Push adds per-device delivery. Opt-in is discoverable through onboarding, Recency and the notification inbox, with persistent account preferences in Settings. Compliance reminders reuse the existing rule engines and advance through staged reminder dedupe rather than creating a second regulatory evaluator.
- **U4 ✅ Flight workflow clarity:** Save now hands both manual and GPS entries directly into final Logbook review; flight detail shows one durable Saved → Review → Certify → Share progression with the next safe action; public sharing is restricted to certified revisions and is invalidated when a correction is opened.
- **U5 — Training learner polish — next**
- **U6 — Mobile, accessibility and final UX acceptance**

## Explicit non-goals

During v3.0 do not:

- add a second aircraft merely to prove scaling;
- add new regulatory automation;
- create Quick/Simple/Advanced parallel versions of existing workflows;
- weaken certification, source governance or fail-closed controls;
- hide important evidence by deleting it rather than applying progressive disclosure.

Multi-aircraft scale moves to **v3.1**, after v3.0 proves that the current product is understandable with the capability it already has.
