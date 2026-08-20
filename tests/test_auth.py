from __future__ import annotations

import sqlite3

from logbook_core.auth import (
    activate_legacy_profile,
    authenticate_user,
    change_password,
    ensure_auth_schema,
    legacy_profile_needs_activation,
    register_user,
    verify_password,
)
from logbook_core.schema import SCHEMA
from logbook_core.tenancy import ensure_tenancy_schema


def make_db() -> sqlite3.Connection:
    con = sqlite3.connect(":memory:")
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    ensure_tenancy_schema(con)
    ensure_auth_schema(con)
    con.commit()
    return con


def test_legacy_activation_keeps_user_id_one():
    con = make_db()
    con.execute("INSERT INTO flights (user_id, date, departure, arrival) VALUES (1, '2026-08-20', 'LKVO', 'LKVO')")
    assert legacy_profile_needs_activation(con)
    result = activate_legacy_profile(con, email="filip@example.com", display_name="Filip", password="strongpass123")
    assert result.ok and result.user_id == 1
    owner = con.execute("SELECT user_id FROM flights").fetchone()[0]
    assert owner == 1
    assert not legacy_profile_needs_activation(con)


def test_login_and_password_change():
    con = make_db()
    activate_legacy_profile(con, email="filip@example.com", display_name="Filip", password="strongpass123")
    assert authenticate_user(con, "FILIP@example.com", "strongpass123").ok
    assert not authenticate_user(con, "filip@example.com", "wrongpass").ok
    changed = change_password(con, user_id=1, current_password="strongpass123", new_password="newstrongpass456")
    assert changed.ok
    assert authenticate_user(con, "filip@example.com", "newstrongpass456").ok
    assert not authenticate_user(con, "filip@example.com", "strongpass123").ok


def test_new_user_gets_separate_empty_account():
    con = make_db()
    activate_legacy_profile(con, email="filip@example.com", display_name="Filip", password="strongpass123")
    con.execute("INSERT INTO flights (user_id, date, departure, arrival) VALUES (1, '2026-08-20', 'LKVO', 'LKVO')")
    result = register_user(con, email="second@example.com", display_name="Second Pilot", password="strongpass456")
    assert result.ok and result.user_id and result.user_id != 1
    own_flights = con.execute("SELECT COUNT(*) FROM flights WHERE user_id = ?", (result.user_id,)).fetchone()[0]
    legacy_flights = con.execute("SELECT COUNT(*) FROM flights WHERE user_id = 1").fetchone()[0]
    assert own_flights == 0
    assert legacy_flights == 1


def test_password_is_hashed_not_plaintext():
    con = make_db()
    activate_legacy_profile(con, email="filip@example.com", display_name="Filip", password="strongpass123")
    encoded = con.execute("SELECT password_hash FROM user_credentials WHERE user_id = 1").fetchone()[0]
    assert "strongpass123" not in encoded
    assert encoded.startswith("scrypt$")
    assert verify_password("strongpass123", encoded)
