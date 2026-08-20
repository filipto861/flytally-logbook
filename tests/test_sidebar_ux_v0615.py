from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def test_sidebar_uses_double_minimal_chevrons():
    app = (ROOT / "app.py").read_text(encoding="utf-8")
    theme = (ROOT / "logbook_ui" / "theme.py").read_text(encoding="utf-8")
    assert app.count('class="lb-sidebar-chevron"') == 2
    assert "top:31vh" in theme
    assert "border:0 !important" in theme
    assert "background:transparent !important" in theme
    assert "box-shadow:none !important" in theme

def test_sidebar_click_does_not_rerun_streamlit():
    app = (ROOT / "app.py").read_text(encoding="utf-8")
    block = app.split("def render_sidebar_toggle() -> None:", 1)[1].split("def render_page_transition_runtime()", 1)[0]
    assert "st.rerun" not in block
    assert "requestAnimationFrame" in block
    assert "lb-sidebar-hidden" in block
