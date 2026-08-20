from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Iterable

USER_ROLE = "user"
ADMIN_ROLE = "admin"
VALID_ROLES = frozenset({USER_ROLE, ADMIN_ROLE})

OWNED_TABLES = frozenset({
    "flights",
    "aircraft",
    "rates",
    "airports",
    "flight_tracks",
    "track_points",
    "audit_log",
    "user_expiries",
})


class AccessDenied(PermissionError):
    """Raised when a user attempts to access data outside their tenant scope."""


@dataclass(frozen=True)
class Principal:
    user_id: int
    role: str = USER_ROLE

    @property
    def is_admin(self) -> bool:
        return normalize_role(self.role) == ADMIN_ROLE


def strict_user_id(value: object) -> int:
    """Return a positive user ID without silently falling back to user #1.

    Multi-user code must never turn an unauthenticated/invalid ID into the legacy
    owner. Migration helpers may still use tenancy.normalize_user_id explicitly.
    """
    try:
        uid = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError) as exc:
        raise AccessDenied("Chybí platný přihlášený uživatel.") from exc
    if uid <= 0:
        raise AccessDenied("Chybí platný přihlášený uživatel.")
    return uid


def normalize_role(value: object) -> str:
    role = str(value or USER_ROLE).strip().lower()
    return role if role in VALID_ROLES else USER_ROLE


def require_admin_role(value: object) -> None:
    if normalize_role(value) != ADMIN_ROLE:
        raise AccessDenied("Tato akce je dostupná pouze správci aplikace.")


def _validate_owned_table(table: str) -> str:
    clean = str(table or "").strip()
    if clean not in OWNED_TABLES:
        raise ValueError(f"Tabulka {clean!r} není uživatelsky vlastněná tabulka.")
    return clean


def owns_record(
    con: sqlite3.Connection,
    table: str,
    record_id: object,
    user_id: object,
    *,
    id_column: str = "id",
) -> bool:
    clean_table = _validate_owned_table(table)
    uid = strict_user_id(user_id)
    if id_column not in {"id", "flight_id", "track_id"}:
        raise ValueError("Nepovolený identifikační sloupec.")
    try:
        rid = int(record_id)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return False
    row = con.execute(
        f"SELECT 1 FROM {clean_table} WHERE {id_column} = ? AND user_id = ? LIMIT 1",
        (rid, uid),
    ).fetchone()
    return bool(row)


def require_owned_record(
    con: sqlite3.Connection,
    table: str,
    record_id: object,
    user_id: object,
    *,
    id_column: str = "id",
) -> int:
    uid = strict_user_id(user_id)
    if not owns_record(con, table, record_id, uid, id_column=id_column):
        raise AccessDenied("Požadovaný záznam neexistuje nebo nepatří aktuálnímu profilu.")
    return uid


def owned_ids(
    con: sqlite3.Connection,
    table: str,
    ids: Iterable[object],
    user_id: object,
) -> set[int]:
    clean_table = _validate_owned_table(table)
    uid = strict_user_id(user_id)
    clean_ids: set[int] = set()
    for value in ids:
        try:
            rid = int(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            continue
        if rid > 0:
            clean_ids.add(rid)
    if not clean_ids:
        return set()
    placeholders = ",".join("?" for _ in clean_ids)
    rows = con.execute(
        f"SELECT id FROM {clean_table} WHERE user_id = ? AND id IN ({placeholders})",
        (uid, *sorted(clean_ids)),
    ).fetchall()
    return {int(row[0]) for row in rows}
