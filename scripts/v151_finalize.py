from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def patch(path: str, old: str, new: str, expected: int = 1) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{path}: expected {expected} occurrence(s) of {old!r}, found {count}")
    target.write_text(text.replace(old, new), encoding="utf-8")


# Application logic: preserve an explicitly recorded zero movement count while editing.
# `Number(value) || landingCount` incorrectly turned a legitimate 0 into the landing count,
# manufacturing take-off/approach evidence that the pilot had explicitly removed.
for name, fallback in (
    ("takeoffs_day", "initialLandingsDay"),
    ("takeoffs_night", "initialLandingsNight"),
    ("approaches_day", "initialLandingsDay"),
    ("approaches_night", "initialLandingsNight"),
):
    patch(
        "components/flight-form.tsx",
        f'editing?Number(field("{name}"))||{fallback}:{fallback}',
        f'editing?(Number(field("{name}","0"))||0):{fallback}',
    )

# v1.51 intentionally retires the v1.35 landing-only CURRENT path. Keep the historical
# helper tests, but migrate assertions that inspected the *current* form/service wiring.
patch(
    "tests/v1355-recency-simplification.test.ts",
    "assert.doesNotMatch(form,/FCL[.]060 movement evidence|Day take-offs|Day approaches|Night take-offs|Night approaches/);",
    "assert.match(form,/pilot flying \\(PF\\)/i);assert.match(form,/Day take-offs/);assert.match(form,/Day approaches/);",
)
patch(
    "tests/v136-mobile-ux.test.ts",
    "assert.match(service,/evaluatePassengerLandingIndicator/);",
    "assert.match(service,/evaluatePassengerCurrencyMode/);",
)

# v1.50 remains a historical release section once package/roadmap move to v1.51.
patch(
    "tests/v150-ui-theme.test.ts",
    "assert.match(roadmap,/Current release — v1\\.50\\.0 · UI system & theme convergence/);",
    "assert.match(roadmap,/## v1\\.50\\.0 · UI system & theme convergence/);",
)

# Test-fixture correction, not a relaxed expectation: the refresher flight previously
# inherited the helper's default 1 take-off/landing, so the supposedly deficient case
# accidentally reached 12 take-offs. Make its PF movement evidence explicitly absent;
# this also isolates the Annex-I assertion to the 12 certified EASA movements.
refresher = 'flight({role:"DUAL",minutes:60,purposeCode:"SEP_TMG_FCL740A_REFRESHER",instructorSigned:true})'
refresher_without_pf_movements = 'flight({role:"DUAL",minutes:60,landingsDay:0,movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0,purposeCode:"SEP_TMG_FCL740A_REFRESHER",instructorSigned:true})'
patch(
    "tests/v151-regulatory-correctness.test.ts",
    refresher,
    refresher_without_pf_movements,
    expected=2,
)

print("v1.51 finalization applied: source logic fixed; intentional regression contracts migrated")
