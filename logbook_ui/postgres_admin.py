from __future__ import annotations

from dataclasses import asdict
from typing import Any

import pandas as pd
import streamlit as st

from logbook_core.config import DB_PATH
from logbook_core.database_foundation import postgres_target_config, redact_postgres_dsn
from logbook_core.db_runtime import resolve_runtime_database_config
from logbook_core.postgres_migration import (
    PostgresMigrationError,
    build_sqlite_migration_plan,
    migration_plan_json,
    migrate_sqlite_to_postgres,
    refresh_sqlite_to_postgres_shadow,
)
from logbook_core.postgres_runtime import (
    postgres_driver_available,
    postgres_healthcheck,
    postgres_pool_stats,
    postgres_relation_stats,
    postgres_table_counts,
)
from logbook_core.postgres_schema import POSTGRES_SCHEMA_VERSION, postgres_schema_sql
from logbook_core.production_cutover import (
    CUTOVER_PROTOCOL_VERSION,
    ProductionCutoverError,
    inspect_cutover_readiness,
    mark_postgres_cutover_ready,
)
from logbook_core.runtime_metrics import (
    reset_runtime_performance_metrics,
    runtime_performance_snapshot,
)
from logbook_core.shadow_verification import shadow_report_json, verify_postgres_shadow
from logbook_ui.theme import metric_card


def _database_secrets() -> dict[str, Any]:
    try:
        section = st.secrets.get("database", {})
        if hasattr(section, "items"):
            return {str(key): value for key, value in section.items()}
    except Exception:
        pass
    return {}


def _target_config():
    return postgres_target_config(secrets_database=_database_secrets())


def _runtime_config():
    return resolve_runtime_database_config(secrets_database=_database_secrets())


def _ms(value: Any) -> str:
    try:
        if value is None:
            return "—"
        return f"{float(value):.0f} ms"
    except Exception:
        return "—"


def _bytes_label(value: Any) -> str:
    try:
        size = float(value or 0)
    except Exception:
        return "—"
    if size >= 1024 ** 3:
        return f"{size / (1024 ** 3):.2f} GB"
    if size >= 1024 ** 2:
        return f"{size / (1024 ** 2):.1f} MB"
    if size >= 1024:
        return f"{size / 1024:.0f} kB"
    return f"{size:.0f} B"


