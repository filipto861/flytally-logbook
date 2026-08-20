"""GPS / map rendering primitives for Logbook v0.54.

The engine deliberately separates *stored track fidelity* from *browser render
fidelity*.  Full GPS points remain untouched in SQLite.  Map views receive a
bounded, geometry-preserving representation so rendering cost stays predictable
when the logbook grows.
"""
from __future__ import annotations

from dataclasses import dataclass
import heapq
import json
import math
from typing import Any, Iterable, Sequence


DEFAULT_CENTER = (49.8, 15.5)


@dataclass(frozen=True)
class GpsMapRenderPlan:
    """Render budget for one GPS overview request."""

    mode: str
    total_tracks: int
    selected_tracks: int
    max_tracks: int | None
    points_per_track: int
    candidate_points_per_track: int
    total_point_budget: int

    @property
    def estimated_payload_points(self) -> int:
        return self.selected_tracks * self.points_per_track


@dataclass(frozen=True)
class MapViewport:
    center: tuple[float, float]
    zoom: int
    bounds: tuple[tuple[float, float], tuple[float, float]] | None = None


# Browser point budgets are intentionally conservative.  The important property
# is that the "Vše" mode may include every track without sending 180 points for
# every single historic flight indefinitely.
_GPS_PRESETS: dict[str, dict[str, int | None]] = {
    "Rychlá": {"max_tracks": 40, "per_track_cap": 110, "total_budget": 4400},
    "Střední": {"max_tracks": 120, "per_track_cap": 160, "total_budget": 14400},
    "Vše": {"max_tracks": None, "per_track_cap": 180, "total_budget": 24000},
}


def normalize_gps_map_mode(mode: Any) -> str:
    text = str(mode or "Rychlá").strip()
    return text if text in _GPS_PRESETS else "Rychlá"


