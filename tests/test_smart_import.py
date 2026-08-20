from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from logbook_core.smart_import import analyze_track, split_track_points


class SmartImportTests(unittest.TestCase):
    @staticmethod
    def _append(points, state, seconds: int, speed_kmh: float, alt_m: float) -> None:
        t, lat, lon = state
        lon += (speed_kmh * seconds / 3600.0) / 71.5
        t += timedelta(seconds=seconds)
        state[:] = [t, lat, lon]
        points.append({"lat": lat, "lon": lon, "alt": alt_m, "time": t.isoformat()})

    def test_two_flights_with_full_stop_are_proposed_for_split(self) -> None:
        t = datetime(2026, 8, 20, 8, 0, tzinfo=timezone.utc)
        state = [t, 50.0, 14.0]
        points = [{"lat": 50.0, "lon": 14.0, "alt": 250.0, "time": t.isoformat()}]
        for i in range(60):
            self._append(points, state, 5, 100, 250 + min(i, 20) * 10)
        for _ in range(12):
            self._append(points, state, 5, 0, 250)
        for i in range(60):
            self._append(points, state, 5, 105, 250 + min(i, 20) * 10)

        result = analyze_track(points)
        self.assertEqual(result["flight_count"], 2)
        self.assertEqual(len(result["split_candidates"]), 1)
        self.assertEqual(result["touch_and_go_count"], 0)
        split_idx = result["split_candidates"][0]["index"]
        parts = split_track_points(points, [split_idx])
        self.assertEqual(len(parts), 2)
        self.assertEqual(sum(len(p) for p in parts), len(points))

    def test_rolling_touch_and_go_counts_landing_but_does_not_split(self) -> None:
        t = datetime(2026, 8, 20, 8, 0, tzinfo=timezone.utc)
        state = [t, 50.0, 14.0]
        altitudes = []
        for a0, a1, n in [(250, 500, 30), (500, 250, 30), (250, 500, 30), (500, 250, 30)]:
            altitudes.extend(a0 + (a1 - a0) * i / (n - 1) for i in range(n))
        points = [{"lat": 50.0, "lon": 14.0, "alt": altitudes[0], "time": t.isoformat()}]
        for alt in altitudes[1:]:
            self._append(points, state, 5, 75, alt)

        result = analyze_track(points)
        self.assertEqual(result["flight_count"], 1)
        self.assertEqual(result["touch_and_go_count"], 1)
        self.assertEqual(result["landing_count"], 2)
        self.assertEqual(result["split_candidates"], [])

    def test_user_can_keep_multi_flight_track_unsplit(self) -> None:
        points = [
            {"lat": 50.0, "lon": 14.0, "alt": 300, "time": "2026-08-20T08:00:00Z"},
            {"lat": 50.1, "lon": 14.1, "alt": 500, "time": "2026-08-20T08:05:00Z"},
        ]
        parts = split_track_points(points, [])
        self.assertEqual(parts, [points])


    def test_long_turnaround_gap_with_descent_and_climb_is_split(self) -> None:
        t = datetime(2026, 8, 20, 8, 0, tzinfo=timezone.utc)
        state = [t, 50.0, 14.0]
        points = [{"lat": 50.0, "lon": 14.0, "alt": 250.0, "time": t.isoformat()}]

        # First flight: climb, cruise, then a clear descent toward the gap.
        for i in range(30):
            self._append(points, state, 5, 105, 250 + i * 10)
        for _ in range(20):
            self._append(points, state, 5, 105, 540)
        for i in range(24):
            self._append(points, state, 5, max(65, 105 - i * 1.5), 540 - i * 12)

        # No ground fixes: ADS-B resumes more than two hours later at essentially
        # the same location, already at the beginning of the next departure.
        state[0] += timedelta(hours=2, minutes=20)
        points.append({"lat": state[1], "lon": state[2], "alt": 265.0, "time": state[0].isoformat()})

        # Second flight: acceleration/climb away from the turnaround airport.
        for i in range(40):
            self._append(points, state, 5, min(110, 55 + i * 2), 265 + i * 9)

        result = analyze_track(points)
        self.assertEqual(result["flight_count"], 2)
        self.assertEqual(len(result["split_candidates"]), 1)
        self.assertEqual(result["landing_count"], 2)
        self.assertTrue(any(x["kind"] == "time_gap" for x in result["anomalies"]))

    def test_long_cruise_coverage_gap_does_not_force_split(self) -> None:
        t = datetime(2026, 8, 20, 8, 0, tzinfo=timezone.utc)
        state = [t, 50.0, 14.0]
        points = [{"lat": 50.0, "lon": 14.0, "alt": 1200.0, "time": t.isoformat()}]
        for _ in range(25):
            self._append(points, state, 5, 150, 1200)

        # Simulate a long loss of coverage while the aircraft continues far away.
        state[0] += timedelta(minutes=45)
        state[2] += 1.0  # tens of kilometres away
        points.append({"lat": state[1], "lon": state[2], "alt": 1210.0, "time": state[0].isoformat()})
        for _ in range(25):
            self._append(points, state, 5, 150, 1200)

        result = analyze_track(points)
        self.assertEqual(result["flight_count"], 1)
        self.assertEqual(result["split_candidates"], [])
        self.assertTrue(any(x["kind"] == "time_gap" for x in result["anomalies"]))

    def test_large_timestamp_gap_is_reported(self) -> None:
        points = [
            {"lat": 50.0, "lon": 14.0, "alt": 300, "time": "2026-08-20T08:00:00Z"},
            {"lat": 50.01, "lon": 14.01, "alt": 350, "time": "2026-08-20T08:00:10Z"},
            {"lat": 50.02, "lon": 14.02, "alt": 350, "time": "2026-08-20T08:20:10Z"},
        ]
        result = analyze_track(points)
        kinds = [x["kind"] for x in result["anomalies"]]
        self.assertIn("time_gap", kinds)


if __name__ == "__main__":
    unittest.main()
