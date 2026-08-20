from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from logbook_core.config import DB_PATH
from logbook_core.database_foundation import redact_postgres_dsn
from logbook_core.postgres_migration import (
    PostgresMigrationError,
    build_sqlite_migration_plan,
    migrate_sqlite_to_postgres,
)


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Safe Logbook SQLite -> PostgreSQL migration (v0.70 foundation)."
    )
    p.add_argument("--sqlite", default=str(DB_PATH), help="Source SQLite database.")
    p.add_argument(
        "--dsn",
        default=os.getenv("LOGBOOK_POSTGRES_DSN") or os.getenv("DATABASE_URL") or "",
        help="PostgreSQL DSN. Prefer LOGBOOK_POSTGRES_DSN env instead of shell history.",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Inspect SQLite and print a migration plan; never connects to PostgreSQL.",
    )
    p.add_argument("--batch-size", type=int, default=1000)
    p.add_argument(
        "--confirm",
        default="",
        help='Migration requires exactly --confirm MIGRATE.',
    )
    return p


def main() -> int:
    args = parser().parse_args()
    source = Path(args.sqlite)
    plan = build_sqlite_migration_plan(source)

    if args.dry_run:
        print(json.dumps(plan.as_dict(), ensure_ascii=False, indent=2))
        return 0

    if args.confirm != "MIGRATE":
        print("Refusing migration: add --confirm MIGRATE after reviewing --dry-run.", file=sys.stderr)
        return 2
    if not str(args.dsn or "").strip():
        print("Missing PostgreSQL DSN. Set LOGBOOK_POSTGRES_DSN.", file=sys.stderr)
        return 2

    print("Source:", source)
    print("Target:", redact_postgres_dsn(args.dsn))
    print("Rows:", plan.total_rows)
    print("Target must be empty. No PostgreSQL rows will be deleted.")

    last_table = None
    def progress(table: str, copied: int, total: int) -> None:
        nonlocal last_table
        if table != last_table or copied == total:
            print(f"{table}: {copied}/{total}")
        last_table = table

    try:
        report = migrate_sqlite_to_postgres(
            source,
            args.dsn,
            batch_size=max(10, int(args.batch_size)),
            progress=progress,
        )
    except PostgresMigrationError as exc:
        print(f"Migration failed: {exc}", file=sys.stderr)
        return 1

    print(json.dumps(report.as_dict(), ensure_ascii=False, indent=2))
    print("Migration completed. Runtime cutover is intentionally NOT enabled in v0.70.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
