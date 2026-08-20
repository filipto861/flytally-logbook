from __future__ import annotations

from pathlib import Path
from zoneinfo import ZoneInfo

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "logbook.sqlite"
AIRPORT_OVERRIDES_PATH = DATA_DIR / "airport_overrides.csv"
AIRPORTS_CSV_PATH = DATA_DIR / "airports.csv"
AIRPORTS_DB_PATH = DATA_DIR / "airports_full.sqlite"
OURAIRPORTS_AIRPORTS_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv"
APP_VERSION = "v0.62.1"
LOCAL_TZ = ZoneInfo("Europe/Prague")
DB_SCHEMA_VERSION = 8

EVIDENCE_OPTIONS = ["ULL", "EASA"]
CLASS_OPTIONS = ["ULL", "SEP", "TMG", "MEP", "SET", "OTHER", "GLIDER"]
ROLE_OPTIONS = ["PIC", "DUAL", "INSTRUKTOR", "SAFETY PILOT", "CO-PILOT", "PAX", "OBSERVER"]
BILLING_BASIS_OPTIONS = ["BLOCK", "AIR"]

NAV_ITEMS = [
    ("Dashboard", "Souhrn"),
    ("Lety", "Lety"),
    ("Nový let", "Přidat let"),
    ("Mapa", "Mapa"),
    ("Databáze", "Databáze"),
    ("Export", "Export"),
    ("Profil", "Profil"),
]
