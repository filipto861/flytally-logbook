from pathlib import Path
import sqlite3

from logbook_core.config import APP_VERSION, DB_SCHEMA_VERSION, NAV_ITEMS
from logbook_core.permissions import owns_record
from logbook_core.schema import SCHEMA
from logbook_core.tenancy import USER_SCOPED_TABLES, ensure_tenancy_schema

ROOT = Path(__file__).resolve().parents[1]


def test_version_and_navigation():
    assert APP_VERSION == "v0.67"
    assert DB_SCHEMA_VERSION == 9
    assert ("Recency", "Recency") not in NAV_ITEMS


def test_user_expiries_is_tenant_scoped_and_owned():
    assert "user_expiries" in USER_SCOPED_TABLES
    con = sqlite3.connect(":memory:")
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    ensure_tenancy_schema(con)
    con.execute("INSERT INTO users (id, display_name, slug, active) VALUES (2, 'Pilot 2', 'pilot2', 1)")
    cur1 = con.execute("INSERT INTO user_expiries (user_id, label, expiry_date) VALUES (1, 'Medical', '2027-01-01')")
    cur2 = con.execute("INSERT INTO user_expiries (user_id, label, expiry_date) VALUES (2, 'SEP', '2027-02-01')")
    assert owns_record(con, "user_expiries", cur1.lastrowid, 1)
    assert not owns_record(con, "user_expiries", cur1.lastrowid, 2)
    assert owns_record(con, "user_expiries", cur2.lastrowid, 2)


def test_recency_page_and_crud_are_wired():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert "def _render_profile_validity_tab(df: pd.DataFrame)" in source
    assert 'elif page == "Recency":' in source
    assert 'read_table("user_expiries", uid)' in source
    assert "def save_user_expiry(" in source
    assert "def delete_user_expiry(" in source
    assert 'require_owned_record(con, "user_expiries"' in source


def test_schema_contains_user_expiries_and_index():
    assert "CREATE TABLE IF NOT EXISTS user_expiries" in SCHEMA
    assert "idx_user_expiries_user_expiry" in SCHEMA


def test_recency_page_is_explicitly_informational():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert "ne právní rozhodnutí" in source
    assert "den/noc" in source
