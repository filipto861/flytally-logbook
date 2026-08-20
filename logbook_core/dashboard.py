from __future__ import annotations

from datetime import date
from typing import Any

import pandas as pd

PERIOD_PRESETS = ("Vše", "Tento rok", "Posledních 12 měsíců", "Předchozí rok")


def primary_pilot_summary(df: pd.DataFrame) -> dict[str, int]:
    """Core dashboard totals focused on pilot logbook priorities.

    ``starts`` is the application's existing Starty / přistání counter, so the
    same value is exposed here as landings for the dashboard category cards.
    """
    keys = (
        "total_minutes", "total_landings", "total_flights",
        "ull_minutes", "ull_landings", "ull_flights",
        "easa_minutes", "easa_landings", "easa_flights",
        "pic_ull_minutes", "pic_ull_landings", "pic_ull_flights",
        "pic_easa_minutes", "pic_easa_landings", "pic_easa_flights",
    )
    if df.empty:
        return {key: 0 for key in keys}

    block = pd.to_numeric(df.get("block_minutes", pd.Series(0, index=df.index)), errors="coerce").fillna(0)
    starts = pd.to_numeric(df.get("starts", pd.Series(0, index=df.index)), errors="coerce").fillna(0)
    evidence = df.get("evidence", pd.Series("", index=df.index)).fillna("").astype(str).str.upper().str.strip()
    role = df.get("role", pd.Series("", index=df.index)).fillna("").astype(str).str.upper().str.strip()

    ull = evidence.eq("ULL")
    easa = evidence.eq("EASA")
    pic = role.eq("PIC")
    pic_ull = pic & ull
    pic_easa = pic & easa

    def count(mask: pd.Series) -> int:
        return int(mask.fillna(False).sum())

    return {
        "total_minutes": int(block.sum()),
        "total_landings": int(starts.sum()),
        "total_flights": int(len(df)),
        "ull_minutes": int(block[ull].sum()),
        "ull_landings": int(starts[ull].sum()),
        "ull_flights": count(ull),
        "easa_minutes": int(block[easa].sum()),
        "easa_landings": int(starts[easa].sum()),
        "easa_flights": count(easa),
        "pic_ull_minutes": int(block[pic_ull].sum()),
        "pic_ull_landings": int(starts[pic_ull].sum()),
        "pic_ull_flights": count(pic_ull),
        "pic_easa_minutes": int(block[pic_easa].sum()),
        "pic_easa_landings": int(starts[pic_easa].sum()),
        "pic_easa_flights": count(pic_easa),
    }


def monthly_primary_summary(df: pd.DataFrame) -> pd.DataFrame:
    """Monthly trend for the compact primary dashboard."""
    columns = [
        "month", "total_hours", "ull_hours", "easa_hours",
        "pic_ull_hours", "pic_easa_hours", "landings",
    ]
    if df.empty:
        return pd.DataFrame(columns=columns)

    work = df.copy()
    work["_date"] = _dates(work)
    work = work.dropna(subset=["_date"])
    if work.empty:
        return pd.DataFrame(columns=columns)

    work["month"] = work["_date"].dt.to_period("M").dt.to_timestamp()
    block = pd.to_numeric(work.get("block_minutes", 0), errors="coerce").fillna(0)
    starts = pd.to_numeric(work.get("starts", 0), errors="coerce").fillna(0)
    evidence = work.get("evidence", pd.Series("", index=work.index)).fillna("").astype(str).str.upper().str.strip()
    role = work.get("role", pd.Series("", index=work.index)).fillna("").astype(str).str.upper().str.strip()

    work["_total"] = block
    work["_ull"] = block.where(evidence.eq("ULL"), 0)
    work["_easa"] = block.where(evidence.eq("EASA"), 0)
    work["_pic_ull"] = block.where(role.eq("PIC") & evidence.eq("ULL"), 0)
    work["_pic_easa"] = block.where(role.eq("PIC") & evidence.eq("EASA"), 0)
    work["_landings"] = starts

    out = work.groupby("month", as_index=False).agg(
        total_minutes=("_total", "sum"),
        ull_minutes=("_ull", "sum"),
        easa_minutes=("_easa", "sum"),
        pic_ull_minutes=("_pic_ull", "sum"),
        pic_easa_minutes=("_pic_easa", "sum"),
        landings=("_landings", "sum"),
    )
    out["total_hours"] = out["total_minutes"] / 60.0
    out["ull_hours"] = out["ull_minutes"] / 60.0
    out["easa_hours"] = out["easa_minutes"] / 60.0
    out["pic_ull_hours"] = out["pic_ull_minutes"] / 60.0
    out["pic_easa_hours"] = out["pic_easa_minutes"] / 60.0
    return out[columns].sort_values("month").reset_index(drop=True)



