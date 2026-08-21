from __future__ import annotations

from pathlib import Path

import pytest

from logbook_core.config import APP_VERSION, DB_SCHEMA_VERSION
from logbook_core.database_foundation import PostgresTargetConfig
import logbook_core.db_runtime as db_runtime
from logbook_core.runtime_metrics import reset_runtime_performance_metrics, runtime_performance_snapshot

ROOT = Path(__file__).resolve().parents[1]


class FakeCursor:
    def __init__(self, rowcount=1, rows=None):
        self.rowcount = rowcount
        self.description = None
        self._rows = list(rows or [])

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return list(self._rows)

    def fetchmany(self, size=None):
        n = 1 if size is None else size
        out = self._rows[:n]
        self._rows = self._rows[n:]
        return out

    def __iter__(self):
        return iter(self._rows)

    def close(self):
        pass


class FakeConnection:
    def __init__(self):
        self.autocommit = False
        self.commit_count = 0
        self.rollback_count = 0
        self.closed = False
        self.sql = []

    def execute(self, sql, params=()):
        self.sql.append((sql, params, self.autocommit))
        if str(sql).lstrip().upper().startswith("SELECT"):
            return FakeCursor(rowcount=1, rows=[{"n": 1}])
        return FakeCursor(rowcount=1)

    def cursor(self):
        return FakeCursor(rowcount=1)

    def commit(self):
        self.commit_count += 1

    def rollback(self):
        self.rollback_count += 1

    def close(self):
        self.closed = True


class FakePool:
    def __init__(self, connection):
        self.connection = connection
        self.get_count = 0
        self.put_count = 0

    def getconn(self, timeout=None):
        self.get_count += 1
        return self.connection

    def putconn(self, connection):
        assert connection is self.connection
        self.put_count += 1


def _config():
    return PostgresTargetConfig(
        dsn="postgresql://example.invalid/db",
        min_pool_size=0,
        max_pool_size=4,
        connect_timeout_s=5,
    )


def test_v073_version_without_sqlite_schema_change():
    assert APP_VERSION == "v0.73.3.2"
    assert DB_SCHEMA_VERSION == 11


def test_read_only_adapter_avoids_commit_and_rollback_roundtrips(monkeypatch):
    fake = FakeConnection()
    pool = FakePool(fake)
    monkeypatch.setattr(db_runtime, "get_postgres_pool", lambda config: pool)

    with db_runtime.PostgresConnectionAdapter(_config(), read_only=True) as con:
        assert fake.autocommit is True
        row = con.execute("SELECT 1 AS n").fetchone()
        assert row["n"] == 1

    assert fake.autocommit is False
    assert fake.commit_count == 0
    assert fake.rollback_count == 0
    assert pool.get_count == 1
    assert pool.put_count == 1


def test_read_only_adapter_rejects_write_sql(monkeypatch):
    fake = FakeConnection()
    pool = FakePool(fake)
    monkeypatch.setattr(db_runtime, "get_postgres_pool", lambda config: pool)
    with db_runtime.PostgresConnectionAdapter(_config(), read_only=True) as con:
        with pytest.raises(db_runtime.PostgresDatabaseError):
            con.execute("UPDATE flights SET note='x' WHERE id=1")


def test_transaction_adapter_does_not_double_commit(monkeypatch):
    fake = FakeConnection()
    pool = FakePool(fake)
    monkeypatch.setattr(db_runtime, "get_postgres_pool", lambda config: pool)
    with db_runtime.PostgresConnectionAdapter(_config()) as con:
        con.execute("UPDATE flights SET note=? WHERE id=?", ("x", 1))
        con.commit()
    assert fake.commit_count == 1
    assert fake.rollback_count == 0


def test_transaction_adapter_cleans_pure_select_with_rollback(monkeypatch):
    fake = FakeConnection()
    pool = FakePool(fake)
    monkeypatch.setattr(db_runtime, "get_postgres_pool", lambda config: pool)
    with db_runtime.PostgresConnectionAdapter(_config()) as con:
        con.execute("SELECT 1 AS n")
    assert fake.commit_count == 0
    assert fake.rollback_count == 1


