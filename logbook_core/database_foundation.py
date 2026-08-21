from __future__ import annotations

from dataclasses import dataclass
import os
import re
from typing import Any, Mapping
from urllib.parse import urlsplit, urlunsplit


POSTGRES_FOUNDATION_VERSION = 2
ACTIVE_RUNTIME_BACKEND = "configurable"


@dataclass(frozen=True)
class PostgresTargetConfig:
    dsn: str = ""
    min_pool_size: int = 0
    max_pool_size: int = 4
    connect_timeout_s: int = 5

    @property
    def configured(self) -> bool:
        return bool(str(self.dsn or "").strip())


def _positive_int(value: Any, default: int, *, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = int(default)
    return max(minimum, min(maximum, parsed))


def postgres_target_config(
    *,
    secrets_database: Mapping[str, Any] | None = None,
    environ: Mapping[str, str] | None = None,
) -> PostgresTargetConfig:
    """Resolve PostgreSQL *target* configuration without enabling runtime cutover.

    Environment variables are useful for CLI/admin diagnostics. Streamlit
    secrets can be passed explicitly by the app so this module stays independent
    from Streamlit itself.
    """
    env = environ if environ is not None else os.environ
    sec = secrets_database or {}

    dsn = str(
        sec.get("postgres_dsn")
        or env.get("LOGBOOK_POSTGRES_DSN")
        or env.get("DATABASE_URL")
        or ""
    ).strip()

    min_pool = _positive_int(
        sec.get("postgres_pool_min", env.get("LOGBOOK_POSTGRES_POOL_MIN", 0)),
        0,
        minimum=0,
        maximum=8,
    )
    max_pool = _positive_int(
        sec.get("postgres_pool_max", env.get("LOGBOOK_POSTGRES_POOL_MAX", 4)),
        4,
        minimum=1,
        maximum=32,
    )
    if min_pool > max_pool:
        min_pool = max_pool
    timeout = _positive_int(
        sec.get("postgres_connect_timeout", env.get("LOGBOOK_POSTGRES_CONNECT_TIMEOUT", 5)),
        5,
        minimum=1,
        maximum=30,
    )
    return PostgresTargetConfig(
        dsn=dsn,
        min_pool_size=min_pool,
        max_pool_size=max_pool,
        connect_timeout_s=timeout,
    )


def redact_postgres_dsn(dsn: str) -> str:
    """Return a display-safe PostgreSQL DSN with credentials removed."""
    raw = str(dsn or "").strip()
    if not raw:
        return ""

    if "://" in raw:
        try:
            parts = urlsplit(raw)
            host = parts.hostname or ""
            port = f":{parts.port}" if parts.port else ""
            user = parts.username or ""
            userinfo = f"{user}:***@" if user else ""
            netloc = f"{userinfo}{host}{port}"
            return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))
        except Exception:
            pass

    # Keyword DSN: host=x dbname=y user=z password=secret sslmode=require
    safe = re.sub(
        r"(?i)\b(password|passfile)\s*=\s*(?:'[^']*'|\"[^\"]*\"|\S+)",
        lambda m: f"{m.group(1)}=***",
        raw,
    )
    return safe


def postgres_cutover_enabled(
    *,
    secrets_database: Mapping[str, Any] | None = None,
    environ: Mapping[str, str] | None = None,
) -> bool:
    """Return True only for an explicit, confirmed PostgreSQL production request."""
    sec = secrets_database or {}
    env = environ if environ is not None else os.environ
    backend = str(
        sec.get("production_backend")
        or env.get("LOGBOOK_DATABASE_BACKEND")
        or "sqlite"
    ).strip().lower()
    confirm = str(
        sec.get("cutover_confirm")
        or env.get("LOGBOOK_POSTGRES_CUTOVER_CONFIRM")
        or ""
    ).strip()
    return backend == "postgresql" and confirm == "POSTGRESQL_PRODUCTION"
