from __future__ import annotations

from collections import deque
import math
import statistics
import threading
import time
from typing import Any


_MAX_QUERY_EVENTS = 600
_MAX_CHECKOUT_EVENTS = 300
_MAX_PAGE_EVENTS = 300
_SLOW_QUERY_MS = 250.0

_LOCK = threading.RLock()
_QUERY_EVENTS: deque[dict[str, Any]] = deque(maxlen=_MAX_QUERY_EVENTS)
_CHECKOUT_EVENTS: deque[dict[str, Any]] = deque(maxlen=_MAX_CHECKOUT_EVENTS)
_PAGE_EVENTS: deque[dict[str, Any]] = deque(maxlen=_MAX_PAGE_EVENTS)


def _now_monotonic() -> float:
    return float(time.monotonic())


def _percentile(values: list[float], pct: float) -> float | None:
    clean = sorted(float(v) for v in values if math.isfinite(float(v)))
    if not clean:
        return None
    if len(clean) == 1:
        return round(clean[0], 2)
    pos = (len(clean) - 1) * max(0.0, min(1.0, float(pct)))
    lo = int(math.floor(pos))
    hi = int(math.ceil(pos))
    if lo == hi:
        value = clean[lo]
    else:
        weight = pos - lo
        value = clean[lo] * (1.0 - weight) + clean[hi] * weight
    return round(value, 2)


def _summary(values: list[float]) -> dict[str, float | int | None]:
    clean = [float(v) for v in values if math.isfinite(float(v))]
    if not clean:
        return {
            "count": 0,
            "avg_ms": None,
            "p50_ms": None,
            "p95_ms": None,
            "max_ms": None,
        }
    return {
        "count": len(clean),
        "avg_ms": round(float(statistics.fmean(clean)), 2),
        "p50_ms": _percentile(clean, 0.50),
        "p95_ms": _percentile(clean, 0.95),
        "max_ms": round(max(clean), 2),
    }


def record_query_event(
    *,
    tag: str,
    duration_ms: float,
    success: bool,
    rows: int | None = None,
    batch_size: int | None = None,
) -> None:
    event = {
        "at": _now_monotonic(),
        "tag": str(tag or "UNKNOWN")[:80],
        "duration_ms": round(float(duration_ms), 3),
        "success": bool(success),
        "rows": int(rows) if rows is not None else None,
        "batch_size": int(batch_size) if batch_size is not None else None,
    }
    with _LOCK:
        _QUERY_EVENTS.append(event)


def record_checkout_event(*, duration_ms: float, success: bool) -> None:
    with _LOCK:
        _CHECKOUT_EVENTS.append({
            "at": _now_monotonic(),
            "duration_ms": round(float(duration_ms), 3),
            "success": bool(success),
        })


def record_page_event(*, page: str, duration_ms: float) -> None:
    with _LOCK:
        _PAGE_EVENTS.append({
            "at": _now_monotonic(),
            "page": str(page or "unknown")[:80],
            "duration_ms": round(float(duration_ms), 3),
        })


def _recent(events: list[dict[str, Any]], window_seconds: int) -> list[dict[str, Any]]:
    cutoff = _now_monotonic() - max(1, int(window_seconds))
    return [event for event in events if float(event.get("at") or 0.0) >= cutoff]


def runtime_performance_snapshot(*, window_seconds: int = 900) -> dict[str, Any]:
    """Return aggregate runtime diagnostics without SQL text or query parameters."""
    with _LOCK:
        queries = _recent(list(_QUERY_EVENTS), window_seconds)
        checkouts = _recent(list(_CHECKOUT_EVENTS), window_seconds)
        pages = _recent(list(_PAGE_EVENTS), window_seconds)

    query_ms = [float(item["duration_ms"]) for item in queries]
    checkout_ms = [float(item["duration_ms"]) for item in checkouts]
    page_ms = [float(item["duration_ms"]) for item in pages]

    by_tag: dict[str, list[float]] = {}
    for item in queries:
        by_tag.setdefault(str(item.get("tag") or "UNKNOWN"), []).append(float(item["duration_ms"]))
    tag_rows = []
    for tag, durations in by_tag.items():
        summary = _summary(durations)
        tag_rows.append({
            "tag": tag,
            **summary,
            "total_ms": round(sum(durations), 2),
            "slow_count": sum(1 for value in durations if value >= _SLOW_QUERY_MS),
        })
    tag_rows.sort(key=lambda row: (-float(row.get("total_ms") or 0), str(row.get("tag") or "")))

    by_page: dict[str, list[float]] = {}
    for item in pages:
        by_page.setdefault(str(item.get("page") or "unknown"), []).append(float(item["duration_ms"]))
    page_rows = []
    for page, durations in by_page.items():
        page_rows.append({"page": page, **_summary(durations), "total_ms": round(sum(durations), 2)})
    page_rows.sort(key=lambda row: (-float(row.get("total_ms") or 0), str(row.get("page") or "")))

    slowest = sorted(
        (
            {
                "tag": str(item.get("tag") or "UNKNOWN"),
                "duration_ms": float(item["duration_ms"]),
                "success": bool(item.get("success", True)),
            }
            for item in queries
        ),
        key=lambda row: -float(row["duration_ms"]),
    )[:12]

    return {
        "window_seconds": int(window_seconds),
        "query": _summary(query_ms),
        "checkout": _summary(checkout_ms),
        "page": _summary(page_ms),
        "query_failures": sum(1 for item in queries if not bool(item.get("success", True))),
        "slow_query_threshold_ms": _SLOW_QUERY_MS,
        "slow_queries": sum(1 for value in query_ms if value >= _SLOW_QUERY_MS),
        "by_tag": tag_rows,
        "by_page": page_rows,
        "slowest": slowest,
    }


def reset_runtime_performance_metrics() -> None:
    with _LOCK:
        _QUERY_EVENTS.clear()
        _CHECKOUT_EVENTS.clear()
        _PAGE_EVENTS.clear()