def _render_runtime_performance(pg_config) -> None:
    st.markdown("#### Runtime performance · posledních 15 minut")
    perf = runtime_performance_snapshot(window_seconds=900)
    query = perf.get("query", {})
    checkout = perf.get("checkout", {})
    page = perf.get("page", {})

    p1, p2, p3, p4 = st.columns(4)
    with p1:
        metric_card("SQL p50", _ms(query.get("p50_ms")), f"{query.get('count', 0)} dotazů")
    with p2:
        metric_card("SQL p95", _ms(query.get("p95_ms")), f"max {_ms(query.get('max_ms'))}")
    with p3:
        metric_card("Pool checkout p95", _ms(checkout.get("p95_ms")), f"{checkout.get('count', 0)} checkoutů")
    with p4:
        metric_card("Page render p95", _ms(page.get("p95_ms")), f"{page.get('count', 0)} renderů")

    slow = int(perf.get("slow_queries") or 0)
    failures = int(perf.get("query_failures") or 0)
    if failures:
        st.error(f"V měřeném okně bylo {failures} SQL chyb.")
    elif slow:
        st.warning(
            f"V měřeném okně bylo {slow} dotazů nad {perf.get('slow_query_threshold_ms', 250):.0f} ms."
        )
    elif int(query.get("count") or 0):
        st.success("V měřeném okně nejsou zaznamenané pomalé nebo chybné SQL dotazy.")
    else:
        st.caption("Měření se plní až provozem po startu aktuálního Streamlit workeru.")

    by_tag = pd.DataFrame(perf.get("by_tag") or [])
    by_page = pd.DataFrame(perf.get("by_page") or [])
    left, right = st.columns(2)
    with left:
        st.markdown("##### SQL podle typu")
        if by_tag.empty:
            st.caption("Zatím bez dat.")
        else:
            show = by_tag.head(12).rename(columns={
                "tag": "Dotaz",
                "count": "Počet",
                "avg_ms": "Průměr ms",
                "p50_ms": "p50 ms",
                "p95_ms": "p95 ms",
                "max_ms": "Max ms",
                "total_ms": "Celkem ms",
                "slow_count": "Pomalé",
            })
            st.dataframe(show, hide_index=True, width="stretch")
    with right:
        st.markdown("##### Stránky")
        if by_page.empty:
            st.caption("Zatím bez dat.")
        else:
            show = by_page.head(12).rename(columns={
                "page": "Stránka",
                "count": "Počet",
                "avg_ms": "Průměr ms",
                "p50_ms": "p50 ms",
                "p95_ms": "p95 ms",
                "max_ms": "Max ms",
                "total_ms": "Celkem ms",
            })
            st.dataframe(show, hide_index=True, width="stretch")

    pool = postgres_pool_stats(pg_config)
    if pool.get("error"):
        st.caption("Pool diagnostika: " + str(pool["error"]))
    else:
        preferred = [
            "pool_size", "pool_available", "requests_num", "requests_waiting",
            "requests_queued", "requests_errors", "connections_num",
            "connections_ms", "requests_wait_ms", "usage_ms",
        ]
        pool_rows = [
            {"Metrika": key, "Hodnota": pool[key]}
            for key in preferred
            if key in pool
        ]
        if pool_rows:
            with st.expander("Psycopg pool statistiky", expanded=False):
                st.dataframe(pd.DataFrame(pool_rows), hide_index=True, width="stretch")

    if st.button("Resetovat lokální performance měření", width="stretch", key="pg_perf_reset_v073"):
        reset_runtime_performance_metrics()
        st.success("Měření aktuálního workeru bylo vyčištěno.")
        st.rerun()


def _render_production_diagnostics(pg_config) -> None:
    st.markdown("#### Produkční diagnostika")
    st.caption(
        "Drahé kontroly jsou ve v0.73 explicitní. Otevření Admin → PostgreSQL samo nespouští "
        "COUNT přes všechny tabulky ani pg_stat dotazy."
    )
    c1, c2, c3 = st.columns(3)
    with c1:
        if st.button("Načíst počty tabulek", width="stretch", key="pg_counts_v073"):
            try:
                with st.spinner("Načítám počty…"):
                    st.session_state["pg_counts_result_v073"] = postgres_table_counts(pg_config)
            except Exception as exc:
                st.session_state["pg_counts_result_v073"] = {"_error": str(exc)}
    with c2:
        if st.button("Načíst velikosti a indexy", width="stretch", key="pg_relstats_v073"):
            try:
                with st.spinner("Čtu pg_stat_user_tables…"):
                    st.session_state["pg_relstats_result_v073"] = postgres_relation_stats(pg_config)
            except Exception as exc:
                st.session_state["pg_relstats_result_v073"] = [{"_error": str(exc)}]
    with c3:
        if st.button("Načíst lifecycle stav", width="stretch", key="pg_lifecycle_v073"):
            try:
                st.session_state["pg_lifecycle_result_v073"] = asdict(
                    inspect_cutover_readiness(pg_config, sqlite_path=None)
                )
            except Exception as exc:
                st.session_state["pg_lifecycle_result_v073"] = {"_error": str(exc)}

    counts = st.session_state.get("pg_counts_result_v073")
    if isinstance(counts, dict):
        if counts.get("_error"):
            st.error(str(counts["_error"]))
        else:
            rows = [{"Tabulka": table, "Řádků": count} for table, count in counts.items() if int(count) >= 0]
            st.dataframe(pd.DataFrame(rows), hide_index=True, width="stretch")

    relstats = st.session_state.get("pg_relstats_result_v073")
    if isinstance(relstats, list) and relstats:
        if relstats[0].get("_error"):
            st.error(str(relstats[0]["_error"]))
        else:
            view = pd.DataFrame(relstats)
            for col in ("total_bytes", "table_bytes", "index_bytes"):
                if col in view.columns:
                    view[col] = view[col].map(_bytes_label)
            view = view.rename(columns={
                "table_name": "Tabulka",
                "estimated_rows": "Odhad řádků",
                "seq_scan": "Seq scans",
                "idx_scan": "Index scans",
                "total_bytes": "Celkem",
                "table_bytes": "Data",
                "index_bytes": "Indexy",
                "last_analyze": "Analyze",
                "last_autoanalyze": "Auto-analyze",
            })
            st.dataframe(view, hide_index=True, width="stretch")

    lifecycle = st.session_state.get("pg_lifecycle_result_v073")
    if isinstance(lifecycle, dict):
        if lifecycle.get("_error"):
            st.error(str(lifecycle["_error"]))
        else:
            st.caption(
                f"Cutover: {lifecycle.get('production_cutover_at') or '—'} · "
                f"ready: {lifecycle.get('ready_at') or '—'} · "
                f"watermark: {lifecycle.get('ready_watermark') or '—'}"
            )


