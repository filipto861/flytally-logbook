from datetime import date

import pandas as pd

from logbook_core.dashboard import (
    aircraft_summary,
    airport_route_summaries,
    category_year_summary,
    dashboard_insights,
    filter_period,
    monthly_summary,
    period_label,
    yearly_summary,
)


def sample_df() -> pd.DataFrame:
    return pd.DataFrame([
        {
            "id": 1, "date": "2025-08-10", "date_dt": pd.Timestamp("2025-08-10"), "year": 2025,
            "registration": "OK-AAA", "aircraft_type": "Bristell", "departure": "LKVO", "arrival": "LKSZ",
            "role": "PIC", "evidence": "ULL", "starts": 1, "block_minutes": 60, "air_minutes": 50,
            "block_hours": 1.0, "air_hours": 50/60, "cost": 3000.0, "gps_km": 100.0, "track_count": 1,
        },
        {
            "id": 2, "date": "2026-01-15", "date_dt": pd.Timestamp("2026-01-15"), "year": 2026,
            "registration": "OK-AAA", "aircraft_type": "Bristell", "departure": "LKSZ", "arrival": "LKLT",
            "role": "PIC", "evidence": "ULL", "starts": 2, "block_minutes": 90, "air_minutes": 75,
            "block_hours": 1.5, "air_hours": 1.25, "cost": 4500.0, "gps_km": 150.0, "track_count": 1,
        },
        {
            "id": 3, "date": "2026-08-01", "date_dt": pd.Timestamp("2026-08-01"), "year": 2026,
            "registration": "OK-BBB", "aircraft_type": "C172", "departure": "LKLT", "arrival": "LKVO",
            "role": "DUAL", "evidence": "EASA", "starts": 1, "block_minutes": 120, "air_minutes": 100,
            "block_hours": 2.0, "air_hours": 100/60, "cost": 8000.0, "gps_km": 200.0, "track_count": 0,
        },
    ])


def test_period_filters_and_labels():
    df = sample_df()
    today = date(2026, 8, 20)
    assert len(filter_period(df, "Vše", today)) == 3
    assert list(filter_period(df, "Tento rok", today)["id"]) == [2, 3]
    assert list(filter_period(df, "Předchozí rok", today)["id"]) == [1]
    assert list(filter_period(df, "Posledních 12 měsíců", today)["id"]) == [2, 3]
    assert period_label("Tento rok", today) == "2026"
    assert period_label("Předchozí rok", today) == "2025"


def test_monthly_and_yearly_summaries_are_correct():
    df = sample_df()
    monthly = monthly_summary(df)
    assert monthly["flights"].sum() == 3
    assert monthly["block_minutes"].sum() == 270
    yearly = yearly_summary(df)
    row_2026 = yearly[yearly["year"].eq(2026)].iloc[0]
    assert int(row_2026["flights"]) == 2
    assert int(row_2026["block_minutes"]) == 210
    assert int(row_2026["pic_minutes"]) == 90
    assert int(row_2026["dual_minutes"]) == 120
    assert int(row_2026["ull_minutes"]) == 90
    assert int(row_2026["easa_minutes"]) == 120


def test_aircraft_summary_adds_share_average_and_cost_rate():
    summary = aircraft_summary(sample_df())
    aaa = summary[summary["registration"].eq("OK-AAA")].iloc[0]
    assert int(aaa["flights"]) == 2
    assert int(aaa["block_minutes"]) == 150
    assert round(float(aaa["avg_block_minutes"]), 1) == 75.0
    assert round(float(aaa["cost_per_block_hour"]), 1) == 3000.0
    assert 55 < float(aaa["share_block_pct"]) < 56


def test_airport_and_route_summaries_keep_direction():
    airports, routes = airport_route_summaries(sample_df())
    lkvo = airports[airports["airport"].eq("LKVO")].iloc[0]
    assert int(lkvo["departures"]) == 1
    assert int(lkvo["arrivals"]) == 1
    assert int(lkvo["visits"]) == 2
    assert set(routes["route"]) == {"LKVO–LKSZ", "LKSZ–LKLT", "LKLT–LKVO"}


def test_dashboard_insights_cover_gps_and_records():
    insights = dashboard_insights(sample_df())
    assert insights["unique_aircraft"] == 2
    assert insights["unique_airports"] == 3
    assert insights["unique_routes"] == 3
    assert round(insights["gps_coverage_pct"], 1) == 66.7
    assert insights["top_aircraft"] == "OK-AAA"
    assert insights["longest_flight_minutes"] == 120
    assert "OK-BBB" in insights["longest_flight_label"]


def test_category_year_summary_is_lazy_chart_input():
    role = category_year_summary(sample_df(), "role")
    assert set(role["role"]) == {"PIC", "DUAL"}
    assert round(role[role["role"].eq("DUAL")]["block_hours"].sum(), 1) == 2.0
