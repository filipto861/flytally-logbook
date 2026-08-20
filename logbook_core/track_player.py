from __future__ import annotations

import math
from typing import Any

import pandas as pd

from .performance import downsample_track_points
from .tracks import (
    detect_takeoff_landing,
    haversine_km,
    normalize_track_points,
    profile_from_points,
)


def _safe_float(value: Any, digits: int | None = None) -> float | None:
    try:
        if value is None or pd.isna(value):
            return None
        number = float(value)
        if not math.isfinite(number):
            return None
        return round(number, digits) if digits is not None else number
    except Exception:
        return None


def _bearing_deg(a: dict[str, Any], b: dict[str, Any]) -> float:
    try:
        lat1 = math.radians(float(a["lat"]))
        lat2 = math.radians(float(b["lat"]))
        dlon = math.radians(float(b["lon"]) - float(a["lon"]))
        y = math.sin(dlon) * math.cos(lat2)
        x = (
            math.cos(lat1) * math.sin(lat2)
            - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
        )
        degree = (math.degrees(math.atan2(y, x)) + 360.0) % 360.0
        return degree if math.isfinite(degree) else 0.0
    except Exception:
        return 0.0


def _bearing_at(points: list[dict[str, Any]], idx: int) -> float:
    if not points:
        return 0.0
    idx = max(0, min(int(idx), len(points) - 1))
    current = points[idx]

    # Ignore tiny jitter around one GPS fix. 15 m is enough to derive a stable
    # aircraft direction while still reacting quickly during turns.
    for other_idx in range(idx + 1, len(points)):
        try:
            if haversine_km(current, points[other_idx]) > 0.015:
                return _bearing_deg(current, points[other_idx])
        except Exception:
            pass

    for other_idx in range(idx - 1, -1, -1):
        try:
            if haversine_km(points[other_idx], current) > 0.015:
                return _bearing_deg(points[other_idx], current)
        except Exception:
            pass
    return 0.0


def _valid_coordinates(points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    clean: list[dict[str, Any]] = []
    for point in normalize_track_points(points):
        try:
            lat = float(point.get("lat"))
            lon = float(point.get("lon"))
        except (TypeError, ValueError):
            continue
        if not (math.isfinite(lat) and math.isfinite(lon)):
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            continue
        clean.append(dict(point))
    return clean


def _default_index(points: list[dict[str, Any]]) -> int:
    if not points:
        return 0
    try:
        detected = detect_takeoff_landing(points)
        idx = int(detected.get("takeoff_idx", 0) or 0)
    except Exception:
        idx = 0
    return max(0, min(idx, len(points) - 1))


def build_track_player_payload(
    points: list[dict[str, Any]],
    timezone: Any,
    *,
    max_points: int = 2800,
) -> tuple[list[dict[str, Any]], int, int]:
    """Prepare a compact browser-player payload.

    The payload keeps real GPS timeline information when timestamps exist.
    JavaScript can then interpolate continuously between fixes without asking
    Streamlit to rerun while the slider is moving.
    """
    source_points = _valid_coordinates(points)
    original_count = len(source_points)
    if original_count < 2:
        return [], 0, original_count

    safe_max = max(2, int(max_points))
    if original_count > safe_max:
        playback_points = downsample_track_points(source_points, max_points=safe_max)
    else:
        playback_points = source_points

    playback_points = _valid_coordinates(playback_points)

    # The shared downsampler intentionally preserves endpoints and can exceed
    # its nominal target by one point. The browser player uses a hard cap, so
    # enforce it here while preserving the first and last sample.
    if len(playback_points) > safe_max:
        if safe_max == 2:
            playback_points = [playback_points[0], playback_points[-1]]
        else:
            span = len(playback_points) - 1
            indices = [
                round(index * span / (safe_max - 1))
                for index in range(safe_max)
            ]
            playback_points = [playback_points[index] for index in indices]
    profile = profile_from_points(playback_points, timezone)
    if profile.empty:
        return [], 0, original_count

    first_utc = next(
        (value for value in profile["time_utc"].tolist() if pd.notna(value)),
        None,
    )
    first_local = next(
        (value for value in profile["time_local"].tolist() if pd.notna(value)),
        None,
    )

    data: list[dict[str, Any]] = []
    for idx, row in profile.reset_index(drop=True).iterrows():
        local_dt = row.get("time_local")
        utc_dt = row.get("time_utc")

        elapsed_s = None
        if first_utc is not None and pd.notna(utc_dt):
            try:
                elapsed_s = max(0.0, float((utc_dt - first_utc).total_seconds()))
            except Exception:
                elapsed_s = None

        clock_s = None
        time_text = "—"
        if pd.notna(local_dt) and hasattr(local_dt, "strftime"):
            time_text = local_dt.strftime("%H:%M:%S")
            try:
                day_offset = (
                    local_dt.date() - first_local.date()
                ).days if first_local is not None else 0
                clock_s = (
                    day_offset * 86400
                    + int(local_dt.hour) * 3600
                    + int(local_dt.minute) * 60
                    + int(local_dt.second)
                    + int(getattr(local_dt, "microsecond", 0)) / 1_000_000
                )
            except Exception:
                clock_s = None

        speed_kmh = _safe_float(row.get("speed_smooth"), 1)
        speed_kt = _safe_float(
            speed_kmh * 0.539956803 if speed_kmh is not None else None,
            1,
        )

        data.append(
            {
                "lat": _safe_float(row.get("lat"), 7),
                "lon": _safe_float(row.get("lon"), 7),
                "alt_ft": _safe_float(row.get("alt_ft"), 0),
                "speed_kmh": speed_kmh,
                "speed_kt": speed_kt,
                "distance_km": _safe_float(row.get("distance_km"), 2),
                "time": time_text,
                "elapsed_s": _safe_float(elapsed_s, 2),
                "clock_s": _safe_float(clock_s, 2),
                "bearing": round(_bearing_at(playback_points, int(idx)), 1),
            }
        )

    data = [
        point
        for point in data
        if point.get("lat") is not None and point.get("lon") is not None
    ]
    if len(data) < 2:
        return data, 0, original_count

    default_idx = max(0, min(_default_index(playback_points), len(data) - 1))
    return data, default_idx, original_count
