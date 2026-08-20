from __future__ import annotations

from dataclasses import asdict, dataclass
from decimal import Decimal
import hashlib
import json
import math
from pathlib import Path
import sqlite3
import statistics
import tempfile
import time
from typing import Any, Iterable

from .database_foundation import PostgresTargetConfig
from .metrics import minutes_diff
from .postgres_runtime import postgres_connection
from .postgres_schema import POSTGRES_TABLE_COLUMNS, POSTGRES_TABLE_ORDER
from .sqlite_runtime import snapshot_sqlite_bytes


POSTGRES_SHADOW_PROTOCOL_VERSION = 1

# Target-only metadata added by migration tooling. These values describe the
# PostgreSQL shadow itself and therefore intentionally do not exist in SQLite.
SHADOW_META_KEYS = frozenset({
    "storage_backend",
    "postgres_foundation_schema",
    "shadow_mode",
    "shadow_migrated_at",
    "shadow_source_schema_version",
    "shadow_protocol_version",
})

TABLE_ORDER_KEYS: dict[str, tuple[str, ...]] = {
    "app_meta": ("key",),
    "users": ("id",),
    "user_credentials": ("user_id",),
    "user_settings": ("user_id",),
    "user_expiries": ("id",),
    "flights": ("id",),
    "aircraft": ("id",),
    "rates": ("id",),
    "airports": ("id",),
    "flight_tracks": ("id",),
    "track_points": ("id",),
    "audit_log": ("id",),
}

FLIGHT_SHADOW_COLUMNS = (
    "id", "user_id", "date", "evidence", "registration", "aircraft_class",
    "off_block", "takeoff", "landing", "on_block", "starts", "role",
    "price_per_hour", "billing_basis",
)


@dataclass(frozen=True)
class ShadowVerificationReport:
    ok: bool
    status: str
    source_watermark: str
    target_watermark: str
    shadow_migrated_at: str
    shadow_current: bool
    count_match: bool
    metrics_match: bool
    deep_match: bool | None
    source_counts: dict[str, int]
    target_counts: dict[str, int]
    count_differences: dict[str, dict[str, int]]
    source_user_metrics: dict[str, dict[str, Any]]
    target_user_metrics: dict[str, dict[str, Any]]
    metric_differences: dict[str, dict[str, Any]]
    source_fingerprints: dict[str, str] | None
    target_fingerprints: dict[str, str] | None
    fingerprint_differences: dict[str, dict[str, str]] | None
    source_query_ms: float | None
    target_query_ms: float | None
    notes: tuple[str, ...]

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _sqlite_snapshot_path(sqlite_path: str | Path) -> Path:
    raw = snapshot_sqlite_bytes(sqlite_path)
    handle = tempfile.NamedTemporaryFile(
        prefix=".logbook_shadow_verify_",
        suffix=".sqlite",
        delete=False,
    )
    temp = Path(handle.name)
    handle.close()
    temp.write_bytes(raw)
    return temp


def _sqlite_connect(path: Path) -> sqlite3.Connection:
    uri = f"file:{path.resolve().as_posix()}?mode=ro"
    con = sqlite3.connect(uri, uri=True, timeout=10.0)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    con.execute("PRAGMA query_only = ON")
    return con


def _canonical_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, bool):
        return bool(value)
    if isinstance(value, int):
        return int(value)
    if isinstance(value, (float, Decimal)):
        number = float(value)
        if not math.isfinite(number):
            return None
        # PostgreSQL DOUBLE PRECISION and SQLite REAL represent the same migrated
        # binary values but string representations can differ in the final digits.
        return float(f"{number:.12g}")
    if isinstance(value, (bytes, bytearray, memoryview)):
        return bytes(value).hex()
    return str(value)


def _canonical_row(row: Any, columns: Iterable[str]) -> bytes:
    payload = [_canonical_value(row[column]) for column in columns]
    return (
        json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=False)
        + "\n"
    ).encode("utf-8")


def _source_meta(con: sqlite3.Connection) -> dict[str, str]:
    rows = con.execute("SELECT key, value FROM app_meta").fetchall()
    return {
        str(row["key"]): "" if row["value"] is None else str(row["value"])
        for row in rows
    }


