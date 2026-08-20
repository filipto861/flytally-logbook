from pathlib import Path
import sqlite3

import pytest

from logbook_core.postgres_migration import (
    MIGRATION_FORMAT,
    PostgresMigrationError,
    build_sqlite_migration_plan,
    migration_plan_json,
)
from logbook_core.postgres_schema import POSTGRES_TABLE_ORDER
from logbook_core.schema import SCHEMA


def _source_db(tmp_path: Path) -> Path:
    path = tmp_path / "source.sqlite"
    con = sqlite3.connect(path)
    try:
        con.executescript(SCHEMA)
        con.execute(
            "INSERT INTO app_meta(key,value,updated_at) VALUES('schema_version','10','now')"
        )
        con.execute(
            "INSERT INTO users(id,email,display_name,slug,role,active) VALUES(1,'a@example.com','Pilot','pilot','admin',1)"
        )
        con.execute(
            "INSERT INTO user_settings(user_id,timezone,currency,default_role) VALUES(1,'Europe/Prague','CZK','PIC')"
        )
        con.execute(
            "INSERT INTO flights(id,user_id,date,evidence,registration,departure,arrival,starts,role) VALUES(7,1,'2026-08-20','ULL','OK-AAA','LKVO','LKLT',1,'PIC')"
        )
        con.commit()
    finally:
        con.close()
    return path


def test_migration_plan_reads_all_tables_and_preserves_schema_version(tmp_path):
    path = _source_db(tmp_path)
    plan = build_sqlite_migration_plan(path)
    assert plan.format == MIGRATION_FORMAT
    assert plan.sqlite_schema_version == 10
    assert plan.table_counts["users"] == 1
    assert plan.table_counts["flights"] == 1
    assert set(plan.table_counts) == set(POSTGRES_TABLE_ORDER)
    assert plan.world_airports_migrated is False
    assert b'"sqlite_schema_version": 10' in migration_plan_json(plan)


def test_migration_plan_rejects_incomplete_sqlite(tmp_path):
    path = tmp_path / "bad.sqlite"
    sqlite3.connect(path).close()
    with pytest.raises(PostgresMigrationError):
        build_sqlite_migration_plan(path)
