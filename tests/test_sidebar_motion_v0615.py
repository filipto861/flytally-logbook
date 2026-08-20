from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def test_sidebar_motion_uses_compositor_friendly_timing():
    text = (ROOT / "logbook_ui" / "theme.py").read_text(encoding="utf-8")
    assert "--lb-sidebar-motion:320ms cubic-bezier(.22,.61,.36,1)" in text
    assert "transition:margin-left var(--lb-sidebar-motion)" in text
    assert "transition:left var(--lb-sidebar-motion)" in text
    assert "transform:translate3d(0,0,0)" in text
    assert "background:transparent !important" in text
    assert ".lb-sidebar-chevron" in text
    assert "prefers-reduced-motion" in text

def test_runtime_dependencies_are_stable():
    req = (ROOT / "requirements.txt").read_text(encoding="utf-8")
    assert "streamlit==1.62.0" in req
    assert "pyarrow>=24,<25" in req
