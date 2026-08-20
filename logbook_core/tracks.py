from __future__ import annotations

import math
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from typing import Any

import pandas as pd

from .config import LOCAL_TZ

def local_name(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag

def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    text = value.strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None

def normalize_track_points(points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return points in a safe chronological order when timestamps are available.

    Some KML exports store points newest-first. That breaks computed GPS speed
    because time deltas become negative. We keep non-timed tracks in original
    order, but for timed tracks we sort by timestamp and remove clearly invalid
    duplicate coordinates/timestamps only where needed for calculations.
    """
    if not points:
        return []
    indexed = []
    timed_count = 0
    for i, pt in enumerate(points):
        dt = parse_iso(pt.get("time"))
        if dt is not None:
            timed_count += 1
        indexed.append((i, dt, pt))
    if timed_count >= 2:
        indexed.sort(key=lambda item: (item[1] is None, item[1] or datetime.max.replace(tzinfo=timezone.utc), item[0]))
        return [dict(pt) for _, _, pt in indexed]
    return [dict(pt) for pt in points]

def _coord_tokens_to_points(coord_text: str) -> list[dict[str, Any]]:
    parsed: list[dict[str, Any]] = []
    for token in coord_text.replace("\n", " ").replace("\t", " ").split():
        parts = token.split(",")
        if len(parts) < 2:
            continue
        try:
            lon = float(parts[0])
            lat = float(parts[1])
            alt = float(parts[2]) if len(parts) >= 3 and parts[2] else None
        except ValueError:
            continue
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            parsed.append({"lat": lat, "lon": lon, "alt": alt, "time": None})
    return parsed

def _placemark_text(placemark: ET.Element, element_name: str) -> str | None:
    for elem in placemark.iter():
        if local_name(elem.tag) == element_name and (elem.text or "").strip():
            return (elem.text or "").strip()
    return None

def _parse_fr24_description_times(text: str | None) -> list[str]:
    """Return UTC ISO strings found in a Flightradar24 Placemark description/name."""
    if not text:
        return []
    found = re.findall(r"(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})\s*UTC", text)
    return [f"{date}T{clock}+00:00" for date, clock in found]

def _append_point_unique(points: list[dict[str, Any]], point: dict[str, Any]) -> None:
    if points:
        prev = points[-1]
        same_pos = abs(float(prev.get("lat", 999)) - float(point.get("lat", -999))) < 1e-7 and abs(float(prev.get("lon", 999)) - float(point.get("lon", -999))) < 1e-7
        same_time = (prev.get("time") or None) == (point.get("time") or None)
        if same_pos and same_time:
            return
    points.append(point)

def parse_kml_bytes(data: bytes) -> list[dict[str, Any]]:
    root = ET.fromstring(data)
    points: list[dict[str, Any]] = []

    # Preferred format: gx:Track / Track with <when> + <gx:coord>.
    for track in root.iter():
        if local_name(track.tag) != "Track":
            continue
        whens: list[str | None] = []
        coords: list[str] = []
        for child in list(track):
            lname = local_name(child.tag)
            if lname == "when":
                whens.append((child.text or "").strip() or None)
            elif lname == "coord":
                coords.append((child.text or "").strip())
        for idx, coord in enumerate(coords):
            parts = coord.replace(",", " ").split()
            if len(parts) < 2:
                continue
            try:
                lon = float(parts[0]); lat = float(parts[1]); alt = float(parts[2]) if len(parts) >= 3 else None
            except ValueError:
                continue
            if -90 <= lat <= 90 and -180 <= lon <= 180:
                points.append({"lat": lat, "lon": lon, "alt": alt, "time": whens[idx] if idx < len(whens) else None})
    if points:
        return normalize_track_points(points)

    # Flightradar24 usually exports two parallel datasets in one KML:
    # 1) timestamped Point Placemarks,
    # 2) visual LineString segments named P-1, P-2, ...
    # Older parser mixed both together, which produced an artificial line from
    # the last real point back to the first segment. Therefore Point Placemarks
    # are parsed first and, when they contain usable times, the LineStrings are
    # intentionally ignored.
    point_points: list[dict[str, Any]] = []
    line_segment_points: list[dict[str, Any]] = []

    for placemark in root.iter():
        if local_name(placemark.tag) != "Placemark":
            continue

        pm_name = _placemark_text(placemark, "name") or ""
        pm_desc = _placemark_text(placemark, "description") or ""
        when = _placemark_text(placemark, "when") or _placemark_text(placemark, "begin")

        # Point-only placemarks: FR24 exports one of these for every recorded fix.
        for point_elem in placemark.iter():
            if local_name(point_elem.tag) != "Point":
                continue
            coord_text = None
            for elem in point_elem.iter():
                if local_name(elem.tag) == "coordinates" and (elem.text or "").strip():
                    coord_text = (elem.text or "").strip()
                    break
            if not coord_text:
                continue
            parsed = _coord_tokens_to_points(coord_text)
            if not parsed:
                continue
            pt = parsed[0]
            # Some FR24 files put the timestamp in the Placemark name instead of <when>.
            time_from_name = _parse_fr24_description_times(pm_name)
            pt["time"] = when or (time_from_name[0] if time_from_name else None)
            _append_point_unique(point_points, pt)

        # LineString segments: keep them only as a fallback when no timestamped
        # Point stream exists. Parse the two timestamps from the description.
        for line_elem in placemark.iter():
            if local_name(line_elem.tag) != "LineString":
                continue
            coord_text = None
            for elem in line_elem.iter():
                if local_name(elem.tag) == "coordinates" and (elem.text or "").strip():
                    coord_text = (elem.text or "").strip()
                    break
            if not coord_text:
                continue
            parsed = _coord_tokens_to_points(coord_text)
            if not parsed:
                continue
            times = _parse_fr24_description_times(pm_desc)
            for idx, pt in enumerate(parsed):
                if idx < len(times):
                    pt["time"] = times[idx]
                _append_point_unique(line_segment_points, pt)

    timed_points = [p for p in point_points if p.get("time")]
    if len(timed_points) >= 2:
        return normalize_track_points(point_points)
    if len(line_segment_points) >= 2:
        return normalize_track_points(line_segment_points)
    if point_points:
        return normalize_track_points(point_points)

    # Fallback: plain coordinates. This is intentionally only reached when no
    # usable Point/LineString track was parsed above.
    for elem in root.iter():
        if local_name(elem.tag) != "coordinates":
            continue
        text = (elem.text or "").strip()
        for pt in _coord_tokens_to_points(text):
            _append_point_unique(points, pt)
    return normalize_track_points(points)

def haversine_km(a: dict[str, Any], b: dict[str, Any]) -> float:
    r = 6371.0088
    lat1 = math.radians(float(a["lat"])); lat2 = math.radians(float(b["lat"]))
    dlat = lat2 - lat1; dlon = math.radians(float(b["lon"]) - float(a["lon"]))
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))

def track_distance_km(points: list[dict[str, Any]]) -> float:
    if len(points) < 2:
        return 0.0
    return sum(haversine_km(a, b) for a, b in zip(points[:-1], points[1:]))

def track_stats(points: list[dict[str, Any]]) -> dict[str, Any]:
    times = [p.get("time") for p in points if p.get("time")]
    alts = [float(p["alt"]) for p in points if p.get("alt") is not None and float(p.get("alt") or 0) != 0]
    return {
        "point_count": len(points),
        "distance_km": track_distance_km(points),
        "start_utc": times[0] if times else None,
        "end_utc": times[-1] if times else None,
        "min_alt_m": min(alts) if alts else None,
        "max_alt_m": max(alts) if alts else None,
    }

def profile_from_points(points: list[dict[str, Any]], tz: ZoneInfo = LOCAL_TZ) -> pd.DataFrame:
    points = normalize_track_points(points)
    rows = []
    cum = 0.0
    prev = None
    prev_dt = None
    for i, p in enumerate(points):
        dt_utc = parse_iso(p.get("time"))
        dt_local = dt_utc.astimezone(tz) if dt_utc else None
        seg_km = haversine_km(prev, p) if prev is not None else 0.0
        cum += seg_km

        # Prefer speed already present in a future/imported JSON, otherwise compute
        # groundspeed from distance and timestamps. This keeps old and new tracks
        # compatible and fixes KML files exported in reverse chronological order.
        speed = None
        for key in ("speed_kmh", "gps_speed_kmh", "speed"):
            raw = p.get(key)
            if raw is not None:
                try:
                    speed = float(raw)
                    break
                except (TypeError, ValueError):
                    pass
        if speed is None and prev is not None and dt_utc is not None and prev_dt is not None:
            seconds = (dt_utc - prev_dt).total_seconds()
            if seconds > 0:
                speed = seg_km / (seconds / 3600)
                # Reject impossible spikes from malformed KML/timestamp jumps.
                if speed > 900:
                    speed = None

        alt_m = None if p.get("alt") is None else float(p.get("alt"))
        rows.append({
            "idx": i,
            "time_utc": dt_utc,
            "time_local": dt_local,
            "lat": float(p["lat"]),
            "lon": float(p["lon"]),
            "alt_m": alt_m,
            "alt_ft": alt_m * 3.28084 if alt_m is not None else None,
            "seg_km": seg_km,
            "distance_km": cum,
            "speed_kmh": speed,
        })
        prev = p
        prev_dt = dt_utc
    df = pd.DataFrame(rows)
    if not df.empty:
        speed_series = pd.to_numeric(df["speed_kmh"], errors="coerce")
        if speed_series.notna().any():
            df["speed_smooth"] = speed_series.interpolate(limit_direction="both").rolling(5, min_periods=1, center=True).median()
        else:
            df["speed_smooth"] = pd.NA
    return df

def _longest_true_segment(mask: pd.Series, min_len: int = 1) -> tuple[int, int] | None:
    best: tuple[int, int] | None = None
    best_len = 0
    start: int | None = None
    values = [bool(v) for v in mask.fillna(False).tolist()]
    for i, val in enumerate(values + [False]):
        if val and start is None:
            start = i
        elif not val and start is not None:
            end = i - 1
            length = end - start + 1
            if length >= min_len and length > best_len:
                best = (start, end)
                best_len = length
            start = None
    return best

def _sustained_ground_after(speed: pd.Series, start_idx: int, threshold_kmh: float = 35.0, min_points: int = 4) -> int | None:
    if speed.empty:
        return None
    values = speed.fillna(0).tolist()
    run_start: int | None = None
    run_len = 0
    for idx in range(max(0, start_idx), len(values)):
        if float(values[idx] or 0) <= threshold_kmh:
            if run_start is None:
                run_start = idx
                run_len = 1
            else:
                run_len += 1
            if run_len >= min_points:
                return int(run_start)
        else:
            run_start = None
            run_len = 0
    return None

def _airborne_segment_from_speed_and_altitude(prof: pd.DataFrame) -> tuple[int, int] | None:
    if prof.empty:
        return None
    speed = pd.to_numeric(prof.get("speed_smooth", pd.Series(dtype=float)), errors="coerce").fillna(0)

    fast_air = speed.gt(65)
    segment = _longest_true_segment(fast_air, min_len=3)
    if segment is not None:
        return segment

    medium_air = speed.gt(50)
    segment = _longest_true_segment(medium_air, min_len=3)
    if segment is not None:
        return segment

    if "alt_m" in prof and prof["alt_m"].notna().any():
        alt = pd.to_numeric(prof["alt_m"], errors="coerce")
        if alt.notna().sum() >= 3:
            alt_range = float(alt.quantile(0.95) - alt.quantile(0.05))
            if alt_range >= 45:
                ground_band = float(alt.quantile(0.10))
                airborne_alt = alt.gt(ground_band + 30)
                segment = _longest_true_segment(airborne_alt, min_len=3)
                if segment is not None:
                    return segment
    return None

def detect_takeoff_landing(points: list[dict[str, Any]]) -> dict[str, Any]:
    prof = profile_from_points(points)
    n = len(prof)
    if n == 0:
        return {}

    speed = pd.to_numeric(prof.get("speed_smooth", pd.Series(dtype=float)), errors="coerce").fillna(0)
    moving = speed.gt(12)
    first_move = int(moving.idxmax()) if moving.any() else 0

    segment = _airborne_segment_from_speed_and_altitude(prof)
    if segment is None:
        segment = _longest_true_segment(moving, min_len=1)

    if segment is None:
        takeoff, landing = 0, n - 1
    else:
        takeoff, landing = segment

    ground_start = _sustained_ground_after(speed, landing + 1, threshold_kmh=35.0, min_points=4)
    if ground_start is not None and ground_start > takeoff:
        landing = max(takeoff, ground_start - 1)

    if landing < takeoff:
        takeoff, landing = 0, n - 1

    return {
        "off_idx": int(first_move),
        "takeoff_idx": int(takeoff),
        "landing_idx": int(landing),
        "on_idx": int(min(n - 1, landing)),
    }

def point_local_dt(points: list[dict[str, Any]], idx: int) -> datetime | None:
    if not points:
        return None
    idx = max(0, min(idx, len(points) - 1))
    dt = parse_iso(points[idx].get("time"))
    return dt.astimezone(LOCAL_TZ) if dt else None

def dt_hhmm(dt: datetime | None) -> str | None:
    return dt.strftime("%H:%M") if dt else None

def point_local_hhmm(points: list[dict[str, Any]], idx: int) -> str | None:
    return dt_hhmm(point_local_dt(points, idx))

def inferred_clock_times(points: list[dict[str, Any]], idx: dict[str, Any], block_padding_minutes: int = 5) -> dict[str, str | None]:
    takeoff_dt = point_local_dt(points, idx.get("takeoff_idx", 0))
    landing_dt = point_local_dt(points, idx.get("landing_idx", len(points) - 1))
    off_dt = takeoff_dt - timedelta(minutes=block_padding_minutes) if takeoff_dt else None
    on_dt = landing_dt + timedelta(minutes=block_padding_minutes) if landing_dt else None
    return {
        "off_block": dt_hhmm(off_dt),
        "takeoff": dt_hhmm(takeoff_dt),
        "landing": dt_hhmm(landing_dt),
        "on_block": dt_hhmm(on_dt),
    }

def point_local_date(points: list[dict[str, Any]]) -> date:
    for p in points:
        dt = parse_iso(p.get("time"))
        if dt:
            return dt.astimezone(LOCAL_TZ).date()
    return date.today()

def extract_registration_from_filename(name: str) -> str:
    text = name.upper().replace("_", "-").replace(" ", "-")
    m = re.search(r"OK-?[A-Z]{3}\d{2}", text)
    if m:
        val = m.group(0).replace("OK", "OK-").replace("OK--", "OK-")
        return val if val.startswith("OK-") else "OK-" + val[2:]
    m = re.search(r"OK-?[A-Z]{3}(?!\d)", text)
    if m:
        val = m.group(0).replace("OK", "OK-").replace("OK--", "OK-")
        return val if val.startswith("OK-") else "OK-" + val[2:]
    return ""

def detect_kml_source(raw: bytes, file_name: str = "") -> str:
    name = (file_name or "").lower()
    try:
        text = raw[:500000].decode("utf-8", errors="ignore").lower()
    except Exception:
        text = ""
    if "flightradar24" in text or "fr24" in name or "flight radar" in text:
        return "Flightradar24"
    if "adsbexchange" in text or "ads-b exchange" in text or "adsb" in name:
        return "ADSBexchange"
    if "<gx:track" in text or "gx:coord" in text:
        return "GPS track"
    if "<linestring" in text:
        return "KML LineString"
    return "KML"

