import pandas as pd

from logbook_core.data_quality import scan_data_quality


def _aircraft():
    return pd.DataFrame([
        {
            "registration": "OK-AAA",
            "aircraft_type": "Bristell B23",
            "aircraft_class": "ULL",
            "evidence": "ULL",
            "default_role": "PIC",
            "active": 1,
        },
        {
            "registration": "OK-BBB",
            "aircraft_type": "C172",
            "aircraft_class": "SEP",
            "evidence": "EASA",
            "default_role": "PIC",
            "active": 1,
        },
    ])


def _base_flights():
    return pd.DataFrame([
        {
            "id": 1, "date": "2026-08-20", "registration": "OK-AAA",
            "aircraft_type": "Bristell B23", "aircraft_class": "ULL",
            "evidence": "ULL", "departure": "LKVO", "arrival": "LKLT",
            "off_block": "10:00", "takeoff": "10:05", "landing": "10:55",
            "on_block": "11:00", "starts": 1, "role": "PIC",
        }
    ])


def _codes(scan):
    return [issue["code"] for issue in scan["issues"]]


def test_clean_flight_is_ok():
    scan = scan_data_quality(
        _base_flights(),
        _aircraft(),
        known_airports={"LKVO", "LKLT"},
        tracks=pd.DataFrame(),
    )
    assert scan["status"] == "ok"
    assert scan["counts"]["problem"] == 0
    assert scan["counts"]["warning"] == 0
    assert scan["safe_patches"] == {}


def test_missing_profile_fields_create_safe_fill_patch_without_overwrite():
    flights = _base_flights()
    flights.loc[0, "aircraft_type"] = None
    flights.loc[0, "aircraft_class"] = None
    flights.loc[0, "evidence"] = None
    flights.loc[0, "role"] = None

    scan = scan_data_quality(
        flights,
        _aircraft(),
        known_airports={"LKVO", "LKLT"},
    )
    assert scan["safe_patches"][1] == {
        "evidence": "ULL",
        "aircraft_class": "ULL",
        "aircraft_type": "Bristell B23",
        "role": "PIC",
    }
    assert "missing_evidence" in _codes(scan)
    assert "missing_role" in _codes(scan)
    assert "missing_aircraft_class" in _codes(scan)


def test_profile_mismatch_is_warning_not_safe_patch():
    flights = _base_flights()
    flights.loc[0, "evidence"] = "EASA"
    flights.loc[0, "aircraft_class"] = "SEP"
    flights.loc[0, "aircraft_type"] = "Other"

    scan = scan_data_quality(
        flights,
        _aircraft(),
        known_airports={"LKVO", "LKLT"},
    )
    codes = _codes(scan)
    assert "evidence_profile_mismatch" in codes
    assert "class_profile_mismatch" in codes
    assert "type_profile_mismatch" in codes
    assert scan["safe_patches"] == {}


def test_exact_duplicate_is_problem():
    flights = pd.concat([_base_flights(), _base_flights()], ignore_index=True)
    flights.loc[1, "id"] = 2
    scan = scan_data_quality(
        flights,
        _aircraft(),
        known_airports={"LKVO", "LKLT"},
    )
    exact = [i for i in scan["issues"] if i["code"] == "exact_duplicate"]
    assert len(exact) == 1
    assert exact[0]["flight_id"] == 2
    assert exact[0]["severity"] == "problem"
    assert scan["status"] == "problem"


def test_near_duplicate_is_warning():
    flights = pd.concat([_base_flights(), _base_flights()], ignore_index=True)
    flights.loc[1, "id"] = 2
    flights.loc[1, "off_block"] = "10:07"
    flights.loc[1, "takeoff"] = "10:12"
    flights.loc[1, "landing"] = "11:02"
    flights.loc[1, "on_block"] = "11:07"

    scan = scan_data_quality(
        flights,
        _aircraft(),
        known_airports={"LKVO", "LKLT"},
    )
    assert "near_duplicate" in _codes(scan)
    assert "exact_duplicate" not in _codes(scan)


def test_air_longer_than_block_is_problem():
    flights = _base_flights()
    flights.loc[0, "off_block"] = "10:00"
    flights.loc[0, "takeoff"] = "09:50"
    flights.loc[0, "landing"] = "11:00"
    flights.loc[0, "on_block"] = "10:30"

    scan = scan_data_quality(
        flights,
        _aircraft(),
        known_airports={"LKVO", "LKLT"},
    )
    assert "air_exceeds_block" in _codes(scan)


def test_unknown_airport_and_unconfigured_aircraft_are_warnings():
    flights = _base_flights()
    flights.loc[0, "registration"] = "OK-NOPE"
    flights.loc[0, "arrival"] = "ZZZZ"

    scan = scan_data_quality(
        flights,
        _aircraft(),
        known_airports={"LKVO"},
    )
    codes = _codes(scan)
    assert "aircraft_without_profile" in codes
    assert "unknown_arrival" in codes


def test_bad_track_metadata_is_detected():
    tracks = pd.DataFrame([
        {"id": 10, "flight_id": 1, "point_count": 1, "distance_km": 0.0},
        {"id": 11, "flight_id": 1, "point_count": 20, "distance_km": 0.0},
    ])
    scan = scan_data_quality(
        _base_flights(),
        _aircraft(),
        known_airports={"LKVO", "LKLT"},
        tracks=tracks,
    )
    codes = _codes(scan)
    assert "track_too_short" in codes
    assert "track_zero_distance" in codes