def test_runtime_query_metrics_store_tags_not_sql_parameters(monkeypatch):
    reset_runtime_performance_metrics()
    fake = FakeConnection()
    pool = FakePool(fake)
    monkeypatch.setattr(db_runtime, "get_postgres_pool", lambda config: pool)
    secret_value = "super-secret-note-value"
    with db_runtime.PostgresConnectionAdapter(_config(), read_only=True) as con:
        con.execute("SELECT * FROM flights WHERE note=?", (secret_value,)).fetchall()
    snapshot = runtime_performance_snapshot(window_seconds=900)
    assert snapshot["query"]["count"] >= 1
    serialized = repr(snapshot)
    assert secret_value not in serialized
    assert "SELECT flights" in serialized


def test_app_read_helpers_use_read_connect_and_page_timing():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert "def read_connect() -> Any:" in source
    for function in (
        "read_user_profile",
        "read_flights",
        "read_logbook_counts",
        "read_track_metadata_for_flights",
        "read_sampled_track_points",
        "read_admin_user_overview",
        "read_permission_health",
    ):
        start = source.index(f"def {function}")
        next_def = source.find("\ndef ", start + 5)
        block = source[start: next_def if next_def >= 0 else None]
        assert "read_connect()" in block, function
    assert "record_page_event(" in source
    assert "page_render_started = time_module.perf_counter()" in source


def test_postgres_admin_ui_is_extracted_from_monolith():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    admin = (ROOT / "logbook_ui" / "postgres_admin.py").read_text(encoding="utf-8")
    assert "from logbook_ui.postgres_admin import render_postgres_admin_panel" in source
    assert "render_postgres_admin_panel()" in source
    assert "VYTVOŘIT SHADOW" not in source
    assert "VYTVOŘIT SHADOW" in admin
    assert "Runtime performance" in admin
    assert "Načíst velikosti a indexy" in admin


def test_accidental_tenant_cache_and_ui_cache_are_removed():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    airport_start = source.index("def airport_coord(")
    preceding = source[max(0, airport_start - 100):airport_start]
    assert "@st.cache_data" not in preceding
    render_start = source.index("def render_map_html(")
    preceding = source[max(0, render_start - 100):render_start]
    assert "@st.cache_data" not in preceding
    clean_start = source.index("def _clean_ident(")
    preceding = source[max(0, clean_start - 100):clean_start]
    assert "@st.cache_data" not in preceding


def test_database_header_counts_are_one_sql_statement():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    start = source.index("def read_logbook_counts(")
    end = source.index("def _clean_ident", start)
    block = source[start:end]
    assert block.count("con.execute(") == 1
    assert "SELECT COUNT(*) FROM flights" in block
    assert "SELECT COUNT(*) FROM aircraft" in block
    assert "SELECT COUNT(*) FROM flight_tracks" in block
    assert "SELECT COUNT(*) FROM track_points" in block


def test_postgres_diagnostics_are_batched_and_lazy():
    runtime = (ROOT / "logbook_core" / "postgres_runtime.py").read_text(encoding="utf-8")
    admin = (ROOT / "logbook_ui" / "postgres_admin.py").read_text(encoding="utf-8")
    assert '" UNION ALL ".join(selects)' in runtime
    assert "def postgres_relation_stats" in runtime
    assert "Načíst počty tabulek" in admin
    assert "Načíst velikosti a indexy" in admin


def test_profile_does_not_issue_separate_flight_count_query():
    source = (ROOT / "app.py").read_text(encoding="utf-8")
    assert "def read_table_count(" not in source
    start = source.index("def page_profile(")
    end = source.index("def render_sidebar_toggle", start)
    block = source[start:end]
    assert "flights_count = int(len(df))" in block
    assert "read_table_count(" not in block


def test_admin_overview_is_short_cached_and_invalidated_on_data_mutation():
    import ast

    source = (ROOT / "app.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    node = next(
        item for item in tree.body
        if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef))
        and item.name == "read_admin_user_overview"
    )
    decorators = [
        ast.get_source_segment(source, decorator) or ""
        for decorator in node.decorator_list
    ]
    normalized = [decorator.replace(" ", "") for decorator in decorators]
    assert any("st.cache_data" in decorator and "ttl=30" in decorator for decorator in normalized)

    invalidate_start = source.index("def invalidate_cached_data(")
    invalidate_end = source.index("def require_admin", invalidate_start)
    invalidate = source[invalidate_start:invalidate_end]
    assert '_clear_cached_function("read_admin_user_overview")' in invalidate
