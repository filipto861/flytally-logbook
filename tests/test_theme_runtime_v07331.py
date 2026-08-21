from logbook_core.config import APP_VERSION
import logbook_ui.theme as theme


def test_hotfix_version():
    assert APP_VERSION == "v0.73.3.2"


def test_apply_ui_theme_executes_for_dark_and_light(monkeypatch):
    rendered = []

    def fake_markdown(value, **kwargs):
        rendered.append((value, kwargs))

    monkeypatch.setattr(theme.st, "markdown", fake_markdown, raising=False)

    theme.apply_ui_theme(True)
    theme.apply_ui_theme(False)

    assert len(rendered) == 2
    assert all("dashboard-lite-chart" in html for html, _ in rendered)
    assert all(kwargs.get("unsafe_allow_html") is True for _, kwargs in rendered)


def test_dashboard_css_braces_are_literal_after_fstring_render(monkeypatch):
    rendered = []
    monkeypatch.setattr(theme.st, "markdown", lambda value, **kwargs: rendered.append(value), raising=False)
    theme.apply_ui_theme(True)
    html = rendered[0]
    assert ".dashboard-lite-chart {" in html
    assert ".dashboard-lite-bar {" in html
