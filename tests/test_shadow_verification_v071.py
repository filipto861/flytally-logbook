from pathlib import Path
import sqlite3

from logbook_core.schema import SCHEMA
from logbook_core.shadow_verification import (
    SHADOW_META_KEYS,
    _canonical_value,
    _compare_counts,
    _compare_metrics,
    _sqlite_counts,
    _sqlite_user_metrics,
)


def _db(tmp_path: Path) -> sqlite3.Connection:
    path = tmp_path / "shadow.sqlite"
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    con.execute("INSERT INTO app_meta(key,value,updated_at) VALUES('schema_version','10','x')")
    con.execute("INSERT INTO app_meta(key,value,updated_at) VALUES('last_change_at','2026-08-20T18:00:00+00:00','x')")
    con.execute(
        "INSERT INTO users(id,email,display_name,slug,role,active) VALUES(1,'a@b.cz','Pilot','pilot','admin',1)"
    )
    con.execute(
        "INSERT INTO flights(id,user_id,date,evidence,registration,off_block,takeoff,landing,on_block,starts,role) "
        "VALUES(1,1,'2026-08-20','ULL','OK-AAA','10:00','10:05','11:00','11:05',2,'PIC')"
    )
    con.execute(
        "INSERT INTO flight_tracks(id,user_id,flight_id,file_name,coordinates_json) VALUES(1,1,1,'x.kml','[]')"
    )
    con.execute(
        "INSERT INTO track_points(id,user_id,track_id,seq,latitude_deg,longitude_deg) VALUES(1,1,1,0,50.0,14.0)"
    )
    con.commit()
    return con


def test_quick_metrics_match_logbook_semantics(tmp_path):
    con = _db(tmp_path)
    try:
        metrics = _sqlite_user_metrics(con)
    finally:
        con.close()
    one = metrics["1"]
    assert one["flights"] == 1
    assert one["starts"] == 2
    assert one["block_minutes"] == 65
    assert one["air_minutes"] == 55
    assert one["pic_minutes"] == 65
    assert one["pic_ull_minutes"] == 65
    assert one["tracks"] == 1
    assert one["gps_points"] == 1


def test_shadow_meta_keys_are_excluded_from_normalized_app_meta_count(tmp_path):
    con = _db(tmp_path)
    try:
        base_count = _sqlite_counts(con)["app_meta"]
        for key in SHADOW_META_KEYS:
            con.execute(
                "INSERT OR REPLACE INTO app_meta(key,value,updated_at) VALUES(?,?,?)",
                (key, "x", "now"),
            )
        con.commit()
        shadow_count = _sqlite_counts(con)["app_meta"]
    finally:
        con.close()
    assert shadow_count == base_count


def test_compare_helpers_report_only_real_differences():
    assert _compare_counts({"flights": 2}, {"flights": 2}) == {}
    assert _compare_counts({"flights": 2}, {"flights": 3})["flights"] == {
        "sqlite": 2,
        "postgresql": 3,
    }

    left = {"1": {"flights": 2, "starts": 3}}
    right = {"1": {"flights": 2, "starts": 4}}
    diff = _compare_metrics(left, right)
    assert diff["1"]["starts"] == {"sqlite": 3, "postgresql": 4}
    assert "flights" not in diff["1"]


def test_canonical_float_normalization_is_stable():
    assert _canonical_value(1.23456789012349) == _canonical_value(1.23456789012341)
    assert _canonical_value(float("nan")) is None
