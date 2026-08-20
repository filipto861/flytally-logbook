from pathlib import Path

import pytest

from logbook_core.postgres_migration import (
    PostgresMigrationError,
    _assert_refreshable_shadow,
)
from logbook_core.shadow_verification import FINGERPRINT_COLUMNS

ROOT = Path(__file__).resolve().parents[1]


class FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def fetchall(self):
        return self._rows


class FakeConnection:
    def __init__(self, meta):
        self.meta = dict(meta)
        self.executed = []

    def execute(self, sql, params=None):
        self.executed.append((sql, params))
        rows = [
            {"key": key, "value": value}
            for key, value in self.meta.items()
            if key in {
                "shadow_mode",
                "shadow_protocol_version",
                "production_mode",
                "production_cutover_at",
            }
        ]
        return FakeResult(rows)


def test_refresh_requires_recognized_shadow_target():
    con = FakeConnection({})
    with pytest.raises(PostgresMigrationError):
        _assert_refreshable_shadow(con)

    con = FakeConnection({
        "shadow_mode": "1",
        "shadow_protocol_version": "999",
    })
    with pytest.raises(PostgresMigrationError):
        _assert_refreshable_shadow(con)


def test_refresh_rejects_any_production_target_before_delete():
    for meta in (
        {
            "shadow_mode": "1",
            "shadow_protocol_version": "1",
            "production_mode": "1",
        },
        {
            "shadow_mode": "1",
            "shadow_protocol_version": "1",
            "production_cutover_at": "2026-08-20T19:00:00+00:00",
        },
    ):
        con = FakeConnection(meta)
        with pytest.raises(PostgresMigrationError):
            _assert_refreshable_shadow(con)
        assert all("DELETE FROM" not in sql.upper() for sql, _ in con.executed)


def test_refresh_accepts_only_nonproduction_shadow():
    con = FakeConnection({
        "shadow_mode": "1",
        "shadow_protocol_version": "1",
        "production_mode": "",
        "production_cutover_at": "",
    })
    _assert_refreshable_shadow(con)


def test_refresh_is_transactional_and_revalidates_after_copy():
    source = (ROOT / "logbook_core" / "postgres_migration.py").read_text(encoding="utf-8")
    start = source.index("def refresh_sqlite_to_postgres_shadow(")
    end = source.index("def postgres_tenant_checks(", start)
    block = source[start:end]
    assert "with pg_con.transaction():" in block
    assert "_assert_refreshable_shadow(pg_con)" in block
    assert "_delete_shadow_rows(pg_con)" in block
    assert "_assert_empty_target(pg_con)" in block
    assert "_reset_postgres_sequences(pg_con)" in block
    assert "postgres_tenant_checks(pg_con)" in block


def test_deep_cutover_fingerprint_ignores_only_volatile_last_login():
    credential_columns = FINGERPRINT_COLUMNS["user_credentials"]
    assert "user_id" in credential_columns
    assert "password_hash" in credential_columns
    assert "created_at" in credential_columns
    assert "updated_at" in credential_columns
    assert "last_login_at" not in credential_columns
