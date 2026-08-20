from pathlib import Path


def test_sidebar_toggle_is_streamlit_managed_button():
    text = (Path(__file__).resolve().parents[1] / "app.py").read_text(encoding="utf-8")
    start = text.index("def render_sidebar_toggle()")
    end = text.index("def render_page_transition_runtime()", start)
    block = text[start:end]
    assert '<button id="lb-sidebar-toggle"' in block
    assert "doc.body.appendChild(btn)" not in block
    assert "btn.onclick" in block
    assert "lb-sidebar-hidden" in block
    assert 'width="content"' in block
    assert "unsafe_allow_javascript=True" in block
