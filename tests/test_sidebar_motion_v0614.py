from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def test_sidebar_motion_uses_shared_smooth_timing():
    text = (ROOT / "logbook_ui" / "theme.py").read_text(encoding="utf-8")
    assert "--lb-sidebar-motion:390ms cubic-bezier(.16,1,.3,1)" in text
    assert "transition:margin-left var(--lb-sidebar-motion)" in text
    assert "transition:left var(--lb-sidebar-motion)" in text
    assert "prefers-reduced-motion" in text

def test_runtime_dependencies_are_stable():
    req = (ROOT / "requirements.txt").read_text(encoding="utf-8")
    assert "streamlit==1.62.0" in req
    assert "pyarrow>=24,<25" in req
