from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sqlite3
from typing import Any, TYPE_CHECKING

from .database_foundation import PostgresTargetConfig
from .postgres_runtime import postgres_connection
if TYPE_CHECKING:
    from .shadow_verification import ShadowVerificationReport


CUTOVER_PROTOCOL_VERSION = 1


class ProductionCutoverError(RuntimeError):
    pass


@dataclass(frozen=True)
class CutoverReadiness:
    ready: bool
    source_watermark: str
    target_watermark: str
    ready_watermark: str
    ready_at: str
    deep_verified: bool
    production_active: bool
    production_cutover_at: str
    reason: str = ""

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _sqlite_meta(sqlite_path: str | Path) -> dict[str, str]:
    path = Path(sqlite_path)
    if not path.exists():
        return {}
    uri = f"file:{path.resolve().as_posix()}?mode=ro"
    con = sqlite3.connect(uri, uri=True, timeout=10.0)
    try:
        rows = con.execute("SELECT key, value FROM app_meta").fetchall()
        return {
            str(row[0]): "" if row[1] is None else str(row[1])
            for row in rows
        }
    except sqlite3.DatabaseError:
        return {}
    finally:
        con.close()


def _postgres_meta(config: PostgresTargetConfig) -> dict[str, str]:
    with postgres_connection(config) as con:
        rows = con.execute("SELECT key, value FROM app_meta").fetchall()
        return {
            str(row["key"]): "" if row["value"] is None else str(row["value"])
            for row in rows
        }


