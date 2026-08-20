from zoneinfo import ZoneInfo

from logbook_core.track_player import build_track_player_payload


def _timed_points():
    return [
        {"lat": 50.0000, "lon": 14.0000, "alt": 250, "time": "2026-08-20T08:00:00+00:00"},
        {"lat": 50.0100, "lon": 14.0200, "alt": 500, "time": "2026-08-20T08:00:10+00:00"},
        {"lat": 50.0200, "lon": 14.0400, "alt": 750, "time": "2026-08-20T08:00:30+00:00"},
        {"lat": 50.0300, "lon": 14.0600, "alt": 300, "time": "2026-08-20T08:00:45+00:00"},
    ]


def test_payload_contains_real_timeline_and_aviation_speed():
    payload, default_idx, original_count = build_track_player_payload(
        _timed_points(),
        ZoneInfo("Europe/Prague"),
        max_points=100,
    )
    assert original_count == 4
    assert len(payload) == 4
    assert 0 <= default_idx < 4
    assert payload[0]["elapsed_s"] == 0.0
    assert payload[1]["elapsed_s"] == 10.0
    assert payload[2]["elapsed_s"] == 30.0
    assert payload[-1]["elapsed_s"] == 45.0
    assert payload[0]["time"] == "10:00:00"
    assert payload[-1]["time"] == "10:00:45"
    assert payload[1]["speed_kmh"] is not None
    assert payload[1]["speed_kt"] is not None
    assert abs(payload[1]["speed_kt"] - payload[1]["speed_kmh"] * 0.539956803) < 0.2


def test_payload_bearing_stays_normalized():
    payload, _default_idx, _original_count = build_track_player_payload(
        _timed_points(),
        ZoneInfo("UTC"),
    )
    assert all(0.0 <= point["bearing"] < 360.0 for point in payload)


def test_payload_falls_back_cleanly_without_timestamps():
    raw = [
        {"lat": 50.0, "lon": 14.0, "alt": 200, "time": None},
        {"lat": 50.1, "lon": 14.1, "alt": 300, "time": None},
        {"lat": 50.2, "lon": 14.2, "alt": 400, "time": None},
    ]
    payload, default_idx, original_count = build_track_player_payload(
        raw,
        ZoneInfo("UTC"),
    )
    assert original_count == 3
    assert len(payload) == 3
    assert default_idx >= 0
    assert all(point["elapsed_s"] is None for point in payload)
    assert all(point["time"] == "—" for point in payload)


def test_payload_respects_browser_point_cap():
    points = [
        {
            "lat": 50.0 + i * 0.0001,
            "lon": 14.0 + i * 0.0001,
            "alt": 200 + i,
            "time": f"2026-08-20T08:{i // 60:02d}:{i % 60:02d}+00:00",
        }
        for i in range(120)
    ]
    payload, _default_idx, original_count = build_track_player_payload(
        points,
        ZoneInfo("UTC"),
        max_points=40,
    )
    assert original_count == 120
    assert len(payload) == 40
