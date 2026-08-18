"""Import airport database into data/logbook.sqlite.

Usage:
    python scripts/import_airports.py --ourairports
    python scripts/import_airports.py --csv data/airport_overrides.csv --source manual_override
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import pandas as pd  # noqa: E402
import app  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ourairports", action="store_true", help="Download and import OurAirports airports.csv")
    parser.add_argument("--csv", type=Path, help="Import custom airport CSV")
    parser.add_argument("--source", default="user_csv", help="Source label for custom CSV")
    args = parser.parse_args()

    if args.ourairports:
        count = app.import_ourairports_to_database()
        print(f"Imported OurAirports rows: {count}")
    if args.csv:
        df = pd.read_csv(args.csv)
        with app.connect() as con:
            count = app.import_airports_dataframe(con, df, default_source=args.source, replace_existing=True)
            con.commit()
        print(f"Imported CSV rows: {count}")
    if not args.ourairports and not args.csv:
        parser.print_help()


if __name__ == "__main__":
    main()