def _target_meta(con: Any) -> dict[str, str]:
    try:
        rows = con.execute("SELECT key, value FROM app_meta").fetchall()
    except Exception:
        return {}
    return {
        str(row["key"]): "" if row["value"] is None else str(row["value"])
        for row in rows
    }


def _sqlite_counts(con: sqlite3.Connection) -> dict[str, int]:
    result: dict[str, int] = {}
    for table in POSTGRES_TABLE_ORDER:
        if table == "app_meta":
            placeholders = ",".join("?" for _ in SHADOW_META_KEYS)
            row = con.execute(
                f"SELECT COUNT(*) AS n FROM app_meta WHERE key NOT IN ({placeholders})",
                tuple(sorted(SHADOW_META_KEYS)),
            ).fetchone()
        else:
            row = con.execute(f'SELECT COUNT(*) AS n FROM "{table}"').fetchone()
        result[table] = int(row["n"])
    return result


def _postgres_counts(con: Any) -> dict[str, int]:
    existing = {
        str(row["table_name"])
        for row in con.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema='public'
            """
        ).fetchall()
    }
    result: dict[str, int] = {}
    for table in POSTGRES_TABLE_ORDER:
        if table not in existing:
            result[table] = -1
            continue
        if table == "app_meta":
            row = con.execute(
                "SELECT COUNT(*) AS n FROM app_meta WHERE NOT (key = ANY(%s))",
                (list(sorted(SHADOW_META_KEYS)),),
            ).fetchone()
        else:
            row = con.execute(f'SELECT COUNT(*) AS n FROM "{table}"').fetchone()
        result[table] = int(row["n"])
    return result


def _flight_metrics(rows: Iterable[Any], track_counts: dict[int, int], point_counts: dict[int, int]) -> dict[str, dict[str, Any]]:
    metrics: dict[int, dict[str, Any]] = {}

    def bucket(user_id: int) -> dict[str, Any]:
        if user_id not in metrics:
            metrics[user_id] = {
                "flights": 0,
                "starts": 0,
                "block_minutes": 0,
                "air_minutes": 0,
                "pic_minutes": 0,
                "pic_ull_minutes": 0,
                "pic_easa_minutes": 0,
                "ull_minutes": 0,
                "easa_minutes": 0,
                "dual_minutes": 0,
                "tracks": int(track_counts.get(user_id, 0)),
                "gps_points": int(point_counts.get(user_id, 0)),
            }
        return metrics[user_id]

    for row in rows:
        user_id = int(row["user_id"])
        item = bucket(user_id)
        block = minutes_diff(row["off_block"], row["on_block"]) or 0
        air = minutes_diff(row["takeoff"], row["landing"]) or 0
        role = str(row["role"] or "").strip().upper()
        evidence = str(row["evidence"] or "").strip().upper()

        item["flights"] += 1
        try:
            item["starts"] += int(row["starts"] or 0)
        except Exception:
            pass
        item["block_minutes"] += int(block)
        item["air_minutes"] += int(air)
        if role == "PIC":
            item["pic_minutes"] += int(block)
            if evidence == "ULL":
                item["pic_ull_minutes"] += int(block)
            elif evidence == "EASA":
                item["pic_easa_minutes"] += int(block)
        if role == "DUAL":
            item["dual_minutes"] += int(block)
        if evidence == "ULL":
            item["ull_minutes"] += int(block)
        elif evidence == "EASA":
            item["easa_minutes"] += int(block)

    # Users without flights still matter for track/point consistency.
    for user_id in set(track_counts) | set(point_counts):
        bucket(int(user_id))

    return {str(user_id): values for user_id, values in sorted(metrics.items())}


def _sqlite_group_counts(con: sqlite3.Connection, table: str) -> dict[int, int]:
    return {
        int(row["user_id"]): int(row["n"])
        for row in con.execute(
            f'SELECT user_id, COUNT(*) AS n FROM "{table}" GROUP BY user_id'
        ).fetchall()
    }


def _postgres_group_counts(con: Any, table: str) -> dict[int, int]:
    return {
        int(row["user_id"]): int(row["n"])
        for row in con.execute(
            f'SELECT user_id, COUNT(*) AS n FROM "{table}" GROUP BY user_id'
        ).fetchall()
    }


def _sqlite_user_metrics(con: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    tracks = _sqlite_group_counts(con, "flight_tracks")
    points = _sqlite_group_counts(con, "track_points")
    rows = con.execute(
        "SELECT " + ", ".join(FLIGHT_SHADOW_COLUMNS) + " FROM flights ORDER BY id"
    ).fetchall()
    return _flight_metrics(rows, tracks, points)


def _postgres_user_metrics(con: Any) -> dict[str, dict[str, Any]]:
    tracks = _postgres_group_counts(con, "flight_tracks")
    points = _postgres_group_counts(con, "track_points")
    rows = con.execute(
        "SELECT " + ", ".join(FLIGHT_SHADOW_COLUMNS) + " FROM flights ORDER BY id"
    ).fetchall()
    return _flight_metrics(rows, tracks, points)


def _sqlite_table_fingerprint(con: sqlite3.Connection, table: str) -> str:
    columns = POSTGRES_TABLE_COLUMNS[table]
    order = TABLE_ORDER_KEYS[table]
    quoted = ", ".join(f'"{column}"' for column in columns)
    order_sql = ", ".join(f'"{column}"' for column in order)
    params: tuple[Any, ...] = ()
    where = ""
    if table == "app_meta":
        placeholders = ",".join("?" for _ in SHADOW_META_KEYS)
        where = f" WHERE key NOT IN ({placeholders})"
        params = tuple(sorted(SHADOW_META_KEYS))
    cur = con.execute(
        f'SELECT {quoted} FROM "{table}"{where} ORDER BY {order_sql}',
        params,
    )
    digest = hashlib.sha256()
    while True:
        rows = cur.fetchmany(2000)
        if not rows:
            break
        for row in rows:
            digest.update(_canonical_row(row, columns))
    return digest.hexdigest()


def _postgres_table_fingerprint(con: Any, table: str) -> str:
    columns = POSTGRES_TABLE_COLUMNS[table]
    order = TABLE_ORDER_KEYS[table]
    quoted = ", ".join(f'"{column}"' for column in columns)
    order_sql = ", ".join(f'"{column}"' for column in order)
    if table == "app_meta":
        cur = con.execute(
            f'SELECT {quoted} FROM "{table}" WHERE NOT (key = ANY(%s)) ORDER BY {order_sql}',
            (list(sorted(SHADOW_META_KEYS)),),
        )
    else:
        cur = con.execute(
            f'SELECT {quoted} FROM "{table}" ORDER BY {order_sql}'
        )
    digest = hashlib.sha256()
    while True:
        rows = cur.fetchmany(2000)
        if not rows:
            break
        for row in rows:
            digest.update(_canonical_row(row, columns))
    return digest.hexdigest()


def _compare_counts(source: dict[str, int], target: dict[str, int]) -> dict[str, dict[str, int]]:
    return {
        table: {"sqlite": int(source.get(table, -1)), "postgresql": int(target.get(table, -1))}
        for table in POSTGRES_TABLE_ORDER
        if int(source.get(table, -1)) != int(target.get(table, -1))
    }


def _compare_metrics(
    source: dict[str, dict[str, Any]],
    target: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    differences: dict[str, dict[str, Any]] = {}
    for user_id in sorted(set(source) | set(target), key=lambda value: int(value)):
        left = source.get(user_id, {})
        right = target.get(user_id, {})
        keys = sorted(set(left) | set(right))
        changed = {
            key: {"sqlite": left.get(key), "postgresql": right.get(key)}
            for key in keys
            if left.get(key) != right.get(key)
        }
        if changed:
            differences[user_id] = changed
    return differences


def _median_ms(samples: list[float]) -> float | None:
    if not samples:
        return None
    return round(float(statistics.median(samples)), 2)


def _sqlite_latency(con: sqlite3.Connection, repeats: int = 5) -> float | None:
    samples = []
    for _ in range(max(1, repeats)):
        started = time.perf_counter()
        con.execute("SELECT COUNT(*) FROM flights").fetchone()
        samples.append((time.perf_counter() - started) * 1000.0)
    return _median_ms(samples)


def _postgres_latency(con: Any, repeats: int = 5) -> float | None:
    samples = []
    for _ in range(max(1, repeats)):
        started = time.perf_counter()
        con.execute("SELECT COUNT(*) FROM flights").fetchone()
        samples.append((time.perf_counter() - started) * 1000.0)
    return _median_ms(samples)


def verify_postgres_shadow(
    sqlite_path: str | Path,
    config: PostgresTargetConfig,
    *,
    deep: bool = False,
) -> ShadowVerificationReport:
    if not config.configured:
        raise ValueError("PostgreSQL target není nakonfigurovaný.")

    temp = _sqlite_snapshot_path(sqlite_path)
    sqlite_con: sqlite3.Connection | None = None
    try:
        sqlite_con = _sqlite_connect(temp)
        source_meta = _source_meta(sqlite_con)
        source_counts = _sqlite_counts(sqlite_con)
        source_metrics = _sqlite_user_metrics(sqlite_con)
        source_latency = _sqlite_latency(sqlite_con)

        with postgres_connection(config) as pg_con:
            target_meta = _target_meta(pg_con)
            target_counts = _postgres_counts(pg_con)
            target_metrics = _postgres_user_metrics(pg_con)
            target_latency = _postgres_latency(pg_con)

            count_differences = _compare_counts(source_counts, target_counts)
            metric_differences = _compare_metrics(source_metrics, target_metrics)

            source_fingerprints: dict[str, str] | None = None
            target_fingerprints: dict[str, str] | None = None
            fingerprint_differences: dict[str, dict[str, str]] | None = None
            deep_match: bool | None = None

            if deep:
                source_fingerprints = {
                    table: _sqlite_table_fingerprint(sqlite_con, table)
                    for table in POSTGRES_TABLE_ORDER
                }
                target_fingerprints = {
                    table: _postgres_table_fingerprint(pg_con, table)
                    for table in POSTGRES_TABLE_ORDER
                }
                fingerprint_differences = {
                    table: {
                        "sqlite": source_fingerprints[table],
                        "postgresql": target_fingerprints[table],
                    }
                    for table in POSTGRES_TABLE_ORDER
                    if source_fingerprints[table] != target_fingerprints[table]
                }
                deep_match = not fingerprint_differences

        source_watermark = str(source_meta.get("last_change_at") or "")
        target_watermark = str(target_meta.get("last_change_at") or "")
        migrated_at = str(target_meta.get("shadow_migrated_at") or "")
        shadow_mode = str(target_meta.get("shadow_mode") or "") == "1"
        shadow_current = bool(
            shadow_mode
            and source_watermark
            and target_watermark
            and source_watermark == target_watermark
        )
        count_match = not count_differences
        metrics_match = not metric_differences
        ok = bool(
            shadow_mode
            and shadow_current
            and count_match
            and metrics_match
            and (deep_match is not False)
        )

        if not shadow_mode:
            status = "not_shadow"
        elif not shadow_current:
            status = "stale"
        elif not count_match or not metrics_match or deep_match is False:
            status = "mismatch"
        else:
            status = "match"

        notes = (
            "SQLite remains the production runtime.",
            "Latency is a diagnostic median COUNT query, not an application benchmark.",
            "Deep verification hashes canonical table rows and excludes shadow-only app_meta keys.",
        )
        return ShadowVerificationReport(
            ok=ok,
            status=status,
            source_watermark=source_watermark,
            target_watermark=target_watermark,
            shadow_migrated_at=migrated_at,
            shadow_current=shadow_current,
            count_match=count_match,
            metrics_match=metrics_match,
            deep_match=deep_match,
            source_counts=source_counts,
            target_counts=target_counts,
            count_differences=count_differences,
            source_user_metrics=source_metrics,
            target_user_metrics=target_metrics,
            metric_differences=metric_differences,
            source_fingerprints=source_fingerprints,
            target_fingerprints=target_fingerprints,
            fingerprint_differences=fingerprint_differences,
            source_query_ms=source_latency,
            target_query_ms=target_latency,
            notes=notes,
        )
    finally:
        if sqlite_con is not None:
            sqlite_con.close()
        try:
            temp.unlink(missing_ok=True)
        except Exception:
            pass


def shadow_report_json(report: ShadowVerificationReport) -> bytes:
    return json.dumps(
        report.as_dict(),
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
    ).encode("utf-8")
