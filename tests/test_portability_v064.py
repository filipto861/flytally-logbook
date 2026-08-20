import io
import json
import sqlite3
import zipfile

import pytest

from logbook_core.portability import (
    BACKUP_FORMAT,
    BACKUP_FORMAT_VERSION,
    BackupError,
    build_user_backup,
    inspect_user_backup,
    restore_user_backup,
)
from logbook_core.schema import SCHEMA


def _db():
    con = sqlite3.connect(":memory:")
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    con.execute(
        "INSERT INTO users (id,email,display_name,slug,role,active) VALUES (1,'one@example.com','One','one','admin',1)"
    )
    con.execute(
        "INSERT INTO users (id,email,display_name,slug,role,active) VALUES (2,'two@example.com','Two','two','user',1)"
    )
    con.execute(
        "INSERT INTO user_credentials (user_id,password_hash) VALUES (1,'secret-hash-one')"
    )
    con.execute(
        "INSERT INTO user_credentials (user_id,password_hash) VALUES (2,'secret-hash-two')"
    )
    con.execute(
        "INSERT INTO user_settings (user_id,timezone,currency,home_airport,default_role,preferences_json) VALUES (1,'Europe/Prague','CZK','LKVO','PIC','{\"default_evidence\":\"ULL\"}')"
    )
    con.execute(
        "INSERT INTO user_settings (user_id,timezone,currency,home_airport,default_role,preferences_json) VALUES (2,'UTC','EUR','EDDF','DUAL','{}')"
    )

    con.execute(
        "INSERT INTO aircraft (id,user_id,registration,aircraft_type,evidence,active) VALUES (11,1,'OK-ONE','Bristell','ULL',1)"
    )
    con.execute(
        "INSERT INTO rates (id,user_id,registration,valid_from,price_per_hour) VALUES (12,1,'OK-ONE','2026-01-01',2500)"
    )
    con.execute(
        "INSERT INTO airports (id,user_id,ident,name,latitude_deg,longitude_deg,active) VALUES (13,1,'TEST1','Private One',50.1,14.1,1)"
    )
    con.execute(
        "INSERT INTO user_expiries (id,user_id,category,label,expiry_date,warning_days,active) VALUES (14,1,'Medical','Class 2','2027-01-01',30,1)"
    )
    con.execute(
        """
        INSERT INTO flights
          (id,user_id,date,evidence,registration,aircraft_type,aircraft_class,departure,arrival,
           off_block,takeoff,landing,on_block,starts,commander,role,price_per_hour,billing_basis,note)
        VALUES
          (21,1,'2026-08-01','ULL','OK-ONE','Bristell','ULL','LKVO','TEST1',
           '10:00','10:05','10:55','11:00',1,'Pilot One','PIC',2500,'BLOCK','portable')
        """
    )
    con.execute(
        """
        INSERT INTO flight_tracks
          (id,user_id,flight_id,file_name,point_count,distance_km,coordinates_json)
        VALUES (31,1,21,'one.kml',2,100.0,'[[50.0,14.0],[50.1,14.1]]')
        """
    )
    con.execute(
        """
        INSERT INTO track_points
          (id,user_id,track_id,seq,time_utc,latitude_deg,longitude_deg,altitude_m)
        VALUES (41,1,31,0,'2026-08-01T08:05:00Z',50.0,14.0,300.0)
        """
    )
    con.execute(
        """
        INSERT INTO track_points
          (id,user_id,track_id,seq,time_utc,latitude_deg,longitude_deg,altitude_m)
        VALUES (42,1,31,1,'2026-08-01T08:55:00Z',50.1,14.1,320.0)
        """
    )

    # Existing user-two data must survive restore isolation checks.
    con.execute(
        "INSERT INTO aircraft (id,user_id,registration,aircraft_type,evidence,active) VALUES (111,2,'D-TWO','C172','EASA',1)"
    )
    con.execute(
        "INSERT INTO flights (id,user_id,date,evidence,registration,starts,role) VALUES (121,2,'2026-07-01','EASA','D-TWO',1,'PIC')"
    )
    con.commit()
    return con


