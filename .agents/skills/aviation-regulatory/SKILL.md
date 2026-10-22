---
name: aviation-regulatory
description: Apply to EASA/FAA and other pilot rules, ratings, recency, privileges, endorsements, certification evidence, currency/compliance calculations and aviation-related claims.
---
# Aviation & Regulatory Logic

## When to load
Any logic or UI describing privileges, valid ratings, currency, recency, flight requirements, regulatory compliance or verified evidence.

## Procedure
1. Identify jurisdiction, regulatory version/effective date, license/aircraft/category, privileges and operator-specific applicability. Do not treat EASA, FAA and national rules as interchangeable.
2. Prefer current regulator text and legally applicable primary sources; record document, paragraph, date, effectivity and ambiguities. Distinguish source quotation, implementation decision and operational approval.
3. Separate recorded evidence from derived calculation, estimated experience and advisory explanation. A computed indicator is never an approved license/medical/certificate.
4. Require explicit source-backed criteria for CURRENT/VALID/compliant labels. Missing, contradictory or stale evidence => Needs verification / Unavailable, not an inferred positive decision.
5. Preserve old evidence and corrections for audit. Never silently change rule applicability, classifications or credit of historic flights.
6. Challenge edge cases: expiry inclusivity, look-back windows, leap/daylight-saving boundaries, dual/solo/PIC, type/rating differences, national exceptions, and missing dates.

## Hard stops
Never invent regulatory thresholds, approval or recency. Never promote secondary training material to authority over manufacturer/regulator; this skill belongs to Logbook, not aircraft performance or Training.

## References and verification
Use current ROADMAP, ARCHITECTURE and targeted code/tests plus relevant primary regulation. Add source/fixture-based tests, negative cases and exact-SHA risk-selected verification before any user-visible status change.