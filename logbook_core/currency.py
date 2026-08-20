from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable

import pandas as pd


def _dates(df: pd.DataFrame) -> pd.Series:
    if df.empty or "date" not in df.columns:
        return pd.Series(pd.NaT, index=df.index, dtype="datetime64[ns]")
    return pd.to_datetime(df["date"], errors="coerce")


def _upper(df: pd.DataFrame, column: str) -> pd.Series:
    if column not in df.columns:
        return pd.Series("", index=df.index, dtype="object")
    return df[column].fillna("").astype(str).str.upper().str.strip()


def _numeric(df: pd.DataFrame, column: str) -> pd.Series:
    if column not in df.columns:
        return pd.Series(0, index=df.index, dtype="float64")
    return pd.to_numeric(df[column], errors="coerce").fillna(0)


def _prepare(df: pd.DataFrame, as_of: date) -> pd.DataFrame:
    if df.empty:
        return df.copy()
    work = df.copy()
    work["_date"] = _dates(work)
    work = work.dropna(subset=["_date"])
    if work.empty:
        return work
    cutoff = pd.Timestamp(as_of)
    return work.loc[work["_date"] <= cutoff].copy()


def last_activity(df: pd.DataFrame, as_of: date) -> dict[str, object]:
    """Return last flight/landing dates and days since those events."""
    work = _prepare(df, as_of)
    if work.empty:
        return {
            "last_flight_date": None,
            "last_landing_date": None,
            "days_since_last_flight": None,
            "days_since_last_landing": None,
        }

    last_flight_ts = work["_date"].max()
    starts = _numeric(work, "starts")
    landing_rows = work.loc[starts > 0]
    last_landing_ts = landing_rows["_date"].max() if not landing_rows.empty else pd.NaT

    def conv(value):
        if pd.isna(value):
            return None, None
        d = pd.Timestamp(value).date()
        return d, (as_of - d).days

    last_flight, flight_days = conv(last_flight_ts)
    last_landing, landing_days = conv(last_landing_ts)
    return {
        "last_flight_date": last_flight,
        "last_landing_date": last_landing,
        "days_since_last_flight": flight_days,
        "days_since_last_landing": landing_days,
    }


def recency_by_evidence(df: pd.DataFrame, as_of: date, days: int = 90) -> pd.DataFrame:
    """Summarize PIC activity for ULL and EASA over a rolling window.

    This deliberately reports observed logbook activity only. It does not claim
    regulatory passenger-carrying currency because the app does not track every
    legal dimension (take-offs, approaches, day/night, type/class equivalence,
    sole-manipulator conditions, etc.).
    """
    days = max(1, int(days))
    work = _prepare(df, as_of)
    columns = [
        "evidence", "days", "pic_flights", "pic_landings", "pic_minutes",
        "last_pic_date", "days_since_last_pic",
    ]
    if work.empty:
        return pd.DataFrame([
            {"evidence": ev, "days": days, "pic_flights": 0, "pic_landings": 0, "pic_minutes": 0, "last_pic_date": None, "days_since_last_pic": None}
            for ev in ("ULL", "EASA")
        ], columns=columns)

    cutoff = pd.Timestamp(as_of - timedelta(days=days - 1))
    role = _upper(work, "role")
    evidence = _upper(work, "evidence")
    starts = _numeric(work, "starts")
    block = _numeric(work, "block_minutes")
    pic = role.eq("PIC")

    rows: list[dict[str, object]] = []
    for ev in ("ULL", "EASA"):
        all_pic_mask = pic & evidence.eq(ev)
        window_mask = all_pic_mask & work["_date"].ge(cutoff)
        last_ts = work.loc[all_pic_mask, "_date"].max() if bool(all_pic_mask.any()) else pd.NaT
        if pd.isna(last_ts):
            last_date = None
            days_since = None
        else:
            last_date = pd.Timestamp(last_ts).date()
            days_since = (as_of - last_date).days
        rows.append({
            "evidence": ev,
            "days": days,
            "pic_flights": int(window_mask.sum()),
            "pic_landings": int(starts.where(window_mask, 0).sum()),
            "pic_minutes": int(block.where(window_mask, 0).sum()),
            "last_pic_date": last_date,
            "days_since_last_pic": days_since,
        })
    return pd.DataFrame(rows, columns=columns)


