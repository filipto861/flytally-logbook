from pathlib import Path


def _app_source() -> str:
    return (Path(__file__).resolve().parents[1] / "app.py").read_text(encoding="utf-8")


def test_invisible_runtime_uses_non_iframed_st_html():
    app = _app_source()
    for fn in (
        "render_sidebar_toggle",
        "render_page_transition_runtime",
        "render_page_loaded_signal",
    ):
        start = app.index(f"def {fn}()")
        end = app.find("\ndef ", start + 5)
        block = app[start:] if end == -1 else app[start:end]
        assert "st.html(" in block
        assert "unsafe_allow_javascript=True" in block
        assert "st.iframe(" not in block
        assert "width=1" not in block
        assert "height=1" not in block


def test_runtime_javascript_uses_current_document_not_parent_iframe():
    app = _app_source()
    runtime = app[app.index("def render_sidebar_toggle()") : app.index("# -----------------------------------------------------------------------------\n# Main")]
    assert "const doc = document;" in runtime
    assert "window.parent.document" not in runtime
    assert "window.parent.localStorage" not in runtime
