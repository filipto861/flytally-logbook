"""Runtime compatibility patches for Streamlit Cloud SQLite deployments.

This module is imported automatically by Python. It keeps older SQLite schemas
compatible, self-heals the airport table from data/airports.csv, and replaces
Streamlit's sidebar controls with one smooth custom toggle.
"""
from __future__ import annotations

import csv
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_ORIGINAL_CONNECT = sqlite3.connect
_AIRPORTS_SEED_CHECKED = False

SIDEBAR_WIDTH = "16.4rem"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _columns(conn: sqlite3.Connection, table: str) -> set[str]:
    try:
        return {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    except Exception:
        return set()


def _add_column_if_missing(conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    if column not in _columns(conn, table):
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def _ensure_app_meta_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TEXT
        )
        """
    )


def _set_meta(conn: sqlite3.Connection, key: str, value: str) -> None:
    try:
        _ensure_app_meta_schema(conn)
        conn.execute(
            "INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)",
            (key, value, _now_iso()),
        )
    except Exception:
        pass


def _ensure_audit_schema(conn: sqlite3.Connection) -> None:
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                actor TEXT,
                action TEXT,
                object_type TEXT,
                object_id TEXT,
                detail_json TEXT
            )
            """
        )
        _add_column_if_missing(conn, "audit_log", "actor", "actor TEXT")
        _add_column_if_missing(conn, "audit_log", "action", "action TEXT")
        _add_column_if_missing(conn, "audit_log", "object_type", "object_type TEXT")
        _add_column_if_missing(conn, "audit_log", "object_id", "object_id TEXT")
        _add_column_if_missing(conn, "audit_log", "detail_json", "detail_json TEXT")
        _add_column_if_missing(conn, "audit_log", "user", "user TEXT")
        _add_column_if_missing(conn, "audit_log", "entity", "entity TEXT")
        _add_column_if_missing(conn, "audit_log", "entity_id", "entity_id TEXT")
        _add_column_if_missing(conn, "audit_log", "detail", "detail TEXT")
    except Exception:
        pass


