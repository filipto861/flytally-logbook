from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any

import pandas as pd

from .config import LOCAL_TZ
from .tracks import haversine_km, normalize_track_points, parse_iso, profile_from_points, track_distance_km


@dataclass(frozen=True)
class TrackEvent:
    kind: str
    index: int
    label: str
    confidence: str = "medium"
    duration_seconds: float | None = None
    detail: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _true_segments(mask: pd.Series, min_points: int = 2) -> list[tuple[int, int]]:
    values = [bool(v) for v in mask.fillna(False).tolist()]
    out: list[tuple[int, int]] = []
    start: int | None = None
    for idx, value in enumerate(values + [False]):
        if value and start is None:
            start = idx
        elif not value and start is not None:
            end = idx - 1
            if end - start + 1 >= min_points:
                out.append((start, end))
            start = None
    return out


def _seconds_between(prof: pd.DataFrame, start_idx: int, end_idx: int) -> float | None:
    if prof.empty or start_idx < 0 or end_idx >= len(prof) or end_idx < start_idx:
        return None
    a = prof.iloc[start_idx].get("time_utc")
    b = prof.iloc[end_idx].get("time_utc")
    if pd.isna(a) or pd.isna(b) or a is None or b is None:
        return None
    try:
        return max(0.0, float((b - a).total_seconds()))
    except Exception:
        return None


def _segment_distance(prof: pd.DataFrame, start_idx: int, end_idx: int) -> float:
    if prof.empty or end_idx <= start_idx:
        return 0.0
    try:
        start = float(prof.iloc[start_idx].get("distance_km") or 0.0)
        end = float(prof.iloc[end_idx].get("distance_km") or 0.0)
        return max(0.0, end - start)
    except Exception:
        return 0.0