def _render_legacy_cutover(pg_config, configured: bool, driver_ok: bool) -> None:
    """Pre-production migration controls retained outside app.py for recovery/upgrades."""
    st.info(
        "Aplikace stále běží na SQLite. PostgreSQL se stane produkcí až po deep verification, "
        "CUTOVER READY gate a explicitní změně Streamlit Secrets."
    )

    st.markdown("#### 1. Shadow databáze")
    confirm_shadow = st.text_input(
        "Pro první migraci napiš VYTVOŘIT SHADOW",
        value="",
        key="pg_shadow_confirm_v073",
    )
    acknowledge_credentials = st.checkbox(
        "Rozumím, že úplná shadow kopie obsahuje účty a password hashe.",
        value=False,
        key="pg_shadow_credentials_ack_v073",
    )
    if st.button(
        "Spustit první shadow migraci",
        disabled=(
            not configured
            or not driver_ok
            or confirm_shadow != "VYTVOŘIT SHADOW"
            or not acknowledge_credentials
        ),
        width="stretch",
        key="pg_shadow_migrate_v073",
    ):
        try:
            with st.spinner("Kopíruji konzistentní SQLite snapshot…"):
                report = migrate_sqlite_to_postgres(DB_PATH, pg_config.dsn, batch_size=1000)
            st.success(f"Shadow vytvořen: {report.copied_rows:,} řádků.".replace(",", " "))
        except PostgresMigrationError as exc:
            st.error("Shadow migrace odmítnuta: " + str(exc))
        except Exception as exc:
            st.error("Shadow migrace selhala: " + str(exc))

    st.markdown("#### 2. Ověření shadow")
    v1, v2 = st.columns(2)
    with v1:
        if st.button("Rychlá kontrola", disabled=not configured, width="stretch", key="pg_shadow_quick_v073"):
            try:
                st.session_state["pg_shadow_verify_v073"] = verify_postgres_shadow(DB_PATH, pg_config, deep=False)
            except Exception as exc:
                st.error("Shadow kontrola selhala: " + str(exc))
    with v2:
        if st.button("Hluboká kontrola SHA-256", disabled=not configured, type="primary", width="stretch", key="pg_shadow_deep_v073"):
            try:
                with st.spinner("Hashuji obsah migrovaných tabulek…"):
                    st.session_state["pg_shadow_verify_v073"] = verify_postgres_shadow(DB_PATH, pg_config, deep=True)
            except Exception as exc:
                st.error("Hluboká kontrola selhala: " + str(exc))

    verification = st.session_state.get("pg_shadow_verify_v073")
    if verification is not None and hasattr(verification, "as_dict"):
        if verification.status == "match":
            st.success("SHADOW MATCH · PostgreSQL odpovídá aktuální SQLite produkci.")
        elif verification.status == "stale":
            st.warning("SHADOW STALE · SQLite se od shadow migrace změnila.")
        elif verification.status == "mismatch":
            st.error("SHADOW MISMATCH · obsah se neshoduje.")
        else:
            st.warning("Target není platný shadow snapshot.")

        s1, s2, s3, s4 = st.columns(4)
        with s1:
            metric_card("Počty", "MATCH" if verification.count_match else "ROZDÍL", "tabulky")
        with s2:
            metric_card("Pilotní součty", "MATCH" if verification.metrics_match else "ROZDÍL", "per user")
        with s3:
            label = "NEPROVEDENO" if verification.deep_match is None else ("MATCH" if verification.deep_match else "ROZDÍL")
            metric_card("SHA-256", label, "obsah")
        with s4:
            metric_card("Aktuálnost", "ANO" if verification.shadow_current else "NE", "watermark")

        st.download_button(
            "Stáhnout verification JSON",
            data=shadow_report_json(verification),
            file_name="logbook_shadow_verification.json",
            mime="application/json",
            width="stretch",
            key="pg_shadow_report_v073",
        )

    if verification is not None and getattr(verification, "status", "") in {"stale", "mismatch"}:
        st.markdown("#### Obnovit shadow z aktuální SQLite")
        refresh_confirm = st.text_input("Pro refresh napiš OBNOVIT SHADOW", value="", key="pg_shadow_refresh_confirm_v073")
        refresh_ack = st.checkbox(
            "Rozumím, že stávající neprodukční shadow data budou nahrazena aktuálním SQLite snapshotem.",
            value=False,
            key="pg_shadow_refresh_ack_v073",
        )
        if st.button(
            "Obnovit PostgreSQL shadow",
            disabled=not (configured and refresh_confirm == "OBNOVIT SHADOW" and refresh_ack),
            width="stretch",
            key="pg_shadow_refresh_v073",
        ):
            try:
                with st.spinner("Obnovuji shadow…"):
                    refreshed = refresh_sqlite_to_postgres_shadow(DB_PATH, pg_config.dsn, batch_size=1000)
                st.session_state.pop("pg_shadow_verify_v073", None)
                st.success(f"Shadow obnoven: {refreshed.copied_rows:,} řádků.".replace(",", " "))
                st.rerun()
            except PostgresMigrationError as exc:
                st.error("Shadow refresh odmítnut: " + str(exc))
            except Exception as exc:
                st.error("Shadow refresh selhal: " + str(exc))

    st.markdown("#### 3. CUTOVER READY")
    try:
        readiness = inspect_cutover_readiness(pg_config, sqlite_path=DB_PATH) if configured else None
    except Exception as exc:
        readiness = None
        st.caption(f"Readiness nelze načíst: {exc}")

    if readiness and readiness.ready:
        st.success("CUTOVER READY · PostgreSQL je hluboce ověřený proti aktuální SQLite.")
    else:
        confirm_ready = st.text_input(
            "Po úspěšné hluboké kontrole napiš PŘIPRAVIT CUTOVER",
            value="",
            key="pg_cutover_ready_confirm_v073",
        )
        can_mark = bool(
            configured
            and verification is not None
            and getattr(verification, "status", "") == "match"
            and getattr(verification, "deep_match", None) is True
            and getattr(verification, "shadow_current", False)
            and confirm_ready == "PŘIPRAVIT CUTOVER"
        )
        if st.button(
            "Označit PostgreSQL jako CUTOVER READY",
            disabled=not can_mark,
            type="primary",
            width="stretch",
            key="pg_cutover_ready_v073",
        ):
            try:
                mark_postgres_cutover_ready(pg_config, verification)
                st.success("CUTOVER READY marker uložen.")
                st.rerun()
            except ProductionCutoverError as exc:
                st.error("Readiness odmítnuta: " + str(exc))
            except Exception as exc:
                st.error("Readiness selhala: " + str(exc))

    if readiness and readiness.ready:
        st.markdown("#### 4. Aktivace PostgreSQL produkce")
        st.code(
            '[database]\n'
            '# ponech stávající postgres_dsn + pool nastavení\n'
            'production_backend = "postgresql"\n'
            'cutover_confirm = "POSTGRESQL_PRODUCTION"',
            language="toml",
        )

    with st.expander("Migrační soubory a CLI", expanded=False):
        try:
            plan = build_sqlite_migration_plan(DB_PATH)
            st.download_button(
                "Stáhnout migration manifest JSON",
                data=migration_plan_json(plan),
                file_name="logbook_postgres_migration_manifest.json",
                mime="application/json",
                width="stretch",
                key="pg_manifest_v073",
            )
            st.download_button(
                "Stáhnout PostgreSQL schema SQL",
                data=postgres_schema_sql().encode("utf-8"),
                file_name="postgresql_schema_v1.sql",
                mime="text/sql",
                width="stretch",
                key="pg_schema_v073",
            )
        except Exception as exc:
            st.caption(f"Migrační nástroje nejsou dostupné: {exc}")


