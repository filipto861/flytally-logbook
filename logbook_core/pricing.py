from __future__ import annotations

from datetime import date
from typing import Any

import pandas as pd


def lookup_latest_rate(rates: pd.DataFrame, registration: str, on_date: Any = None) -> dict[str, Any]:
    """Return the rate effective on ``on_date``; future rates stay inactive.

    Undated legacy rows are used only as a fallback when no dated rate applies.
    """
    if rates.empty or not registration:
        return {}
    reg = registration.strip().upper()
    sub = rates[rates["registration"].fillna("").astype(str).str.upper().str.strip().eq(reg)].copy()
    if sub.empty:
        return {}
    sub["valid_from_dt"] = pd.to_datetime(sub["valid_from"], errors="coerce")
    try:
        target = pd.Timestamp(on_date if on_date is not None else date.today()).normalize()
    except Exception:
        target = pd.Timestamp(date.today())
    dated = sub[sub["valid_from_dt"].notna() & (sub["valid_from_dt"].dt.normalize() <= target)]
    if not dated.empty:
        sort_cols = ["valid_from_dt"] + (["id"] if "id" in dated.columns else [])
        row = dated.sort_values(sort_cols).iloc[-1]
    else:
        legacy = sub[sub["valid_from_dt"].isna()]
        if legacy.empty:
            return {}
        row = legacy.iloc[-1]
    return {
        "id": row.get("id"),
        "aircraft_type": row.get("aircraft_type"),
        "price_per_hour": row.get("price_per_hour"),
        "valid_from": row.get("valid_from"),
        "source": row.get("source"),
    }