def _fingerprint_summary(report: ShadowVerificationReport) -> str:
    fingerprints = report.source_fingerprints or {}
    payload = json.dumps(
        {key: fingerprints[key] for key in sorted(fingerprints)},
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def mark_postgres_cutover_ready(
    config: PostgresTargetConfig,
    report: ShadowVerificationReport,
) -> CutoverReadiness:
    """Persist an explicit deep-verified cutover gate in PostgreSQL.

    This does not switch runtime storage. The write is serialized with shadow
    refresh and production activation through one PostgreSQL advisory lock.
    """
    if not config.configured:
        raise ProductionCutoverError("PostgreSQL target není nakonfigurovaný.")
    if not report.ok or report.status != "match":
        raise ProductionCutoverError("Shadow není aktuální MATCH.")
    if report.deep_match is not True:
        raise ProductionCutoverError("Před cutover readiness je nutná hluboká SHA-256 kontrola.")
    if not report.source_watermark or report.source_watermark != report.target_watermark:
        raise ProductionCutoverError("SQLite a PostgreSQL watermark se neshodují.")

    now = _now_iso()
    summary = _fingerprint_summary(report)
    values = {
        "cutover_ready_protocol": str(CUTOVER_PROTOCOL_VERSION),
        "cutover_ready_at": now,
        "cutover_ready_watermark": report.source_watermark,
        "cutover_ready_deep": "1",
        "cutover_ready_fingerprint": summary,
    }
    with postgres_connection(config) as con:
        con.execute(
            "SELECT pg_advisory_xact_lock(hashtext('logbook-postgres-lifecycle'))"
        )
        current = {
            str(row["key"]): "" if row["value"] is None else str(row["value"])
            for row in con.execute(
                """
                SELECT key, value FROM app_meta
                WHERE key IN (
                    'shadow_mode',
                    'shadow_protocol_version',
                    'production_mode',
                    'production_cutover_at',
                    'last_change_at'
                )
                """
            ).fetchall()
        }
        if current.get("shadow_mode") != "1":
            raise ProductionCutoverError("Target už není platný shadow.")
        if current.get("production_mode") == "1" or current.get("production_cutover_at"):
            raise ProductionCutoverError("Target už byl aktivován jako produkční.")
        if current.get("last_change_at") != report.target_watermark:
            raise ProductionCutoverError(
                "PostgreSQL shadow se od hluboké kontroly změnil. Spusť kontrolu znovu."
            )

        for key, value in values.items():
            con.execute(
                """
                INSERT INTO app_meta(key, value, updated_at)
                VALUES (%s, %s, %s)
                ON CONFLICT(key) DO UPDATE
                SET value=EXCLUDED.value, updated_at=EXCLUDED.updated_at
                """,
                (key, value, now),
            )
        con.commit()

    return inspect_cutover_readiness(config, sqlite_path=None)

def inspect_cutover_readiness(
    config: PostgresTargetConfig,
    *,
    sqlite_path: str | Path | None,
) -> CutoverReadiness:
    if not config.configured:
        return CutoverReadiness(
            ready=False,
            source_watermark="",
            target_watermark="",
            ready_watermark="",
            ready_at="",
            deep_verified=False,
            production_active=False,
            production_cutover_at="",
            reason="PostgreSQL target není nakonfigurovaný.",
        )

    target = _postgres_meta(config)
    source = _sqlite_meta(sqlite_path) if sqlite_path is not None else {}

    source_watermark = str(source.get("last_change_at") or "")
    target_watermark = str(target.get("last_change_at") or "")
    ready_watermark = str(target.get("cutover_ready_watermark") or "")
    ready_at = str(target.get("cutover_ready_at") or "")
    deep_verified = str(target.get("cutover_ready_deep") or "") == "1"
    protocol_ok = str(target.get("cutover_ready_protocol") or "") == str(CUTOVER_PROTOCOL_VERSION)
    production_active = str(target.get("production_mode") or "") == "1"
    production_cutover_at = str(target.get("production_cutover_at") or "")

    if production_active and production_cutover_at:
        return CutoverReadiness(
            ready=True,
            source_watermark=source_watermark,
            target_watermark=target_watermark,
            ready_watermark=ready_watermark,
            ready_at=ready_at,
            deep_verified=deep_verified,
            production_active=True,
            production_cutover_at=production_cutover_at,
            reason="",
        )

    reason = ""
    ready = True
    if str(target.get("shadow_mode") or "") != "1":
        ready = False
        reason = "Target není označen jako PostgreSQL shadow."
    elif not protocol_ok:
        ready = False
        reason = "Chybí platný cutover readiness protocol."
    elif not deep_verified:
        ready = False
        reason = "Chybí hluboké SHA-256 ověření."
    elif not ready_at or not ready_watermark:
        ready = False
        reason = "Cutover readiness ještě nebyla připravena."
    elif target_watermark != ready_watermark:
        ready = False
        reason = "PostgreSQL se po readiness změnil."
    elif sqlite_path is not None and source_watermark != ready_watermark:
        ready = False
        reason = "SQLite se po readiness změnila; cutover by použil zastaralý PostgreSQL snapshot."

    return CutoverReadiness(
        ready=ready,
        source_watermark=source_watermark,
        target_watermark=target_watermark,
        ready_watermark=ready_watermark,
        ready_at=ready_at,
        deep_verified=deep_verified,
        production_active=production_active,
        production_cutover_at=production_cutover_at,
        reason=reason,
    )


def activate_postgres_production(
    config: PostgresTargetConfig,
    *,
    sqlite_path: str | Path,
) -> CutoverReadiness:
    """Validate the recorded gate and mark PostgreSQL as production.

    Called only when Secrets explicitly request PostgreSQL. Validation and
    activation are serialized with shadow refresh/readiness operations. Any
    mismatch fails closed; callers must never fall back to SQLite automatically.
    """
    if not config.configured:
        raise ProductionCutoverError("PostgreSQL target není nakonfigurovaný.")

    source = _sqlite_meta(sqlite_path)
    source_watermark = str(source.get("last_change_at") or "")
    now = _now_iso()

    with postgres_connection(config) as con:
        con.execute(
            "SELECT pg_advisory_xact_lock(hashtext('logbook-postgres-lifecycle'))"
        )
        target = {
            str(row["key"]): "" if row["value"] is None else str(row["value"])
            for row in con.execute("SELECT key, value FROM app_meta").fetchall()
        }

        # Already active is idempotent and no longer compared with frozen SQLite:
        # PostgreSQL may legitimately contain newer production writes.
        if (
            target.get("production_mode") == "1"
            and target.get("production_cutover_at")
            and target.get("production_backend") == "postgresql"
        ):
            frozen_watermark = str(target.get("cutover_ready_watermark") or "")
            if not frozen_watermark:
                raise ProductionCutoverError(
                    "Produkční PostgreSQL nemá uložený původní cutover watermark."
                )
            if source_watermark and source_watermark != frozen_watermark:
                raise ProductionCutoverError(
                    "Nouzová SQLite databáze se po PostgreSQL cutoveru změnila. "
                    "Automatický návrat na PostgreSQL je zablokovaný, aby se neztratily fallback zápisy."
                )
            con.commit()
            return CutoverReadiness(
                ready=True,
                source_watermark=source_watermark,
                target_watermark=str(target.get("last_change_at") or ""),
                ready_watermark=frozen_watermark,
                ready_at=str(target.get("cutover_ready_at") or ""),
                deep_verified=str(target.get("cutover_ready_deep") or "") == "1",
                production_active=True,
                production_cutover_at=str(target.get("production_cutover_at") or ""),
                reason="",
            )

        ready_watermark = str(target.get("cutover_ready_watermark") or "")
        target_watermark = str(target.get("last_change_at") or "")
        if target.get("shadow_mode") != "1":
            raise ProductionCutoverError("PostgreSQL target není platný shadow.")
        if str(target.get("cutover_ready_protocol") or "") != str(CUTOVER_PROTOCOL_VERSION):
            raise ProductionCutoverError("Chybí platný CUTOVER READY protocol.")
        if str(target.get("cutover_ready_deep") or "") != "1":
            raise ProductionCutoverError("Chybí hluboké SHA-256 ověření.")
        if not ready_watermark:
            raise ProductionCutoverError("Chybí CUTOVER READY watermark.")
        if target_watermark != ready_watermark:
            raise ProductionCutoverError(
                "PostgreSQL se po CUTOVER READY změnil. Připrav cutover znovu."
            )
        if source_watermark != ready_watermark:
            raise ProductionCutoverError(
                "SQLite se po CUTOVER READY změnila. Shadow musí být znovu ověřen/obnoven."
            )

        for key, value in (
            ("production_mode", "1"),
            ("production_cutover_at", now),
            ("production_backend", "postgresql"),
            ("production_cutover_protocol", str(CUTOVER_PROTOCOL_VERSION)),
        ):
            con.execute(
                """
                INSERT INTO app_meta(key, value, updated_at)
                VALUES (%s, %s, %s)
                ON CONFLICT(key) DO UPDATE
                SET value=EXCLUDED.value, updated_at=EXCLUDED.updated_at
                """,
                (key, value, now),
            )
        con.commit()

    return inspect_cutover_readiness(config, sqlite_path=sqlite_path)

