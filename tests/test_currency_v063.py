from datetime import date

import pandas as pd

from logbook_core.currency import activity_windows, expiry_overview, expiry_status, last_activity, recency_by_evidence


def sample_flights() -> pd.DataFrame:
    return pd.DataFrame([
        {"date": "2026-08-20", "evidence": "ULL", "role": "PIC", "starts": 1, "block_minutes": 60},
        {"date": "2026-08-10", "evidence": "ULL", "role": "PIC", "starts": 2, "block_minutes": 90},
        {"date": "2026-07-15", "evidence": "EASA", "role": "PIC", "starts": 1, "block_minutes": 70},
        {"date": "2026-06-01", "evidence": "EASA", "role": "DUAL", "starts": 1, "block_minutes": 50},
        {"date": "2026-04-01", "evidence": "EASA", "role": "PIC", "starts": 3, "block_minutes": 100},
    ])


def test_last_activity_uses_latest_logged_flight_and_landing():
    out = last_activity(sample_flights(), date(2026, 8, 20))
    assert out["last_flight_date"] == date(2026, 8, 20)
    assert out["last_landing_date"] == date(2026, 8, 20)
    assert out["days_since_last_flight"] == 0


def test_90_day_recency_is_pic_and_evidence_scoped():
    out = recency_by_evidence(sample_flights(), date(2026, 8, 20), 90).set_index("evidence")
    assert int(out.loc["ULL", "pic_landings"]) == 3
    assert int(out.loc["ULL", "pic_flights"]) == 2
    assert int(out.loc["ULL", "pic_minutes"]) == 150
    assert int(out.loc["EASA", "pic_landings"]) == 1
    assert int(out.loc["EASA", "pic_flights"]) == 1
    assert int(out.loc["EASA", "pic_minutes"]) == 70


def test_activity_windows_are_rolling_and_category_aware():
    out = activity_windows(sample_flights(), date(2026, 8, 20), (30, 90, 365)).set_index("days")
    assert int(out.loc[30, "ull_pic_landings"]) == 3
    assert int(out.loc[30, "easa_pic_landings"]) == 0
    assert int(out.loc[90, "easa_pic_landings"]) == 1
    assert int(out.loc[365, "easa_pic_landings"]) == 4


def test_expiry_status_covers_ok_warning_and_expired():
    today = date(2026, 8, 20)
    assert expiry_status("2026-10-01", today, 30)["state"] == "ok"
    assert expiry_status("2026-09-01", today, 30)["state"] == "warning"
    assert expiry_status("2026-08-19", today, 30)["state"] == "expired"


def test_expiry_overview_sorts_urgent_first():
    df = pd.DataFrame([
        {"id": 1, "category": "Medical", "label": "Medical", "expiry_date": "2026-10-01", "warning_days": 30, "active": 1},
        {"id": 2, "category": "Rating", "label": "SEP", "expiry_date": "2026-08-19", "warning_days": 30, "active": 1},
        {"id": 3, "category": "Licence", "label": "Licence", "expiry_date": "2026-08-25", "warning_days": 30, "active": 1},
    ])
    out = expiry_overview(df, date(2026, 8, 20))
    assert list(out["id"]) == [2, 3, 1]
    assert list(out["state"]) == ["expired", "warning", "ok"]
