"""Small performance helpers for the logbook app.

This module is intentionally conservative. It only contains helpers that are
safe to apply to the current single-user SQLite deployment and do not change the
visible behaviour of the app.
"""
from __future__ import annotations

import json
import math
import sqlite3
from typing import Any

import pandas as pd


READ_PRAGMAS = (
    "PRAGMA foreign_keys = ON",
    "PRAGMA busy_timeout = 10000",
    "PRAGMA temp_store = MEMORY",
    "PRAGMA cache_size = -32768",
)

INIT_PRAGMAS = READ_PRAGMAS + (
    "PRAGMA journal_mode = WAL",
    "PRAGMA synchronous = NORMAL",
)


def apply_sqlite_pragmas(con: sqlite3.Connection, *, initial: bool = False) -> None:
    """Apply safe SQLite pragmas used by all app connections."""
    for pragma in INIT_PRAGMAS if initial else READ_PRAGMAS:
        try:
            con.execute(pragma)
        except sqlite3.DatabaseError:
            pass


def optimize_sqlite(con: sqlite3.Connection) -> None:
    """Ask SQLite to refresh lightweight optimizer statistics when supported."""
    try:
        con.execute("PRAGMA optimize")
    except sqlite3.DatabaseError:
        pass


def compact_records_json(df: pd.DataFrame, columns: list[str]) -> str:
    """Return stable compact JSON for cache keys and HTML map caches."""
    if df.empty:
        return "[]"
    use_cols = [c for c in columns if c in df.columns]
    if not use_cols:
        return "[]"
    records = df[use_cols].fillna("").to_dict(orient="records")
    return json.dumps(records, ensure_ascii=False, separators=(",", ":"), default=str)


def downsample_track_points(points: list[dict[str, Any]], max_points: int = 900) -> list[dict[str, Any]]:
    """Keep maps light while preserving first and last point."""
    if len(points) <= max_points:
        return points
    step = max(1, math.ceil(len(points) / max_points))
    sampled = points[::step]
    if sampled and sampled[-1] != points[-1]:
        sampled.append(points[-1])
    return sampled