def _ensure_airports_schema(conn: sqlite3.Connection) -> None:
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS airports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ident TEXT NOT NULL UNIQUE,
                name TEXT,
                airport_type TEXT,
                iso_country TEXT,
                iso_region TEXT,
                municipality TEXT,
                latitude_deg REAL,
                longitude_deg REAL,
                elevation_ft REAL,
                gps_code TEXT,
                iata_code TEXT,
                local_code TEXT,
                source TEXT,
                active INTEGER DEFAULT 1,
                closed INTEGER DEFAULT 0,
                data_quality TEXT,
                imported_at TEXT,
                updated_at TEXT,
                raw_json TEXT
            )
            """
        )
        for column, ddl in [
            ("name", "name TEXT"),
            ("airport_type", "airport_type TEXT"),
            ("iso_country", "iso_country TEXT"),
            ("iso_region", "iso_region TEXT"),
            ("municipality", "municipality TEXT"),
            ("latitude_deg", "latitude_deg REAL"),
            ("longitude_deg", "longitude_deg REAL"),
            ("elevation_ft", "elevation_ft REAL"),
            ("gps_code", "gps_code TEXT"),
            ("iata_code", "iata_code TEXT"),
            ("local_code", "local_code TEXT"),
            ("source", "source TEXT"),
            ("active", "active INTEGER DEFAULT 1"),
            ("closed", "closed INTEGER DEFAULT 0"),
            ("data_quality", "data_quality TEXT"),
            ("imported_at", "imported_at TEXT"),
            ("updated_at", "updated_at TEXT"),
            ("raw_json", "raw_json TEXT"),
        ]:
            _add_column_if_missing(conn, "airports", column, ddl)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_airports_ident ON airports(ident)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_airports_country ON airports(iso_country)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_airports_active ON airports(active, closed)")
    except Exception:
        pass


def _float_or_none(value: Any) -> float | None:
    try:
        text = str(value or "").strip()
        return float(text) if text else None
    except Exception:
        return None


def _seed_airports_from_csv(conn: sqlite3.Connection) -> None:
    """Import bundled data/airports.csv into SQLite if the DB only has manual rows."""
    global _AIRPORTS_SEED_CHECKED
    if _AIRPORTS_SEED_CHECKED:
        return

    _ensure_app_meta_schema(conn)
    _ensure_airports_schema(conn)
    try:
        count = int(conn.execute("SELECT COUNT(*) FROM airports").fetchone()[0])
    except Exception:
        return

    if count >= 1000:
        _AIRPORTS_SEED_CHECKED = True
        return

    csv_path = Path(__file__).resolve().parent / "data" / "airports.csv"
    if not csv_path.exists():
        _set_meta(conn, "airports_auto_seed_error", "data/airports.csv not found")
        try:
            conn.commit()
        except Exception:
            pass
        return

    rows: list[tuple[Any, ...]] = []
    now = _now_iso()
    try:
        with csv_path.open("r", encoding="utf-8-sig", newline="") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                ident = (row.get("ident") or "").strip().upper()
                if not ident:
                    continue
                lat = _float_or_none(row.get("latitude_deg"))
                lon = _float_or_none(row.get("longitude_deg"))
                if lat is None or lon is None:
                    continue
                airport_type = (row.get("type") or row.get("airport_type") or "").strip()
                closed = 1 if airport_type == "closed" else 0
                active = 0 if closed else 1
                rows.append((
                    ident,
                    row.get("name"),
                    airport_type,
                    row.get("iso_country"),
                    row.get("iso_region"),
                    row.get("municipality"),
                    lat,
                    lon,
                    _float_or_none(row.get("elevation_ft")),
                    row.get("gps_code"),
                    row.get("iata_code"),
                    row.get("local_code") or ident,
                    "ourairports_csv",
                    active,
                    closed,
                    "ourairports_public_domain",
                    now,
                    now,
                    None,
                ))
        conn.executemany(
            """
            INSERT OR IGNORE INTO airports
            (ident, name, airport_type, iso_country, iso_region, municipality,
             latitude_deg, longitude_deg, elevation_ft, gps_code, iata_code,
             local_code, source, active, closed, data_quality, imported_at,
             updated_at, raw_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
        final_count = int(conn.execute("SELECT COUNT(*) FROM airports").fetchone()[0])
        _set_meta(conn, "airports_auto_seeded", "1")
        _set_meta(conn, "airports_auto_seeded_rows", str(len(rows)))
        _set_meta(conn, "airports_count_after_seed", str(final_count))
        _set_meta(conn, "dirty", "1")
        conn.commit()
        _AIRPORTS_SEED_CHECKED = True
        try:
            import streamlit as st
            st.cache_data.clear()
        except Exception:
            pass
    except Exception as exc:
        try:
            conn.rollback()
            _set_meta(conn, "airports_auto_seed_error", str(exc)[:500])
            conn.commit()
        except Exception:
            pass


class PatchedConnection(sqlite3.Connection):
    def execute(self, sql, parameters=(), /):  # type: ignore[override]
        try:
            return super().execute(sql, parameters)
        except sqlite3.OperationalError:
            if isinstance(sql, str) and "audit_log" in sql:
                _ensure_audit_schema(self)
                return super().execute(sql, parameters)
            raise

    def executescript(self, sql_script: str, /):  # type: ignore[override]
        result = super().executescript(sql_script)
        if isinstance(sql_script, str) and "CREATE TABLE IF NOT EXISTS airports" in sql_script:
            try:
                _seed_airports_from_csv(self)
            except Exception:
                pass
        return result


def connect(*args, **kwargs):
    kwargs.setdefault("factory", PatchedConnection)
    conn = _ORIGINAL_CONNECT(*args, **kwargs)
    try:
        _ensure_audit_schema(conn)
        _seed_airports_from_csv(conn)
    except Exception:
        pass
    return conn


sqlite3.connect = connect


# -----------------------------------------------------------------------------
# Streamlit UI patch
# -----------------------------------------------------------------------------

_TOGGLE_COMPONENT = f"""
<script>
(function() {{
  const doc = window.parent.document;
  const SIDEBAR_WIDTH = '{SIDEBAR_WIDTH}';
  const STYLE_ID = 'logbook-smooth-sidebar-style';
  const BUTTON_ID = 'logbook-smooth-sidebar-toggle';
  const STORAGE_KEY = 'logbook_sidebar_hidden_v2';

  function ensureStyle() {{
    let style = doc.getElementById(STYLE_ID);
    if (!style) {{
      style = doc.createElement('style');
      style.id = STYLE_ID;
      doc.head.appendChild(style);
    }}
    style.textContent = `
      :root {{ --lb-sidebar-width: ${{SIDEBAR_WIDTH}}; }}
      header[data-testid="stHeader"] {{ height:0 !important; min-height:0 !important; background:transparent !important; pointer-events:none !important; overflow:visible !important; }}
      div[data-testid="stToolbar"], div[data-testid="stDecoration"], div[data-testid="stStatusWidget"], #MainMenu, footer {{ display:none !important; visibility:hidden !important; height:0 !important; }}
      [data-testid="stSidebarHeader"],
      [data-testid="stSidebarCollapseButton"],
      [data-testid="stSidebarCollapsedControl"],
      [data-testid="collapsedControl"],
      button[title*="sidebar" i],
      button[aria-label*="sidebar" i],
      section[data-testid="stSidebar"] button[kind="headerNoPadding"],
      section[data-testid="stSidebar"] button[data-testid="baseButton-headerNoPadding"] {{ display:none !important; visibility:hidden !important; pointer-events:none !important; width:0 !important; height:0 !important; padding:0 !important; margin:0 !important; }}
      section[data-testid="stSidebar"] {{ display:block !important; visibility:visible !important; transform:translateX(0) !important; opacity:1 !important; width:var(--lb-sidebar-width) !important; min-width:var(--lb-sidebar-width) !important; max-width:var(--lb-sidebar-width) !important; transition: margin-left 280ms cubic-bezier(.22,.61,.36,1), opacity 180ms ease !important; will-change: margin-left; }}
      body.logbook-sidebar-hidden section[data-testid="stSidebar"] {{ margin-left: calc(-1 * var(--lb-sidebar-width)) !important; opacity:.98 !important; }}
      body.logbook-sidebar-hidden [data-testid="stAppViewContainer"] > .main {{ margin-left: 0 !important; }}
      #${{BUTTON_ID}} {{ position:fixed; top:5.35rem; left:calc(var(--lb-sidebar-width) - 2.55rem); z-index:2147483647; width:1.78rem; height:1.78rem; border-radius:.56rem; border:1px solid rgba(148,163,184,.35); background:rgba(15,31,52,.96); color:#dbeafe; font-weight:900; font-size:1.05rem; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 8px 22px rgba(0,0,0,.28); transition:left 280ms cubic-bezier(.22,.61,.36,1), background 140ms ease, border-color 140ms ease; }}
      #${{BUTTON_ID}}:hover {{ background:rgba(20,43,72,.99); border-color:rgba(56,189,248,.55); }}
      body.logbook-sidebar-hidden #${{BUTTON_ID}} {{ left:.45rem; }}
      @media (max-width: 760px) {{ #${{BUTTON_ID}} {{ top:4.65rem; left:calc(var(--lb-sidebar-width) - 2.45rem); }} body.logbook-sidebar-hidden #${{BUTTON_ID}} {{ left:.30rem; }} }}
    `;
  }}

  function ensureButton() {{
    let btn = doc.getElementById(BUTTON_ID);
    if (!btn) {{
      btn = doc.createElement('button');
      btn.id = BUTTON_ID;
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Skrýt nebo zobrazit menu');
      btn.title = 'Skrýt / zobrazit menu';
      doc.body.appendChild(btn);
      btn.addEventListener('click', function(ev) {{
        ev.preventDefault();
        const hidden = !doc.body.classList.contains('logbook-sidebar-hidden');
        setHidden(hidden);
      }});
    }}
    return btn;
  }}

  function setHidden(hidden) {{
    doc.body.classList.toggle('logbook-sidebar-hidden', hidden);
    try {{ window.parent.localStorage.setItem(STORAGE_KEY, hidden ? '1' : '0'); }} catch(e) {{}}
    const btn = ensureButton();
    btn.textContent = hidden ? '›' : '‹';
  }}

  ensureStyle();
  const saved = (function() {{ try {{ return window.parent.localStorage.getItem(STORAGE_KEY) === '1'; }} catch(e) {{ return false; }} }})();
  setHidden(saved);
  setTimeout(ensureStyle, 300);
  setTimeout(ensureStyle, 1200);
}})();
</script>
"""


def _patch_streamlit_ui() -> None:
    try:
        import streamlit as st
        import streamlit.components.v1 as components
    except Exception:
        return
    if getattr(st, "_logbook_smooth_sidebar_patch_applied", False):
        return

    original_button = st.button
    original_markdown = st.markdown
    original_set_page_config = st.set_page_config

    def patched_set_page_config(*args, **kwargs):
        try:
            # Old versions used this session flag and caused hard show/hide reruns.
            # The new sidebar toggle is CSS/DOM-only, so keep the Streamlit state open.
            st.session_state["sidebar_hidden"] = False
        except Exception:
            pass
        return original_set_page_config(*args, **kwargs)

    def patched_button(label, *args, **kwargs):
        if kwargs.get("key") in {"hide_manual_sidebar", "show_manual_sidebar"}:
            return False
        return original_button(label, *args, **kwargs)

    def inject_toggle_once() -> None:
        if getattr(st, "_logbook_smooth_sidebar_component_injected", False):
            return
        st._logbook_smooth_sidebar_component_injected = True
        try:
            components.html(_TOGGLE_COMPONENT, height=0, width=0)
        except Exception:
            pass

    def patched_markdown(body, *args, **kwargs):
        result = original_markdown(body, *args, **kwargs)
        inject_toggle_once()
        return result

    st.set_page_config = patched_set_page_config
    st.button = patched_button
    st.markdown = patched_markdown
    st._logbook_smooth_sidebar_patch_applied = True


_patch_streamlit_ui()
