from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def test_sidebar_uses_double_minimal_chevrons():
    app = (ROOT / "app.py").read_text(encoding="utf-8")
    theme = (ROOT / "logbook_ui" / "theme.py").read_text(encoding="utf-8")
    assert app.count('class="lb-sidebar-chevron"') == 2
    assert "flex-direction:row" in theme
    assert "top:.82rem" in theme
    assert "font-size:1.72rem" in theme
