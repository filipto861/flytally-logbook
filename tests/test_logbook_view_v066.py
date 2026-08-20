import pandas as pd

from logbook_core.logbook_view import flight_navigation, quick_search_flights


def _flights():
    return pd.DataFrame([
        {
            "id": 3,
            "date": "2026-08-20",
            "registration": "OK-CUG23",
            "departure": "LKKA",
            "arrival": "LKSZ",
            "role": "PIC",
            "note": "",
        },
        {
            "id": 2,
            "date": "2026-08-19",
            "registration": "OK-BIC",
            "departure": "LKPC",
            "arrival": "LKVO",
            "role": "PIC",
            "note": "evening",
        },
        {
            "id": 1,
            "date": "2026-08-18",
            "registration": "OK-EUI10",
            "departure": "LKVO",
            "arrival": "LKLT",
            "role": "DUAL",
            "note": None,
        },
    ])


def test_quick_search_is_literal_case_insensitive_and_cross_column():
    df = _flights()
    assert quick_search_flights(df, "cug23")["id"].tolist() == [3]
    assert quick_search_flights(df, "lkvo")["id"].tolist() == [2, 1]
    assert quick_search_flights(df, "EVENING")["id"].tolist() == [2]
    assert quick_search_flights(df, "")["id"].tolist() == [3, 2, 1]


def test_quick_search_treats_regex_characters_literally():
    df = _flights()
    assert quick_search_flights(df, ".*").empty


def test_navigation_follows_current_list_order():
    nav = flight_navigation([30, 20, 10], 20)
    assert nav == {
        "position": 2,
        "total": 3,
        "previous_id": 30,
        "next_id": 10,
    }


def test_navigation_handles_edges_and_missing_current():
    first = flight_navigation([30, 20, 10], 30)
    assert first["previous_id"] is None
    assert first["next_id"] == 20

    last = flight_navigation([30, 20, 10], 10)
    assert last["previous_id"] == 20
    assert last["next_id"] is None

    missing = flight_navigation([30, 20], 999)
    assert missing["position"] is None
    assert missing["total"] == 2