def render_postgres_admin_panel() -> None:
    runtime = _runtime_config()
    pg_config = _target_config()
    configured = pg_config.configured
    driver_ok = postgres_driver_available()
    is_pg_prod = runtime.is_postgresql

    st.markdown("### PostgreSQL production")
    st.caption(
        "v0.73 uklízí přechodovou vrstvu po cutoveru a měří skutečný PostgreSQL provoz. "
        "Běžné otevření této stránky už samo nespouští drahé tabulkové diagnostiky."
    )

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        metric_card("Production", "PostgreSQL" if is_pg_prod else "SQLite", "read/write runtime")
    with c2:
        metric_card("PostgreSQL", "Nastaven" if configured else "Nenastaven", "connection")
    with c3:
        metric_card("Cutover", "AKTIVNÍ" if is_pg_prod else "PŘÍPRAVA", f"protocol {CUTOVER_PROTOCOL_VERSION}")
    with c4:
        metric_card("Fallback", "RUČNÍ", "nikdy automatický")

    with st.container(border=True):
        st.markdown("#### Connection")
        if configured:
            st.code(redact_postgres_dsn(pg_config.dsn), language=None)
            st.caption(
                f"Pool {pg_config.min_pool_size}–{pg_config.max_pool_size} · "
                f"connect timeout {pg_config.connect_timeout_s}s · schema {POSTGRES_SCHEMA_VERSION}"
            )
        else:
            st.warning("PostgreSQL DSN není nakonfigurovaný.")

    if st.button("Otestovat PostgreSQL spojení", disabled=not configured, width="stretch", key="pg_health_v073"):
        with st.spinner("Testuji PostgreSQL jedním diagnostickým dotazem…"):
            st.session_state["pg_health_result_v073"] = postgres_healthcheck(pg_config)
    health = st.session_state.get("pg_health_result_v073")
    if isinstance(health, dict):
        if health.get("ok"):
            st.success(f"Spojení OK · {health.get('database_name')} · PostgreSQL {health.get('server_version')}")
        else:
            st.error("PostgreSQL test selhal: " + str(health.get("error") or "neznámá chyba"))

    if is_pg_prod:
        st.success("PRODUCTION: PostgreSQL je jediný běžný source of truth Logbooku.")
        _render_runtime_performance(pg_config)
        _render_production_diagnostics(pg_config)
        with st.expander("Nouzový ruční návrat na SQLite", expanded=False):
            st.error(
                "Použij jen při skutečném incidentu. SQLite je zmrazený cutover baseline a po produkčních PostgreSQL zápisech není aktuální."
            )
            st.code(
                '[database]\n'
                'production_backend = "sqlite"\n'
                'cutover_confirm = "POSTGRESQL_PRODUCTION"\n'
                'fallback_confirm = "SQLITE_EMERGENCY_FALLBACK"',
                language="toml",
            )
            st.caption(
                "Pokud fallback dostane nový zápis, automatický návrat na PostgreSQL zůstává zablokovaný a vyžaduje ruční reconciliaci."
            )
        return

    _render_legacy_cutover(pg_config, configured, driver_ok)
