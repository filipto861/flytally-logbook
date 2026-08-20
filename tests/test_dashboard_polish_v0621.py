from pathlib import Path

import pandas as pd

from logbook_core.dashboard import monthly_primary_summary, primary_pilot_summary

ROOT = Path(__file__).resolve().parents[1]


def _sample():
    return pd.DataFrame([
        {"id": 1, "date": "2026-01-10", "block_minutes": 60, "starts": 1, "evidence": "ULL", "role": "PIC"},
        {"id": 2, "date": "2026-01-20", "block_minutes": 90, "starts": 2, "evidence": "EASA", "role": "PIC"},
        {"id": 3, "date": "2026-02-05", "block_minutes": 30, "starts": 1, "evidence": "EASA", "role": "DUAL"},
    ])


def test_primary_summary_matches_logbook_priorities():
    out = primary_pilot_summary(_sample())
    assert out["total_minutes"] == 180
    assert out["total_landings"] == 4
    assert out["ull_minutes"] == 60
    assert out["ull_landings"] == 1
    assert out["easa_minutes"] == 120
    assert out["easa_landings"] == 3
    assert out["pic_ull_minutes"] == 60
    assert out["pic_ull_landings"] == 1
    assert out["pic_easa_minutes"] == 90
    assert out["pic_easa_landings"] == 2


def test_monthly_primary_summary_contains_all_primary_series():
    out = monthly_primary_summary(_sample())
    assert list(out["month"].dt.month) == [1, 2]
    january = out.iloc[0]
    assert january["total_hours"] == 2.5
    assert january["ull_hours"] == 1.0
    assert january["easa_hours"] == 1.5
    assert january["pic_ull_hours"] == 1.0
    assert january["pic_easa_hours"] == 1.5
    assert january["landings"] == 3


def test_dashboard_default_is_compact_and_detail_is_opt_in():
    text = (ROOT / "app.py").read_text(encoding="utf-8")
    assert "dashboard-primary-card" in text
    assert "PIC • ULL" in text
    assert "PIC • EASA" in text
    assert 'show_details = st.toggle(' in text
    assert "if not show_details:" in text
    assert '["Roční přehled", "Letadla", "Letiště a trasy", "Náklady", "Poslední lety"]' in text


def test_dashboard_uses_single_primary_chart_selector():
    text = (ROOT / "app.py").read_text(encoding="utf-8")
    assert '"Celkový čas", "ULL", "EASA", "PIC ULL", "PIC EASA", "Přistání"' in text
    assert 'title="Vývoj po měsících"' in text
