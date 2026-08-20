from __future__ import annotations

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.py"


def _source() -> str:
    return APP.read_text(encoding="utf-8")


def _functions() -> set[str]:
    tree = ast.parse(_source())
    return {node.name for node in tree.body if isinstance(node, ast.FunctionDef)}


def test_v061_import_review_helpers_exist() -> None:
    functions = _functions()
    assert "render_import_stepper" in functions
    assert "render_import_final_review" in functions
    assert "_single_import_review_key" in functions
    assert "_split_import_review_key" in functions


def test_kml_import_has_final_review_stage() -> None:
    source = _source()
    assert "Pokračovat na finální kontrolu" in source
    assert "Finální kontrola před uložením" in source
    assert "Ještě se nic neuložilo" in source
    assert "← Upravit údaje" in source


def test_split_import_reviews_each_part_before_save() -> None:
    source = _source()
    assert "Finální kontrola · let {progress + 1} z {len(parts)}" in source
    assert "split_import_review_" in source


def test_streamlit_deprecations_removed_from_app_calls() -> None:
    source = _source()
    assert "streamlit.components.v1" not in source
    assert "components.html(" not in source
    assert "use_container_width=" not in source


def test_branding_favicon_is_configured() -> None:
    source = _source()
    assert 'page_icon="assets/logbook_icon_32.png"' in source