def _dates(df: pd.DataFrame) -> pd.Series:
    if "date_dt" in df.columns:
        return pd.to_datetime(df["date_dt"], errors="coerce")
    if "date" in df.columns:
        return pd.to_datetime(df["date"], errors="coerce")
    return pd.Series(pd.NaT, index=df.index, dtype="datetime64[ns]")


def filter_period(df: pd.DataFrame, preset: str, today: date) -> pd.DataFrame:
    """Return the requested dashboard period without mutating the input frame."""
    if df.empty or preset == "Vše":
        return df.copy()

    dates = _dates(df)
    today_ts = pd.Timestamp(today)
    if preset == "Tento rok":
        start = pd.Timestamp(today.year, 1, 1)
        mask = dates.between(start, today_ts, inclusive="both")
    elif preset == "Předchozí rok":
        start = pd.Timestamp(today.year - 1, 1, 1)
        end = pd.Timestamp(today.year - 1, 12, 31)
        mask = dates.between(start, end, inclusive="both")
    elif preset == "Posledních 12 měsíců":
        start = today_ts - pd.DateOffset(months=12) + pd.Timedelta(days=1)
        mask = dates.between(start, today_ts, inclusive="both")
    else:
        return df.copy()
    return df.loc[mask.fillna(False)].copy()


def period_label(preset: str, today: date) -> str:
    if preset == "Tento rok":
        return str(today.year)
    if preset == "Předchozí rok":
        return str(today.year - 1)
    if preset == "Posledních 12 měsíců":
        start = pd.Timestamp(today) - pd.DateOffset(months=12) + pd.Timedelta(days=1)
        return f"{start.date().strftime('%d.%m.%Y')}–{today.strftime('%d.%m.%Y')}"
    return "celá historie"


def monthly_summary(df: pd.DataFrame) -> pd.DataFrame:
    columns = ["month", "month_label", "flights", "starts", "block_minutes", "air_minutes", "block_hours", "air_hours", "cost", "gps_km"]
    if df.empty:
        return pd.DataFrame(columns=columns)
    work = df.copy()
    work["_date"] = _dates(work)
    work = work.dropna(subset=["_date"])
    if work.empty:
        return pd.DataFrame(columns=columns)
    work["month"] = work["_date"].dt.to_period("M").dt.to_timestamp()
    out = work.groupby("month", as_index=False).agg(
        flights=("id", "count"),
        starts=("starts", "sum"),
        block_minutes=("block_minutes", "sum"),
        air_minutes=("air_minutes", "sum"),
        cost=("cost", "sum"),
        gps_km=("gps_km", "sum"),
    )
    out["block_hours"] = out["block_minutes"] / 60.0
    out["air_hours"] = out["air_minutes"] / 60.0
    out["month_label"] = out["month"].dt.strftime("%Y-%m")
    return out[columns].sort_values("month").reset_index(drop=True)


def yearly_summary(df: pd.DataFrame) -> pd.DataFrame:
    columns = [
        "year", "flights", "starts", "block_minutes", "air_minutes", "pic_minutes", "dual_minutes",
        "safety_minutes", "ull_minutes", "easa_minutes", "cost", "gps_km",
    ]
    if df.empty:
        return pd.DataFrame(columns=columns)
    work = df.copy()
    work["_date"] = _dates(work)
    work = work.dropna(subset=["_date"])
    if work.empty:
        return pd.DataFrame(columns=columns)
    work["year"] = work["_date"].dt.year.astype(int)
    block = pd.to_numeric(work.get("block_minutes", 0), errors="coerce").fillna(0)
    role = work.get("role", pd.Series("", index=work.index)).fillna("").astype(str).str.upper()
    evidence = work.get("evidence", pd.Series("", index=work.index)).fillna("").astype(str).str.upper()
    work["_pic"] = block.where(role.eq("PIC"), 0)
    work["_dual"] = block.where(role.eq("DUAL"), 0)
    work["_safety"] = block.where(role.eq("SAFETY PILOT"), 0)
    work["_ull"] = block.where(evidence.eq("ULL"), 0)
    work["_easa"] = block.where(evidence.eq("EASA"), 0)
    out = work.groupby("year", as_index=False).agg(
        flights=("id", "count"),
        starts=("starts", "sum"),
        block_minutes=("block_minutes", "sum"),
        air_minutes=("air_minutes", "sum"),
        pic_minutes=("_pic", "sum"),
        dual_minutes=("_dual", "sum"),
        safety_minutes=("_safety", "sum"),
        ull_minutes=("_ull", "sum"),
        easa_minutes=("_easa", "sum"),
        cost=("cost", "sum"),
        gps_km=("gps_km", "sum"),
    )
    return out[columns].sort_values("year").reset_index(drop=True)


