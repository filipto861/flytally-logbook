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
    admin_set_user_password,
    set_user_active,
    set_user_role,
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


def test_owner_is_admin_and_new_profile_is_user():
    con = make_db()
    owner_role = con.execute("SELECT role FROM users WHERE id = 1").fetchone()[0]
    assert owner_role == "admin"
    activate_legacy_profile(con, email="owner@example.com", display_name="Owner", password="strongpass123")
    result = register_user(con, email="pilot@example.com", display_name="Pilot", password="strongpass456")
    assert result.ok and result.user_id
    role = con.execute("SELECT role FROM users WHERE id = ?", (result.user_id,)).fetchone()[0]
    assert role == "user"


def test_admin_can_manage_test_user_without_touching_owner():
    con = make_db()
    activate_legacy_profile(con, email="owner@example.com", display_name="Owner", password="strongpass123")
    result = register_user(con, email="pilot@example.com", display_name="Pilot", password="strongpass456")
    uid = int(result.user_id)
    assert set_user_active(con, user_id=uid, active=False).ok
    assert not authenticate_user(con, "pilot@example.com", "strongpass456").ok
    assert set_user_active(con, user_id=uid, active=True).ok
    assert set_user_role(con, user_id=uid, role="admin").ok
    assert con.execute("SELECT role FROM users WHERE id = ?", (uid,)).fetchone()[0] == "admin"
    assert admin_set_user_password(con, user_id=uid, new_password="anotherstrong789").ok
    assert authenticate_user(con, "pilot@example.com", "anotherstrong789").ok
    assert not set_user_active(con, user_id=1, active=False).ok
    assert not set_user_role(con, user_id=1, role="user").ok


def test_role_migration_promotes_existing_owner_only():
    con = sqlite3.connect(":memory:")
    con.row_factory = sqlite3.Row
    con.executescript("""
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, display_name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE, active INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT
        );
        INSERT INTO users (id, email, display_name, slug, active) VALUES (1, 'owner@example.com', 'Owner', 'local', 1);
        INSERT INTO users (id, email, display_name, slug, active) VALUES (2, 'pilot@example.com', 'Pilot', 'pilot', 1);
    """)
    ensure_auth_schema(con)
    roles = dict(con.execute("SELECT id, role FROM users ORDER BY id").fetchall())
    assert roles == {1: "admin", 2: "user"}
