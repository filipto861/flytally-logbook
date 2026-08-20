from pathlib import Path


def test_runtime_iframes_never_use_zero_dimensions():
    app = (Path(__file__).resolve().parents[1] / "app.py").read_text(encoding="utf-8")
    assert "width=0" not in app
    assert "height=0" not in app
    # Sidebar/page-transition runtime components intentionally stay effectively
    # invisible while satisfying Streamlit >=1.62 positive-width validation.
    assert app.count("width=1") >= 3
    assert app.count("height=1") >= 3