def category_year_summary(df: pd.DataFrame, category: str) -> pd.DataFrame:
    if df.empty or category not in df.columns:
        return pd.DataFrame(columns=["year", category, "block_hours"])
    work = df.copy()
    work["_date"] = _dates(work)
    work = work.dropna(subset=["_date"])
    if work.empty:
        return pd.DataFrame(columns=["year", category, "block_hours"])
    work["year"] = work["_date"].dt.year.astype(int)
    work[category] = work[category].fillna("").astype(str).str.upper().str.strip().replace("", "NEURČENO")
    out = work.groupby(["year", category], as_index=False).agg(block_minutes=("block_minutes", "sum"))
    out["block_hours"] = out["block_minutes"] / 60.0
    return out[["year", category, "block_hours"]].sort_values(["year", category]).reset_index(drop=True)


def _first_nonempty(values: pd.Series) -> str:
    cleaned = values.fillna("").astype(str).str.strip()
    cleaned = cleaned[cleaned.ne("")]
    return cleaned.iloc[-1] if not cleaned.empty else ""


def _joined_unique(values: pd.Series) -> str:
    vals = sorted({str(v).strip().upper() for v in values.fillna("") if str(v).strip()})
    return ", ".join(vals)


def aircraft_summary(df: pd.DataFrame) -> pd.DataFrame:
    columns = [
        "registration", "aircraft_type", "evidence", "flights", "starts", "block_minutes", "air_minutes",
        "block_hours", "air_hours", "avg_block_minutes", "cost", "cost_per_block_hour", "gps_km",
        "first_date", "last_date", "share_block_pct",
    ]
    if df.empty or "registration" not in df.columns:
        return pd.DataFrame(columns=columns)
    work = df.copy()
    work["registration"] = work["registration"].fillna("").astype(str).str.upper().str.strip()
    work = work[work["registration"].ne("")]
    if work.empty:
        return pd.DataFrame(columns=columns)
    work["_date"] = _dates(work)
    out = work.groupby("registration", as_index=False).agg(
        flights=("id", "count"),
        starts=("starts", "sum"),
        block_minutes=("block_minutes", "sum"),
        air_minutes=("air_minutes", "sum"),
        cost=("cost", "sum"),
        gps_km=("gps_km", "sum"),
        first_date=("_date", "min"),
        last_date=("_date", "max"),
    )
    if "aircraft_type" in work.columns:
        type_map = work.groupby("registration")["aircraft_type"].apply(_first_nonempty)
        out["aircraft_type"] = out["registration"].map(type_map).fillna("")
    else:
        out["aircraft_type"] = ""
    if "evidence" in work.columns:
        ev_map = work.groupby("registration")["evidence"].apply(_joined_unique)
        out["evidence"] = out["registration"].map(ev_map).fillna("")
    else:
        out["evidence"] = ""
    out["block_hours"] = out["block_minutes"] / 60.0
    out["air_hours"] = out["air_minutes"] / 60.0
    out["avg_block_minutes"] = out["block_minutes"] / out["flights"].replace(0, pd.NA)
    out["cost_per_block_hour"] = (out["cost"] / out["block_hours"].replace(0, pd.NA)).fillna(0)
    total_block = float(out["block_minutes"].sum())
    out["share_block_pct"] = (out["block_minutes"] / total_block * 100.0) if total_block > 0 else 0.0
    return out[columns].sort_values(["block_minutes", "flights"], ascending=[False, False]).reset_index(drop=True)


