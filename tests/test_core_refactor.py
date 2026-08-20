from __future__ import annotations

import unittest

import pandas as pd
from zoneinfo import ZoneInfo

from logbook_core.config import APP_VERSION, DB_SCHEMA_VERSION
from logbook_core.metrics import build_summary, compute_metrics, fmt_minutes, fmt_money, minutes_diff, normalize_date
from logbook_core.tracks import detect_kml_source, parse_kml_bytes, point_local_date, track_stats


class CoreRefactorTests(unittest.TestCase):
    def test_version(self) -> None:
        self.assertEqual(APP_VERSION, "v0.61.6")
        self.assertEqual(DB_SCHEMA_VERSION, 8)

    def test_time_helpers(self) -> None:
        self.assertEqual(minutes_diff("23:50", "00:10"), 20)
        self.assertEqual(fmt_minutes(80), "1:20")
        self.assertEqual(normalize_date("20.08.2026"), "2026-08-20")

    def test_compute_metrics_preserves_billing_logic(self) -> None:
        df = pd.DataFrame([
            {
                "date": "2026-08-20",
                "off_block": "10:00",
                "takeoff": "10:05",
                "landing": "10:55",
                "on_block": "11:00",
                "price_per_hour": 3000,
                "billing_basis": "AIR",
                "role": "PIC",
                "evidence": "EASA",
                "registration": "OK-TEST",
                "aircraft_class": "SEP",
                "starts": 1,
            }
        ])
        out = compute_metrics(df)
        self.assertEqual(int(out.iloc[0]["block_minutes"]), 60)
        self.assertEqual(int(out.iloc[0]["air_minutes"]), 50)
        self.assertAlmostEqual(float(out.iloc[0]["cost"]), 2500.0, places=2)

    def test_summary(self) -> None:
        df = pd.DataFrame([
            {
                "starts": 1,
                "block_minutes": 60,
                "air_minutes": 50,
                "role": "PIC",
                "evidence": "EASA",
                "cost": 2500.0,
                "track_count": 1,
                "gps_km": 120.0,
            }
        ])
        summary = build_summary(df)
        self.assertEqual(summary["flights"], 1)
        self.assertEqual(summary["pic"], 60)
        self.assertEqual(summary["pic_easa"], 60)
        self.assertEqual(summary["tracks"], 1)


    def test_profile_currency_formatting(self) -> None:
        self.assertEqual(fmt_money(2500, "EUR"), "2 500 €")
        df = pd.DataFrame([{
            "date": "2026-08-20", "off_block": "10:00", "takeoff": "10:05",
            "landing": "10:55", "on_block": "11:00", "price_per_hour": 3000,
            "billing_basis": "BLOCK", "role": "PIC", "evidence": "EASA",
            "registration": "OK-TEST", "aircraft_class": "SEP", "starts": 1,
        }])
        out = compute_metrics(df, currency="EUR")
        self.assertEqual(out.iloc[0]["cost_label"], "3 000 €")

    def test_track_date_respects_profile_timezone(self) -> None:
        points = [{"lat": 50.0, "lon": 14.0, "time": "2026-08-20T00:30:00Z"}]
        self.assertEqual(str(point_local_date(points, ZoneInfo("Europe/Prague"))), "2026-08-20")
        self.assertEqual(str(point_local_date(points, ZoneInfo("America/Los_Angeles"))), "2026-08-19")

    def test_kml_linestring(self) -> None:
        raw = b'''<?xml version="1.0"?>
        <kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark>
        <LineString><coordinates>14.0,50.0,300 14.1,50.1,400</coordinates></LineString>
        </Placemark></Document></kml>'''
        points = parse_kml_bytes(raw)
        stats = track_stats(points)
        self.assertEqual(len(points), 2)
        self.assertEqual(stats["point_count"], 2)
        self.assertGreater(stats["distance_km"], 0)
        self.assertEqual(detect_kml_source(raw, "sample.kml"), "KML LineString")


if __name__ == "__main__":
    unittest.main()
