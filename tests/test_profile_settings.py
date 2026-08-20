from __future__ import annotations

import sys
import types

import pandas as pd


def _cache_data(*args, **kwargs):
    def decorate(fn):
        return fn
    return decorate


if "streamlit" not in sys.modules:
    sys.modules["streamlit"] = types.SimpleNamespace(cache_data=_cache_data)

from logbook_core.exports import make_logbook_export_df, make_summary_table
from logbook_core.metrics import compute_metrics


def _sample() -> pd.DataFrame:
    raw = pd.DataFrame([{
        "id": 1,
        "date": "2026-08-20",
        "off_block": "10:00",
        "takeoff": "10:05",
        "landing": "10:55",
        "on_block": "11:00",
        "price_per_hour": 100,
        "billing_basis": "BLOCK",
        "role": "PIC",
        "evidence": "EASA",
        "registration": "OK-TEST",
        "aircraft_type": "TEST",
        "aircraft_class": "SEP",
        "departure": "LKVO",
        "arrival": "LKVO",
        "starts": 1,
        "track_count": 0,
        "gps_km": 0.0,
    }])
    return compute_metrics(raw, currency="EUR")


def test_exports_use_profile_currency_label() -> None:
    df = _sample()
    detail = make_logbook_export_df(df, "EUR")
    assert "Cena EUR/h" in detail.columns
    assert "Cena letu EUR" in detail.columns
    summary = make_summary_table(df, "EUR")
    cost = summary.loc[summary["Metrika"].eq("Náklady"), "Hodnota"].iloc[0]
    assert "€" in cost
