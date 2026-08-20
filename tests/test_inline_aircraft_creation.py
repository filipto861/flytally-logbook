from __future__ import annotations

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.py"


def _tree() -> ast.Module:
    return ast.parse(APP.read_text(encoding="utf-8"))


def test_inline_aircraft_dialog_and_helpers_exist() -> None:
    functions = {node.name for node in _tree().body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))}
    assert "inline_aircraft_create_dialog" in functions
    assert "_aircraft_profile_exists" in functions
    assert "_prompt_inline_aircraft_profile" in functions


def test_flight_form_can_prompt_for_missing_aircraft() -> None:
    fn = next(node for node in _tree().body if isinstance(node, ast.FunctionDef) and node.name == "flight_form")
    kw_names = [arg.arg for arg in fn.args.kwonlyargs]
    assert "prompt_missing_aircraft" in kw_names
    idx = kw_names.index("prompt_missing_aircraft")
    default = fn.args.kw_defaults[idx]
    assert isinstance(default, ast.Constant) and default.value is True


def test_inline_dialog_keeps_escape_hatch() -> None:
    source = APP.read_text(encoding="utf-8")
    assert "Vytvořit profil a pokračovat" in source
    assert "Pokračovat bez profilu" in source
    assert "Vrátit se k formuláři" in source
    assert "KML, mapa, detekované časy" in source


def test_edit_existing_flight_does_not_force_aircraft_profile() -> None:
    source = APP.read_text(encoding="utf-8")
    assert 'quick_tools=False, prompt_missing_aircraft=False' in source
