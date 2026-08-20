from datetime import date

import pandas as pd

from logbook_core.flight_entry import (
    frequent_destinations,
    latest_flight_context,
    manual_entry_defaults,
)


def _history():
    return pd.DataFrame([
        {
            "id": 1,
            "date": "2026-08-18",
            "off_block": "10:00",
            "registration": "OK-AAA",
            "departure": "LKVO",
            "arrival": "LKLT",
            "evidence": "ULL",
            "role": "PIC",
            "commander": "Pilot",
        },
        {
            "id": 2,
            "date": "2026-08-19",
            "off_block": "14:00",
            "registration": "OK-BBB",
            "departure": "LKLT",
            "arrival": "LKVO",
            "evidence": "EASA",
            "role": "PIC",
            "commander": "Pilot",
        },
        {
            "id": 3,
            "date": "2026-08-20",
            "off_block": "08:00",
            "registration": "OK-CCC",
            "departure": "LKVO",
            "arrival": "LKBE",
            "evidence": "ULL",
            "role": "DUAL",
            "commander": "Pilot",
        },
        {
            "id": 4,
            "date": "2026-08-17",
            "off_block": "09:00",
            "registration": "OK-AAA",
            "departure": "LKBE",
            "arrival": "LKVO",
            "evidence": "ULL",
            "role": "PIC",
            "commander": "Pilot",
        },
        {
            "id": 5,
            "date": "2026-08-16",
            "off_block": "09:00",
            "registration": "OK-AAA",
            "departure": "LKBE",
            "arrival": "LKVO",
            "evidence": "ULL",
            "role": "PIC",
            "commander": "Pilot",
        },
    ])


def test_latest_flight_context_uses_date_time_and_id():
    ctx = latest_flight_context(_history())
    assert ctx["id"] == 3
    assert ctx["registration"] == "OK-CCC"
    assert ctx["arrival"] == "LKBE"


def test_manual_defaults_continue_from_last_arrival_but_do_not_guess_destination_or_times():
    defaults, ctx = manual_entry_defaults(
        _history(),
        today=date(2026, 8, 20),
        home_airport="LKVO",
        default_evidence="ULL",
        default_role="PIC",
        commander="Filip",
    )
    assert ctx["id"] == 3
    assert defaults["departure"] == "LKBE"
    assert defaults["registration"] == "OK-CCC"
    assert defaults["arrival"] == ""
    assert "takeoff" not in defaults
    assert "landing" not in defaults
    assert defaults["role"] == "PIC"
    assert defaults["commander"] == "Filip"


def test_manual_defaults_fall_back_to_home_without_history():
    defaults, ctx = manual_entry_defaults(
        pd.DataFrame(),
        today=date(2026, 8, 20),
        home_airport="LKVO",
        default_evidence="EASA",
        default_role="PIC",
        commander="Pilot",
    )
    assert ctx == {}
    assert defaults["departure"] == "LKVO"
    assert defaults["registration"] == ""
    assert defaults["evidence"] == "EASA"


def test_frequent_destinations_are_departure_specific():
    destinations = frequent_destinations(_history(), "LKBE", limit=3)
    assert destinations[0] == ("LKVO", 2)
    assert all(destination != "LKBE" for destination, _count in destinations)
