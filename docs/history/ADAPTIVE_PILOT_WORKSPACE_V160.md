# FlyTally v1.60 — Adaptive Pilot Workspace

## Goal

Make FlyTally simpler for an everyday pilot while preparing the UI architecture for more aircraft categories and licence systems later.

The core rule is: **regulatory complexity stays inside FlyTally; the user sees only the status and evidence relevant to their own profile.**

## Scope

- Replace the normal Licences Overview with an adaptive status workspace.
- Show only credentials, privileges and documents actually present in the user's account.
- Keep items needing attention at the top.
- Keep licence validity explicitly separate from flying recency.
- Use the existing authoritative Recency Engine for LAPL(A) SEP/TMG flying-privilege status.
- Keep detailed Licences & ratings, Recency, Aircraft training and Medical & documents workspaces intact one level below Overview.
- Add presentation-only pilot category classification as groundwork for future aeroplane, ULL, sailplane, helicopter and balloon support.

## Safety boundary

v1.60 does **not** introduce a new regulatory calculation engine, database migration, certification payload, flight-credit rule or automatic legal conclusion.

The new `lib/pilot-workspace.ts` layer is presentation-only. It may classify an existing credential for display, but it must never decide whether a flight qualifies, whether a pilot is legally current, or whether experience can be credited.

Existing v1.51 regulatory behavior, certification/revision semantics, v1.59 flight-entry behavior, backup/restore and cross-user evidence remain unchanged.

## UX model

Level 1 — Overview: status and required attention.

Level 2 — Detail: credential records, recency calculations, training and documents.

Level 3 — Evidence: the existing exact recency/certification evidence views.

This is the architectural baseline for the later category-aware flight-entry and gliding phases.