def build_gps_render_plan(mode: Any, total_tracks: int) -> GpsMapRenderPlan:
    """Return an adaptive map budget for the requested number of tracks.

    Track count and point count are separate limits.  This prevents the historic
    "Vše" mode from growing an unbounded Leaflet payload as the database grows.
    """
    normalized = normalize_gps_map_mode(mode)
    preset = _GPS_PRESETS[normalized]
    total = max(0, int(total_tracks or 0))
    max_tracks = preset["max_tracks"]
    selected = total if max_tracks is None else min(total, int(max_tracks))
    cap = int(preset["per_track_cap"] or 120)
    total_budget = int(preset["total_budget"] or 12000)

    if selected <= 0:
        points_per_track = cap
    else:
        # Eight points still preserve a useful coarse path and keeps "Vše"
        # bounded even for exceptionally large logbooks.
        points_per_track = max(8, min(cap, total_budget // selected if selected else cap))

    # SQL first reads a modest candidate stream.  Geometry simplification then
    # chooses the most meaningful turns instead of blindly keeping every Nth fix.
    candidate_points = min(600, max(points_per_track + 16, points_per_track * 3))
    return GpsMapRenderPlan(
        mode=normalized,
        total_tracks=total,
        selected_tracks=selected,
        max_tracks=int(max_tracks) if max_tracks is not None else None,
        points_per_track=points_per_track,
        candidate_points_per_track=candidate_points,
        total_point_budget=total_budget,
    )


def _valid_lat_lon(point: Any) -> tuple[float, float] | None:
    if not isinstance(point, dict):
        return None
    try:
        lat = float(point.get("lat"))
        lon = float(point.get("lon"))
    except (TypeError, ValueError):
        return None
    if not (math.isfinite(lat) and math.isfinite(lon)):
        return None
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        return None
    return lat, lon


def sanitize_track_points(points: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop invalid coordinates while preserving point dictionaries and order."""
    out: list[dict[str, Any]] = []
    for point in points:
        ll = _valid_lat_lon(point)
        if ll is None:
            continue
        item = dict(point)
        item["lat"], item["lon"] = ll
        out.append(item)
    return out


def _project_xy(coords: Sequence[tuple[float, float]]) -> list[tuple[float, float]]:
    """Fast local equirectangular projection, adequate for polyline simplification."""
    if not coords:
        return []
    mean_lat = math.radians(sum(lat for lat, _ in coords) / len(coords))
    cos_lat = max(0.01, abs(math.cos(mean_lat)))
    meters_per_degree = 111_320.0
    return [
        (lon * meters_per_degree * cos_lat, lat * meters_per_degree)
        for lat, lon in coords
    ]


def _segment_farthest_index(
    xy: Sequence[tuple[float, float]], start: int, end: int
) -> tuple[float, int | None]:
    """Return squared perpendicular distance and index farthest from a segment."""
    if end - start <= 1:
        return 0.0, None
    ax, ay = xy[start]
    bx, by = xy[end]
    vx = bx - ax
    vy = by - ay
    length_sq = vx * vx + vy * vy
    best_dist = -1.0
    best_idx: int | None = None
    for idx in range(start + 1, end):
        px, py = xy[idx]
        if length_sq <= 1e-12:
            dx = px - ax
            dy = py - ay
            dist_sq = dx * dx + dy * dy
        else:
            t = ((px - ax) * vx + (py - ay) * vy) / length_sq
            if t < 0.0:
                qx, qy = ax, ay
            elif t > 1.0:
                qx, qy = bx, by
            else:
                qx, qy = ax + t * vx, ay + t * vy
            dx = px - qx
            dy = py - qy
            dist_sq = dx * dx + dy * dy
        if dist_sq > best_dist:
            best_dist = dist_sq
            best_idx = idx
    return max(0.0, best_dist), best_idx


def simplify_track_points(points: list[dict[str, Any]], max_points: int = 180) -> list[dict[str, Any]]:
    """Geometry-preserving exact-budget simplifier.

    Unlike stride sampling, this keeps the strongest turns first.  It always
    preserves the first and last valid point and never returns more than
    ``max_points`` entries.  Stored points are never mutated.
    """
    clean = sanitize_track_points(points)
    budget = max(2, int(max_points or 2))
    n = len(clean)
    if n <= budget:
        return clean
    if n <= 2:
        return clean

    coords = [(float(p["lat"]), float(p["lon"])) for p in clean]
    xy = _project_xy(coords)
    selected: set[int] = {0, n - 1}
    heap: list[tuple[float, int, int, int]] = []

    def push_segment(start: int, end: int) -> None:
        dist_sq, idx = _segment_farthest_index(xy, start, end)
        if idx is not None:
            # Negative distance creates a max-heap; deterministic tie-breakers
            # keep repeated renders stable for cache keys.
            heapq.heappush(heap, (-dist_sq, start, end, idx))

    push_segment(0, n - 1)
    while heap and len(selected) < budget:
        _, start, end, idx = heapq.heappop(heap)
        if idx in selected:
            continue
        selected.add(idx)
        push_segment(start, idx)
        push_segment(idx, end)

    return [clean[idx] for idx in sorted(selected)]


def compact_track_points(points: list[dict[str, Any]], max_points: int) -> list[dict[str, Any]]:
    """Return browser-ready points with stable numeric precision."""
    compact: list[dict[str, Any]] = []
    for point in simplify_track_points(points, max_points=max_points):
        ll = _valid_lat_lon(point)
        if ll is None:
            continue
        lat, lon = ll
        item: dict[str, Any] = {"lat": round(lat, 6), "lon": round(lon, 6)}
        alt = point.get("alt")
        if alt is not None:
            try:
                alt_value = float(alt)
                if math.isfinite(alt_value):
                    item["alt"] = round(alt_value, 1)
            except (TypeError, ValueError):
                pass
        time_value = point.get("time")
        if time_value is not None and str(time_value).strip():
            item["time"] = str(time_value)
        compact.append(item)
    return compact


def encode_compact_track_points(points: list[dict[str, Any]], max_points: int) -> str:
    return json.dumps(
        compact_track_points(points, max_points=max_points),
        ensure_ascii=False,
        separators=(",", ":"),
    )


def _zoom_for_spread(spread: float, profile: str) -> int:
    if profile == "airport":
        return 11 if spread < .15 else 9 if spread < .6 else 8 if spread < 1.8 else 7 if spread < 5 else 6 if spread < 10 else 5
    if profile == "playback":
        return 12 if spread < .08 else 10 if spread < .25 else 8 if spread < 1 else 7 if spread < 3 else 6 if spread < 8 else 5
    return 10 if spread < .25 else 8 if spread < 1 else 7 if spread < 4 else 6 if spread < 10 else 5


def viewport_from_coords(
    coords: Iterable[tuple[float, float]],
    *,
    profile: str = "track",
    default_center: tuple[float, float] = DEFAULT_CENTER,
    default_zoom: int = 7,
) -> MapViewport:
    """Compute one stable viewport implementation for all map surfaces."""
    valid: list[tuple[float, float]] = []
    for value in coords:
        try:
            lat = float(value[0])
            lon = float(value[1])
        except (TypeError, ValueError, IndexError):
            continue
        if math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180:
            valid.append((lat, lon))
    if not valid:
        return MapViewport(center=default_center, zoom=int(default_zoom), bounds=None)

    min_lat = min(lat for lat, _ in valid)
    max_lat = max(lat for lat, _ in valid)
    min_lon = min(lon for _, lon in valid)
    max_lon = max(lon for _, lon in valid)
    spread = max(max_lat - min_lat, max_lon - min_lon)
    return MapViewport(
        center=((min_lat + max_lat) / 2.0, (min_lon + max_lon) / 2.0),
        zoom=_zoom_for_spread(spread, profile),
        bounds=((min_lat, min_lon), (max_lat, max_lon)),
    )