def activity_windows(df: pd.DataFrame, as_of: date, windows: Iterable[int] = (30, 90, 365)) -> pd.DataFrame:
    """Build a compact recent-activity table for common rolling windows."""
    work = _prepare(df, as_of)
    columns = [
        "days", "flights", "landings", "block_minutes", "pic_minutes",
        "pic_landings", "ull_pic_landings", "easa_pic_landings",
    ]
    role = _upper(work, "role") if not work.empty else pd.Series(dtype="object")
    evidence = _upper(work, "evidence") if not work.empty else pd.Series(dtype="object")
    starts = _numeric(work, "starts") if not work.empty else pd.Series(dtype="float64")
    block = _numeric(work, "block_minutes") if not work.empty else pd.Series(dtype="float64")
    pic = role.eq("PIC") if not work.empty else pd.Series(dtype="bool")

    rows: list[dict[str, int]] = []
    for raw_days in windows:
        days = max(1, int(raw_days))
        if work.empty:
            rows.append({key: 0 for key in columns} | {"days": days})
            continue
        cutoff = pd.Timestamp(as_of - timedelta(days=days - 1))
        mask = work["_date"].ge(cutoff)
        pic_mask = mask & pic
        rows.append({
            "days": days,
            "flights": int(mask.sum()),
            "landings": int(starts.where(mask, 0).sum()),
            "block_minutes": int(block.where(mask, 0).sum()),
            "pic_minutes": int(block.where(pic_mask, 0).sum()),
            "pic_landings": int(starts.where(pic_mask, 0).sum()),
            "ull_pic_landings": int(starts.where(pic_mask & evidence.eq("ULL"), 0).sum()),
            "easa_pic_landings": int(starts.where(pic_mask & evidence.eq("EASA"), 0).sum()),
        })
    return pd.DataFrame(rows, columns=columns)


def expiry_status(expiry_date: object, as_of: date, warning_days: int = 30) -> dict[str, object]:
    """Classify one user-managed validity/expiry date."""
    try:
        parsed = pd.to_datetime(expiry_date, errors="coerce")
    except Exception:
        parsed = pd.NaT
    if pd.isna(parsed):
        return {"state": "missing", "days_left": None, "expiry_date": None, "label": "Bez data"}

    expiry = pd.Timestamp(parsed).date()
    days_left = (expiry - as_of).days
    warning_days = max(0, int(warning_days or 0))
    if days_left < 0:
        state, label = "expired", "Expirováno"
    elif days_left <= warning_days:
        state, label = "warning", "Brzy expiruje"
    else:
        state, label = "ok", "Platné"
    return {"state": state, "days_left": days_left, "expiry_date": expiry, "label": label}


def expiry_overview(df: pd.DataFrame, as_of: date) -> pd.DataFrame:
    """Attach status metadata to user expiry records and sort by urgency."""
    columns = ["id", "category", "label", "expiry_date", "warning_days", "note", "state", "status", "days_left"]
    if df.empty:
        return pd.DataFrame(columns=columns)

    work = df.copy()
    if "active" in work.columns:
        work = work[pd.to_numeric(work["active"], errors="coerce").fillna(0).astype(int).eq(1)]
    rows = []
    for _, row in work.iterrows():
        status = expiry_status(row.get("expiry_date"), as_of, int(row.get("warning_days") or 0))
        rows.append({
            "id": int(row.get("id") or 0),
            "category": str(row.get("category") or "Doklad"),
            "label": str(row.get("label") or ""),
            "expiry_date": status["expiry_date"],
            "warning_days": int(row.get("warning_days") or 0),
            "note": str(row.get("note") or ""),
            "state": status["state"],
            "status": status["label"],
            "days_left": status["days_left"],
        })
    if not rows:
        return pd.DataFrame(columns=columns)
    out = pd.DataFrame(rows, columns=columns)
    priority = {"expired": 0, "warning": 1, "ok": 2, "missing": 3}
    out["_priority"] = out["state"].map(priority).fillna(9)
    return out.sort_values(["_priority", "expiry_date", "label"], na_position="last").drop(columns="_priority").reset_index(drop=True)
