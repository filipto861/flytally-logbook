from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def test_sidebar_toggle_lives_at_top_inside_open_sidebar():
    text = (ROOT / "logbook_ui" / "theme.py").read_text(encoding="utf-8")
    assert "top:.82rem" in text
    assert "left:calc(var(--lb-sidebar-width) - 3.35rem)" in text
    assert "flex-direction:row" in text
    assert "font-size:1.72rem" in text
    assert "gap:.13rem" in text

def test_sidebar_toggle_remains_available_when_closed():
    text = (ROOT / "logbook_ui" / "theme.py").read_text(encoding="utf-8")
    assert "body.lb-sidebar-hidden #lb-sidebar-toggle" in text
    assert "left:.28rem" in text

def test_sidebar_toggle_renders_two_chevrons():
    text = (ROOT / "app.py").read_text(encoding="utf-8")
    assert text.count('class="lb-sidebar-chevron" aria-hidden="true">‹</span>') >= 2
