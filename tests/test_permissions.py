from __future__ import annotations

import sqlite3

import pytest

from logbook_core.permissions import AccessDenied, owns_record, require_owned_record, strict_user_id
from logbook_core.schema import SCHEMA
from logbook_core.auth import ensure_auth_schema, register_user
from logbook_core.tenancy import ensure_tenancy_schema


def make_db() -> sqlite3.Connection:
    con = sqlite3.connect(":memory:")
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    ensure_tenancy_schema(con)
    ensure_auth_schema(con)
    second = register_user(con, email="pilot2@example.com", display_name="Pilot 2", password="strongpass456")
    assert second.ok and second.user_id
    con.execute("INSERT INTO flights (user_id, date, registration) VALUES (1, '2026-08-20', 'OK-AAA')")
    con.execute("INSERT INTO flights (user_id, date, registration) VALUES (?, '2026-08-20', 'OK-BBB')", (second.user_id,))
    con.commit()
    return con


def test_invalid_user_id_never_falls_back_to_owner() -> None:
    for value in (None, 0, -1, "", "x"):
        with pytest.raises(AccessDenied):
            strict_user_id(value)
    assert strict_user_id(1) == 1
    assert strict_user_id("2") == 2


def test_record_ownership_is_enforced() -> None:
    con = make_db()
    first_id = int(con.execute("SELECT id FROM flights WHERE user_id=1").fetchone()[0])
    second = con.execute("SELECT id, user_id FROM flights WHERE user_id<>1").fetchone()
    second_id, second_uid = int(second[0]), int(second[1])

    assert owns_record(con, "flights", first_id, 1)
    assert not owns_record(con, "flights", first_id, second_uid)
    assert owns_record(con, "flights", second_id, second_uid)
    with pytest.raises(AccessDenied):
        require_owned_record(con, "flights", first_id, second_uid)


def test_unknown_owned_table_is_rejected() -> None:
    con = make_db()
    with pytest.raises(ValueError):
        owns_record(con, "users", 1, 1)


def test_auth_helpers_do_not_fallback_to_owner_on_invalid_id() -> None:
    from logbook_core.auth import change_password
    con = make_db()
    with pytest.raises(AccessDenied):
        change_password(con, user_id=0, current_password="anything", new_password="strongpass999")


def test_runtime_scoped_readers_require_explicit_user_id() -> None:
    from pathlib import Path
    source = (Path(__file__).resolve().parents[1] / "app.py").read_text(encoding="utf-8")
    for name in (
        "read_flights", "read_rates", "read_tracks_joined", "read_tracks_for_flight",
        "read_aircraft_usage_summary", "read_airport_registry_count", "airport_search_index",
    ):
        assert f"def {name}(user_id: int = DEFAULT_USER_ID" not in source
    assert "def render_auth_sidebar" not in source