def _air_segments(prof: pd.DataFrame) -> list[tuple[int, int]]:
    """Return conservative airborne/moving-flight segments.

    The primary signal is GPS groundspeed.  Altitude is used only when groundspeed
    is unavailable.  Each seed above 58 km/h is expanded through the lower 34 km/h
    support band.  This deliberately keeps a touch-and-go together when the aircraft
    remains rolling, while a full stop/turnaround creates a real gap.
    """
    if prof.empty:
        return []
    speed = pd.to_numeric(prof.get("speed_smooth", pd.Series(index=prof.index, dtype=float)), errors="coerce")
    if speed.notna().sum() >= max(3, len(prof) // 5):
        seed = speed.ge(58.0).fillna(False)
        support = speed.ge(34.0).fillna(False)
        seeds = _true_segments(seed, min_points=2)
        expanded: list[tuple[int, int]] = []
        for start, end in seeds:
            left, right = start, end
            while left > 0 and bool(support.iloc[left - 1]):
                left -= 1
            while right + 1 < len(prof) and bool(support.iloc[right + 1]):
                right += 1
            if expanded and left <= expanded[-1][1] + 1:
                expanded[-1] = (expanded[-1][0], max(expanded[-1][1], right))
            else:
                expanded.append((left, right))
        return [seg for seg in expanded if _segment_distance(prof, *seg) >= 0.35]

    alt = pd.to_numeric(prof.get("alt_m", pd.Series(index=prof.index, dtype=float)), errors="coerce")
    if alt.notna().sum() < 4:
        return []
    q10 = float(alt.quantile(0.10))
    airborne = alt.ge(q10 + 28.0).fillna(False)
    return [seg for seg in _true_segments(airborne, min_points=3) if _segment_distance(prof, *seg) >= 0.35]


def _gap_low_speed_seconds(prof: pd.DataFrame, start: int, end: int, threshold: float = 10.0) -> float:
    if start > end or prof.empty:
        return 0.0
    speed = pd.to_numeric(prof.get("speed_smooth", pd.Series(index=prof.index, dtype=float)), errors="coerce")
    total = 0.0
    for idx in range(max(0, start), min(end, len(prof) - 1) + 1):
        if idx + 1 >= len(prof):
            break
        value = speed.iloc[idx]
        if pd.isna(value) or float(value) > threshold:
            continue
        a = prof.iloc[idx].get("time_utc")
        b = prof.iloc[idx + 1].get("time_utc")
        if a is not None and b is not None and not pd.isna(a) and not pd.isna(b):
            try:
                dt = float((b - a).total_seconds())
                if 0 < dt <= 120:
                    total += dt
                    continue
            except Exception:
                pass
        total += 1.0
    return total


def _choose_split_idx(prof: pd.DataFrame, gap_start: int, gap_end: int) -> int:
    gap_start = max(1, int(gap_start))
    gap_end = min(len(prof) - 2, int(gap_end))
    if gap_end < gap_start:
        return max(1, min(len(prof) - 2, gap_start))
    speed = pd.to_numeric(prof.get("speed_smooth", pd.Series(index=prof.index, dtype=float)), errors="coerce")
    middle = (gap_start + gap_end) / 2.0
    candidates: list[tuple[float, float, int]] = []
    for idx in range(gap_start, gap_end + 1):
        spd = speed.iloc[idx]
        spd_val = float(spd) if pd.notna(spd) else 9999.0
        candidates.append((spd_val, abs(idx - middle), idx))
    candidates.sort()
    return int(candidates[0][2] if candidates else round(middle))


def _local_touch_and_go_events(prof: pd.DataFrame, air_segments: list[tuple[int, int]]) -> list[TrackEvent]:
    """Find conservative touch-and-go altitude minima inside a continuous flight.

    This catches circuits where speed never falls enough to split the speed-based
    airborne segment.  A candidate must be a local altitude minimum, have meaningful
    altitude both before and after, and still carry flying/rolling groundspeed.
    """
    if prof.empty or not air_segments:
        return []
    alt = pd.to_numeric(prof.get("alt_m", pd.Series(index=prof.index, dtype=float)), errors="coerce")
    speed = pd.to_numeric(prof.get("speed_smooth", pd.Series(index=prof.index, dtype=float)), errors="coerce")
    if alt.notna().sum() < 8 or speed.notna().sum() < 8:
        return []

    events: list[TrackEvent] = []
    for seg_start, seg_end in air_segments:
        if seg_end - seg_start < 10:
            continue
        for idx in range(seg_start + 4, seg_end - 4):
            a = alt.iloc[idx]
            s = speed.iloc[idx]
            if pd.isna(a) or pd.isna(s) or not (28.0 <= float(s) <= 135.0):
                continue
            left = alt.iloc[max(seg_start, idx - 10):idx]
            right = alt.iloc[idx + 1:min(seg_end + 1, idx + 11)]
            if left.notna().sum() < 3 or right.notna().sum() < 3:
                continue
            local_window = alt.iloc[max(seg_start, idx - 2):min(seg_end + 1, idx + 3)]
            if pd.isna(local_window.min()) or float(a) > float(local_window.min()) + 2.0:
                continue
            left_peak = float(left.max())
            right_peak = float(right.max())
            drop_left = left_peak - float(a)
            climb_right = right_peak - float(a)
            if drop_left < 32.0 or climb_right < 32.0:
                continue
            # Keep candidates separated; one runway contact can span several fixes.
            if events and idx - events[-1].index < 8:
                continue
            events.append(
                TrackEvent(
                    kind="touch_and_go",
                    index=idx,
                    label="Pravděpodobný touch-and-go",
                    confidence="medium",
                    detail=f"Lokální minimum výšky, rychlost přibližně {float(s):.0f} km/h.",
                )
            )
    return events


def _anomalies(points: list[dict[str, Any]]) -> list[TrackEvent]:
    out: list[TrackEvent] = []
    for idx, (a, b) in enumerate(zip(points[:-1], points[1:])):
        dt_a = parse_iso(a.get("time"))
        dt_b = parse_iso(b.get("time"))
        seconds = None
        if dt_a and dt_b:
            seconds = (dt_b - dt_a).total_seconds()
            if seconds >= 600:
                out.append(
                    TrackEvent(
                        kind="time_gap",
                        index=idx + 1,
                        label="Časová mezera v tracku",
                        confidence="high",
                        duration_seconds=float(seconds),
                        detail=f"Mezi dvěma GPS body chybí přibližně {seconds / 60:.1f} min dat.",
                    )
                )
        try:
            dist = haversine_km(a, b)
        except Exception:
            dist = 0.0
        implied = None
        if seconds and seconds > 0:
            implied = dist / (seconds / 3600.0)
        if dist >= 8.0 and (seconds is None or seconds <= 120 or (implied is not None and implied > 700)):
            out.append(
                TrackEvent(
                    kind="gps_jump",
                    index=idx + 1,
                    label="Podezřelý GPS skok",
                    confidence="medium",
                    duration_seconds=float(seconds) if seconds is not None else None,
                    detail=f"Skok mezi body je přibližně {dist:.1f} km" + (f" ({implied:.0f} km/h)." if implied else "."),
                )
            )
    return out



def _series_edge_median(series: pd.Series, start: int, end: int) -> float | None:
    """Return a robust median for one index window, ignoring missing values."""
    if series.empty:
        return None
    start = max(0, int(start))
    end = min(len(series), int(end))
    if end <= start:
        return None
    window = pd.to_numeric(series.iloc[start:end], errors="coerce").dropna()
    if window.empty:
        return None
    return float(window.median())


def _time_gap_turnaround_event(
    points: list[dict[str, Any]],
    prof: pd.DataFrame,
    anomaly: TrackEvent,
) -> TrackEvent | None:
    """Classify a long timestamp gap as a likely landing/turnaround/new flight.

    A timestamp gap alone is not enough because ADS-B coverage can disappear in
    cruise. Stronger evidence is a landing-like trend before the gap and a
    departure-like trend after it, or a very long gap whose endpoints stay near
    the same place. This deliberately uses samples around the missing interval
    instead of interpolating through it.
    """
    if anomaly.kind != "time_gap" or not anomaly.duration_seconds:
        return None

    duration = float(anomaly.duration_seconds)
    if duration < 600:
        return None

    idx = max(1, min(len(points) - 1, int(anomaly.index)))
    if idx <= 0 or idx >= len(points):
        return None

    try:
        endpoint_km = float(haversine_km(points[idx - 1], points[idx]))
    except Exception:
        endpoint_km = 9999.0

    left_dist = _segment_distance(prof, 0, idx - 1)
    right_dist = _segment_distance(prof, idx, len(prof) - 1)
    credible_sides = left_dist >= 1.5 and right_dist >= 1.5
    if not credible_sides:
        return None

    alt = pd.to_numeric(prof.get("alt_m", pd.Series(index=prof.index, dtype=float)), errors="coerce")
    speed = pd.to_numeric(prof.get("speed_smooth", pd.Series(index=prof.index, dtype=float)), errors="coerce")

    before_early_alt = _series_edge_median(alt, idx - 12, idx - 8)
    before_late_alt = _series_edge_median(alt, idx - 4, idx)
    after_early_alt = _series_edge_median(alt, idx, idx + 4)
    after_late_alt = _series_edge_median(alt, idx + 8, idx + 12)

    before_early_speed = _series_edge_median(speed, idx - 12, idx - 8)
    before_late_speed = _series_edge_median(speed, idx - 4, idx)
    after_early_speed = _series_edge_median(speed, idx + 1, idx + 5)
    after_late_speed = _series_edge_median(speed, idx + 8, idx + 12)

    descent_before = (
        before_early_alt is not None
        and before_late_alt is not None
        and before_early_alt - before_late_alt >= 20.0
    )
    climb_after = (
        after_early_alt is not None
        and after_late_alt is not None
        and after_late_alt - after_early_alt >= 20.0
    )
    slowing_before = (
        before_early_speed is not None
        and before_late_speed is not None
        and before_early_speed - before_late_speed >= 15.0
    )
    accelerating_after = (
        after_early_speed is not None
        and after_late_speed is not None
        and after_late_speed - after_early_speed >= 15.0
    )

    landing_departure_shape = descent_before and climb_after
    speed_turnaround = slowing_before and accelerating_after

    likely_split = False
    confidence = "medium"

    # Because this result is only a proposal and the UI always offers "keep as one
    # flight", the detector can intentionally favour recall over destructive
    # certainty for very long gaps.
    if duration >= 600 and landing_departure_shape and endpoint_km <= 60.0:
        likely_split = True
        confidence = "high"
    elif duration >= 3600 and endpoint_km <= 50.0:
        likely_split = True
        confidence = "high"
    elif duration >= 1200 and endpoint_km <= 12.0 and speed_turnaround:
        likely_split = True
        confidence = "high"
    elif duration >= 1800 and landing_departure_shape:
        likely_split = True
        confidence = "high"
    elif duration >= 5400:
        # A 90+ minute hole between two meaningful track portions is important
        # enough to ask the pilot whether these are separate flights even when
        # the source lacks enough approach/departure fixes to prove it.
        likely_split = True
        confidence = "medium"
    elif duration >= 1800 and endpoint_km <= 4.0:
        likely_split = True
        confidence = "medium"

    if not likely_split:
        return None

    signals = [f"časová mezera {duration / 60:.0f} min", f"body před/po mezeře {endpoint_km:.1f} km od sebe"]
    if landing_departure_shape:
        signals.append("před mezerou klesání a po mezeře stoupání")
    if speed_turnaround:
        signals.append("před mezerou zpomalování a po mezeře zrychlování")

    split_idx = max(1, min(len(points) - 2, idx - 1))
    return TrackEvent(
        kind="split",
        index=split_idx,
        label="Pravděpodobné přistání, přestávka a nový let",
        confidence=confidence,
        duration_seconds=duration,
        detail=", ".join(signals),
    )


def analyze_track(points: list[dict[str, Any]], tz=LOCAL_TZ) -> dict[str, Any]:
    normalized = normalize_track_points(points)
    if len(normalized) < 2:
        return {
            "point_count": len(normalized),
            "flight_count": 0,
            "split_candidates": [],
            "touch_and_go_events": [],
            "touch_and_go_count": 0,
            "landing_count": 0,
            "anomalies": [],
        }

    prof = profile_from_points(normalized, tz)
    air_segments = _air_segments(prof)
    split_events: list[TrackEvent] = []
    touch_events: list[TrackEvent] = []

    # Classify gaps between two credible airborne segments. A true stop creates a
    # split candidate; a short rolling contact is treated as touch-and-go.
    for left, right in zip(air_segments[:-1], air_segments[1:]):
        gap_start = left[1] + 1
        gap_end = right[0] - 1
        if gap_end < gap_start:
            continue
        gap_duration = _seconds_between(prof, left[1], right[0])
        low_speed_seconds = _gap_low_speed_seconds(prof, gap_start, gap_end, threshold=10.0)
        speed = pd.to_numeric(prof.get("speed_smooth", pd.Series(index=prof.index, dtype=float)), errors="coerce")
        gap_speed = speed.iloc[gap_start:gap_end + 1]
        median_speed = float(gap_speed.median()) if gap_speed.notna().any() else None
        min_speed = float(gap_speed.min()) if gap_speed.notna().any() else None
        left_dist = _segment_distance(prof, *left)
        right_dist = _segment_distance(prof, *right)
        credible_sides = left_dist >= 0.8 and right_dist >= 0.8

        full_stop = False
        confidence = "medium"
        if gap_duration is not None and gap_duration >= 90 and credible_sides:
            full_stop = True
            confidence = "high" if gap_duration >= 180 else "medium"
        if low_speed_seconds >= 8 and credible_sides:
            full_stop = True
            confidence = "high" if low_speed_seconds >= 25 else confidence
        if min_speed is not None and min_speed <= 4 and credible_sides and (gap_duration is None or gap_duration >= 20):
            full_stop = True

        split_idx = _choose_split_idx(prof, gap_start, gap_end)
        if full_stop:
            detail_parts = []
            if gap_duration is not None:
                detail_parts.append(f"mezera mezi letovými úseky {gap_duration:.0f} s")
            if low_speed_seconds:
                detail_parts.append(f"nízká rychlost přibližně {low_speed_seconds:.0f} s")
            split_events.append(
                TrackEvent(
                    kind="split",
                    index=split_idx,
                    label="Pravděpodobné ukončení jednoho letu a nový vzlet",
                    confidence=confidence,
                    duration_seconds=gap_duration,
                    detail=", ".join(detail_parts),
                )
            )
        else:
            # A short gap between airborne segments is likely a touch-and-go only
            # when the aircraft did not actually stop.
            if credible_sides and (gap_duration is None or gap_duration <= 90):
                if min_speed is None or min_speed > 8:
                    touch_events.append(
                        TrackEvent(
                            kind="touch_and_go",
                            index=split_idx,
                            label="Pravděpodobný touch-and-go",
                            confidence="high" if (median_speed or 0) >= 25 else "medium",
                            duration_seconds=gap_duration,
                            detail=(f"Krátký kontakt/mezera {gap_duration:.0f} s, " if gap_duration is not None else "Krátká mezera, ")
                            + (f"min. rychlost {min_speed:.0f} km/h." if min_speed is not None else "bez úplného zastavení."),
                        )
                    )

    # Time gaps need special handling. GPS/ADSB sources may provide a speed at both
    # edges of a multi-hour gap, so an index-based airborne segment can otherwise
    # appear continuous. Classify the physical situation around the gap instead:
    # descent/slowdown before it, climb/acceleration after it, and endpoint proximity.
    anomalies = _anomalies(normalized)
    for anomaly in anomalies:
        gap_event = _time_gap_turnaround_event(normalized, prof, anomaly)
        if gap_event is not None:
            if not any(abs(ev.index - gap_event.index) <= 5 for ev in split_events):
                split_events.append(gap_event)
            continue

        # Conservative fallback: if the gap already separates two independently
        # detected airborne segments, it is also a split candidate.
        if anomaly.kind != "time_gap" or not anomaly.duration_seconds or anomaly.duration_seconds < 300:
            continue
        idx = int(anomaly.index)
        before = [seg for seg in air_segments if seg[1] < idx]
        after = [seg for seg in air_segments if seg[0] >= idx]
        if before and after and not any(abs(ev.index - idx) <= 5 for ev in split_events):
            split_events.append(
                TrackEvent(
                    kind="split",
                    index=max(1, min(len(normalized) - 2, idx - 1)),
                    label="Pravděpodobné dva lety oddělené mezerou v datech",
                    confidence="high",
                    duration_seconds=anomaly.duration_seconds,
                    detail=anomaly.detail,
                )
            )

    # Touch-and-go events that do not create a speed gap (common in a rolling T&G).
    local_touch = _local_touch_and_go_events(prof, air_segments)
    for event in local_touch:
        if not any(abs(event.index - existing.index) <= 8 for existing in touch_events):
            if not any(abs(event.index - split.index) <= 10 for split in split_events):
                touch_events.append(event)

    split_events.sort(key=lambda e: e.index)
    # Keep split positions distinct and away from the edges.
    deduped_splits: list[TrackEvent] = []
    for event in split_events:
        idx = max(1, min(len(normalized) - 2, int(event.index)))
        if deduped_splits and idx - deduped_splits[-1].index < 5:
            continue
        deduped_splits.append(TrackEvent(**{**event.to_dict(), "index": idx}))

    touch_events.sort(key=lambda e: e.index)
    flight_count = max(1, len(deduped_splits) + 1)
    # If several flights are kept as one logbook entry, every full-stop segment still
    # represents a landing. Touch-and-go adds another landing without another entry.
    landing_count = max(1, flight_count + len(touch_events))

    return {
        "point_count": len(normalized),
        "distance_km": track_distance_km(normalized),
        "air_segments": [{"start_idx": a, "end_idx": b} for a, b in air_segments],
        "flight_count": flight_count,
        "split_candidates": [e.to_dict() for e in deduped_splits],
        "touch_and_go_events": [e.to_dict() for e in touch_events],
        "touch_and_go_count": len(touch_events),
        "landing_count": landing_count,
        "anomalies": [e.to_dict() for e in anomalies],
    }


def split_track_points(points: list[dict[str, Any]], split_indices: list[int]) -> list[list[dict[str, Any]]]:
    normalized = normalize_track_points(points)
    if len(normalized) < 2:
        return [normalized]
    clean = sorted({max(1, min(len(normalized) - 1, int(idx))) for idx in split_indices})
    if not clean:
        return [normalized]
    segments: list[list[dict[str, Any]]] = []
    start = 0
    for idx in clean:
        part = normalized[start:idx + 1]
        if len(part) >= 2:
            segments.append(part)
        start = idx + 1
    tail = normalized[start:]
    if len(tail) >= 2:
        segments.append(tail)
    return segments or [normalized]
