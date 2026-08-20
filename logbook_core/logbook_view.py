from __future__ import annotations

from typing import Any, Iterable

import pandas as pd

DEFAULT_SEARCH_COLUMNS = (
    "date",
    "evidence",
    "registration",
    "aircraft_type",
    "aircraft_class",
    "departure",
    "arrival",
    "role",
    "commander",
    "instructor",
    "task",
    "note",
)


def quick_search_flights(
    df: pd.DataFrame,
    query: str,
    *,
    columns: Iterable[str] = DEFAULT_SEARCH_COLUMNS,
) -> pd.DataFrame:
    """Fast case-insensitive literal search across common flight fields.

    The implementation ORs column masks instead of building one large
    concatenated string per row. That reduces temporary memory for larger
    logbooks while preserving the existing search behaviour.
    """
    if df is None or df.empty:
        return df.copy() if isinstance(df, pd.DataFrame) else pd.DataFrame()

    needle = str(query or "").strip().casefold()
    if not needle:
        return df.copy()

    available = [column for column in columns if column in df.columns]
    if not available:
        return df.iloc[0:0].copy()

    mask = pd.Series(False, index=df.index)
    for column in available:
        values = df[column].fillna("").astype(str).str.casefold()
        mask = mask | values.str.contains(needle, regex=False, na=False)
    return df.loc[mask].copy()


def flight_navigation(ids: Iterable[Any], current_id: int) -> dict[str, int | None]:
    """Return previous/next IDs in the exact order of the current list."""
    ordered: list[int] = []
    seen: set[int] = set()
    for value in ids:
        try:
            item = int(value)
        except (TypeError, ValueError):
            continue
        if item <= 0 or item in seen:
            continue
        seen.add(item)
        ordered.append(item)

    try:
        current = int(current_id)
    except (TypeError, ValueError):
        current = 0

    if current not in seen:
        return {
            "position": None,
            "total": len(ordered),
            "previous_id": None,
            "next_id": None,
        }

    index = ordered.index(current)
    return {
        "position": index + 1,
        "total": len(ordered),
        "previous_id": ordered[index - 1] if index > 0 else None,
        "next_id": ordered[index + 1] if index + 1 < len(ordered) else None,
    }
