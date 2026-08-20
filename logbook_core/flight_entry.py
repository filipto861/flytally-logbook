from __future__ import annotations

from datetime import date
from typing import Any

import pandas as pd


def _text(value: Any) -> str:
    if value is None:
        return ""
    try:
        if pd.isna(value):
            return ""
    except Exception:
        pass
    return str(value).strip()


def _upper(value: Any) -> str:
    return _text(value).upper()


def latest_flight_context(df: pd.DataFrame) -> dict[str, Any]:
    """Return a small, stable snapshot of the most recent logged flight."""
    if df is None or df.empty:
        return {}

    work = df.copy()
    if "date" not in work.columns:
        return {}

    work["_entry_date"] = pd.to_datetime(work["date"], errors="coerce")
    if "off_block" in work.columns:
        work["_entry_off"] = work["off_block"].fillna("").astype(str)
    else:
        work["_entry_off"] = ""
    if "id" not in work.columns:
        work["id"] = range(1, len(work) + 1)

    work = work.sort_values(
        ["_entry_date", "_entry_off", "id"],
        ascending=[False, False, False],
        na_position="last",
    )
    if work.empty:
        return {}

    row = work.iloc[0]
    return {
        "id": int(row.get("id") or 0),
        "date": _text(row.get("date")),
        "registration": _upper(row.get("registration")),
        "departure": _upper(row.get("departure")),
        "arrival": _upper(row.get("arrival")),
        "evidence": _upper(row.get("evidence")),
        "role": _upper(row.get("role")),
        "commander": _text(row.get("commander")),
    }


def manual_entry_defaults(
    df: pd.DataFrame,
    *,
    today: date,
    home_airport: str,
    default_evidence: str,
    default_role: str,
    commander: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Build conservative smart defaults for a new manually entered flight.

    Continuity is inferred only for the next departure and last aircraft.
    Times and next destination are intentionally never guessed.
    """
    context = latest_flight_context(df)
    departure = _upper(context.get("arrival")) or _upper(home_airport)
    registration = _upper(context.get("registration"))

    defaults = {
        "date": today,
        "evidence": _upper(default_evidence) or "ULL",
        "aircraft_class": "",
        "registration": registration,
        "departure": departure,
        "arrival": "",
        "starts": 1,
        "commander": _text(commander),
        "role": _upper(default_role) or "PIC",
    }
    return defaults, context


def frequent_destinations(
    df: pd.DataFrame,
    departure: str,
    *,
    limit: int = 4,
) -> list[tuple[str, int]]:
    """Most frequently used destinations from one departure airport."""
    dep = _upper(departure)
    if not dep or df is None or df.empty:
        return []
    if "departure" not in df.columns or "arrival" not in df.columns:
        return []

    work = df[["departure", "arrival"]].copy()
    work["departure"] = work["departure"].fillna("").astype(str).str.upper().str.strip()
    work["arrival"] = work["arrival"].fillna("").astype(str).str.upper().str.strip()
    work = work[work["departure"].eq(dep) & work["arrival"].ne("")]
    if work.empty:
        return []

    counts = (
        work.groupby("arrival", as_index=False)
        .size()
        .sort_values(["size", "arrival"], ascending=[False, True])
        .head(max(0, int(limit)))
    )
    return [(str(row["arrival"]), int(row["size"])) for _, row in counts.iterrows()]
