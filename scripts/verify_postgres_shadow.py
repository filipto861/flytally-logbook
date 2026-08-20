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
from logbook_core.database_foundation import postgres_target_config, redact_postgres_dsn
from logbook_core.shadow_verification import verify_postgres_shadow


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Compare production SQLite with a PostgreSQL shadow copy."
    )
    p.add_argument("--sqlite", default=str(DB_PATH))
    p.add_argument(
        "--dsn",
        default=os.getenv("LOGBOOK_POSTGRES_DSN") or os.getenv("DATABASE_URL") or "",
    )
    p.add_argument(
        "--deep",
        action="store_true",
        help="Hash canonical contents of every migrated table.",
    )
    return p


def main() -> int:
    args = parser().parse_args()
    config = postgres_target_config(
        secrets_database={"postgres_dsn": args.dsn},
        environ={},
    )
    if not config.configured:
        print("Missing PostgreSQL DSN.", file=sys.stderr)
        return 2

    print("SQLite:", Path(args.sqlite))
    print("PostgreSQL:", redact_postgres_dsn(config.dsn))
    report = verify_postgres_shadow(args.sqlite, config, deep=bool(args.deep))
    print(json.dumps(report.as_dict(), ensure_ascii=False, indent=2))
    return 0 if report.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