def airport_route_summaries(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    airport_cols = ["airport", "departures", "arrivals", "visits"]
    route_cols = ["route", "flights", "block_minutes", "avg_block_minutes", "gps_km", "last_date"]
    if df.empty:
        return pd.DataFrame(columns=airport_cols), pd.DataFrame(columns=route_cols)

    dep = df.get("departure", pd.Series("", index=df.index)).fillna("").astype(str).str.upper().str.strip()
    arr = df.get("arrival", pd.Series("", index=df.index)).fillna("").astype(str).str.upper().str.strip()

    dep_counts = dep[dep.ne("")].value_counts()
    arr_counts = arr[arr.ne("")].value_counts()
    airports = sorted(set(dep_counts.index).union(arr_counts.index))
    airport_df = pd.DataFrame({"airport": airports})
    if not airport_df.empty:
        airport_df["departures"] = airport_df["airport"].map(dep_counts).fillna(0).astype(int)
        airport_df["arrivals"] = airport_df["airport"].map(arr_counts).fillna(0).astype(int)
        airport_df["visits"] = airport_df["departures"] + airport_df["arrivals"]
        airport_df = airport_df.sort_values(["visits", "departures"], ascending=[False, False]).reset_index(drop=True)

    routes = df.copy()
    routes["_dep"] = dep
    routes["_arr"] = arr
    routes = routes[routes["_dep"].ne("") & routes["_arr"].ne("")].copy()
    if routes.empty:
        route_df = pd.DataFrame(columns=route_cols)
    else:
        routes["route"] = routes["_dep"] + "–" + routes["_arr"]
        routes["_date"] = _dates(routes)
        route_df = routes.groupby("route", as_index=False).agg(
            flights=("id", "count"),
            block_minutes=("block_minutes", "sum"),
            gps_km=("gps_km", "sum"),
            last_date=("_date", "max"),
        )
        route_df["avg_block_minutes"] = route_df["block_minutes"] / route_df["flights"].replace(0, pd.NA)
        route_df = route_df[route_cols].sort_values(["flights", "block_minutes"], ascending=[False, False]).reset_index(drop=True)
    return airport_df[airport_cols] if not airport_df.empty else pd.DataFrame(columns=airport_cols), route_df


def dashboard_insights(df: pd.DataFrame) -> dict[str, Any]:
    empty = {
        "unique_aircraft": 0,
        "unique_airports": 0,
        "unique_routes": 0,
        "gps_coverage_pct": 0.0,
        "top_aircraft": "—",
        "top_aircraft_minutes": 0,
        "top_airport": "—",
        "top_airport_visits": 0,
        "top_route": "—",
        "top_route_flights": 0,
        "busiest_month": "—",
        "busiest_month_minutes": 0,
        "longest_flight_label": "—",
        "longest_flight_minutes": 0,
    }
    if df.empty:
        return empty

    result = dict(empty)
    aircraft = aircraft_summary(df)
    airports, routes = airport_route_summaries(df)
    months = monthly_summary(df)

    result["unique_aircraft"] = int(len(aircraft))
    result["unique_airports"] = int(len(airports))
    result["unique_routes"] = int(len(routes))
    if "track_count" in df.columns:
        covered = pd.to_numeric(df["track_count"], errors="coerce").fillna(0).gt(0).sum()
        result["gps_coverage_pct"] = float(covered) / max(len(df), 1) * 100.0

    if not aircraft.empty:
        row = aircraft.iloc[0]
        result["top_aircraft"] = str(row["registration"])
        result["top_aircraft_minutes"] = int(round(float(row["block_minutes"] or 0)))
    if not airports.empty:
        row = airports.iloc[0]
        result["top_airport"] = str(row["airport"])
        result["top_airport_visits"] = int(row["visits"])
    if not routes.empty:
        row = routes.iloc[0]
        result["top_route"] = str(row["route"])
        result["top_route_flights"] = int(row["flights"])
    if not months.empty:
        row = months.sort_values(["block_minutes", "flights"], ascending=[False, False]).iloc[0]
        result["busiest_month"] = str(row["month_label"])
        result["busiest_month_minutes"] = int(round(float(row["block_minutes"] or 0)))

    block = pd.to_numeric(df.get("block_minutes", pd.Series(0, index=df.index)), errors="coerce").fillna(0)
    if not block.empty and block.max() > 0:
        idx = block.idxmax()
        row = df.loc[idx]
        route = f"{str(row.get('departure') or '').strip()}–{str(row.get('arrival') or '').strip()}".strip("–")
        reg = str(row.get("registration") or "").strip()
        label = " • ".join(v for v in (reg, route) if v)
        result["longest_flight_label"] = label or "—"
        result["longest_flight_minutes"] = int(round(float(block.loc[idx])))
    return result
