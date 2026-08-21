from __future__ import annotations

import json
import unittest

from logbook_core.map_engine import (
    build_gps_render_plan,
    encode_compact_track_points,
    simplify_track_points,
    viewport_from_coords,
)


class MapEngineTests(unittest.TestCase):
    def test_quick_and_medium_use_v0733_latency_track_caps(self) -> None:
        quick = build_gps_render_plan("Rychlá", 300)
        medium = build_gps_render_plan("Střední", 300)
        self.assertEqual(quick.selected_tracks, 32)
        self.assertEqual(medium.selected_tracks, 100)
        self.assertLessEqual(quick.estimated_payload_points, quick.total_point_budget)
        self.assertLessEqual(medium.estimated_payload_points, medium.total_point_budget)

    def test_all_mode_uses_adaptive_global_budget(self) -> None:
        plan = build_gps_render_plan("Vše", 2000)
        self.assertEqual(plan.selected_tracks, 2000)
        self.assertEqual(plan.points_per_track, 9)
        self.assertLessEqual(plan.estimated_payload_points, plan.total_point_budget)
        self.assertGreater(plan.candidate_points_per_track, plan.points_per_track)

    def test_geometry_simplifier_preserves_endpoints_and_corner(self) -> None:
        # Long almost-straight path with one large turn in the middle.
        points = []
        for i in range(101):
            lat = 50.0 + i * 0.0001
            lon = 14.0 + i * 0.0001
            if i == 50:
                lon += 0.05
            points.append({"lat": lat, "lon": lon, "alt": 300 + i, "time": f"t{i}"})

        simplified = simplify_track_points(points, max_points=8)
        self.assertLessEqual(len(simplified), 8)
        self.assertEqual(simplified[0]["time"], "t0")
        self.assertEqual(simplified[-1]["time"], "t100")
        self.assertTrue(any(p["time"] == "t50" for p in simplified))

    def test_compact_json_precision_and_budget(self) -> None:
        points = [
            {"lat": 50.00000049 + i * 0.0001, "lon": 14.00000049 + i * 0.0001, "alt": 350.123, "time": f"t{i}"}
            for i in range(40)
        ]
        payload = json.loads(encode_compact_track_points(points, max_points=10))
        self.assertLessEqual(len(payload), 10)
        self.assertEqual(payload[0]["lat"], round(points[0]["lat"], 6))
        self.assertEqual(payload[0]["alt"], 350.1)

    def test_viewport(self) -> None:
        view = viewport_from_coords([(50.0, 14.0), (50.1, 14.1)], profile="track")
        self.assertAlmostEqual(view.center[0], 50.05)
        self.assertAlmostEqual(view.center[1], 14.05)
        self.assertEqual(view.zoom, 10)
        self.assertIsNotNone(view.bounds)


if __name__ == "__main__":
    unittest.main()