def test_backup_contains_only_source_user_and_no_credentials():
    con = _db()
    raw = build_user_backup(con, 1, app_version="v0.68", schema_version=9)
    info = inspect_user_backup(raw)

    assert info["format"] == BACKUP_FORMAT
    assert info["format_version"] == BACKUP_FORMAT_VERSION
    assert info["counts"]["flights"] == 1
    assert info["counts"]["track_points"] == 2
    assert info["source_profile"]["email"] == "one@example.com"

    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        names = set(zf.namelist())
        assert {"manifest.json", "data.json", "README.txt"} <= names
        assert "csv/flights.csv" in names
        payload = json.loads(zf.read("data.json").decode("utf-8"))

    assert "user_credentials" not in payload["tables"]
    assert "audit_log" not in payload["tables"]
    joined = json.dumps(payload, ensure_ascii=False)
    assert "secret-hash-one" not in joined
    assert "secret-hash-two" not in joined
    assert "D-TWO" not in joined
    assert "two@example.com" not in joined


def test_restore_replaces_only_target_user_and_remaps_relations():
    source = _db()
    raw = build_user_backup(source, 1, app_version="v0.68", schema_version=9)

    target = _db()
    # Make target user 2 visibly different and give it extra rows that should be replaced.
    target.execute(
        "INSERT INTO user_expiries (user_id,category,label,expiry_date,warning_days,active) VALUES (2,'Other','Old','2026-01-01',1,1)"
    )
    target.commit()

    before_user1 = target.execute("SELECT COUNT(*) FROM flights WHERE user_id=1").fetchone()[0]
    identity_before = target.execute(
        "SELECT email,role FROM users WHERE id=2"
    ).fetchone()
    credential_before = target.execute(
        "SELECT password_hash FROM user_credentials WHERE user_id=2"
    ).fetchone()[0]

    summary = restore_user_backup(target, 2, raw)
    target.commit()

    assert summary["flights"] == 1
    assert summary["flight_tracks"] == 1
    assert summary["track_points"] == 2

    # User 1 is untouched.
    assert target.execute("SELECT COUNT(*) FROM flights WHERE user_id=1").fetchone()[0] == before_user1

    # User 2 now has source portable data under user_id 2.
    flight = target.execute(
        "SELECT id,registration,note FROM flights WHERE user_id=2"
    ).fetchone()
    assert flight["registration"] == "OK-ONE"
    assert flight["note"] == "portable"

    track = target.execute(
        "SELECT id,flight_id FROM flight_tracks WHERE user_id=2"
    ).fetchone()
    assert track["flight_id"] == flight["id"]

    points = target.execute(
        "SELECT track_id,seq FROM track_points WHERE user_id=2 ORDER BY seq"
    ).fetchall()
    assert len(points) == 2
    assert all(row["track_id"] == track["id"] for row in points)

    # Identity and authentication are explicitly outside restore scope.
    identity_after = target.execute(
        "SELECT email,role FROM users WHERE id=2"
    ).fetchone()
    credential_after = target.execute(
        "SELECT password_hash FROM user_credentials WHERE user_id=2"
    ).fetchone()[0]
    assert tuple(identity_after) == tuple(identity_before)
    assert credential_after == credential_before

    # Preferences are portable.
    settings = target.execute(
        "SELECT timezone,currency,home_airport,default_role FROM user_settings WHERE user_id=2"
    ).fetchone()
    assert tuple(settings) == ("Europe/Prague", "CZK", "LKVO", "PIC")


def test_invalid_archive_is_rejected_before_restore():
    con = _db()
    with pytest.raises(BackupError):
        inspect_user_backup(b"not-a-zip")
    with pytest.raises(BackupError):
        restore_user_backup(con, 1, b"not-a-zip")


def test_backup_with_missing_relation_is_atomic():
    con = _db()
    raw = build_user_backup(con, 1, app_version="v0.68", schema_version=9)

    with zipfile.ZipFile(io.BytesIO(raw), "r") as source_zip:
        manifest = source_zip.read("manifest.json")
        data = json.loads(source_zip.read("data.json").decode("utf-8"))

    data["tables"]["flights"] = []
    broken_buffer = io.BytesIO()
    with zipfile.ZipFile(broken_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", manifest)
        zf.writestr("data.json", json.dumps(data).encode("utf-8"))

    before = con.execute("SELECT COUNT(*) FROM flights WHERE user_id=1").fetchone()[0]
    with pytest.raises(BackupError):
        restore_user_backup(con, 1, broken_buffer.getvalue())
    after = con.execute("SELECT COUNT(*) FROM flights WHERE user_id=1").fetchone()[0]
    assert after == before
