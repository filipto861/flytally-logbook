from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_dashboard_visual_css_is_inside_theme():
    text = (ROOT / "logbook_ui" / "theme.py").read_text(encoding="utf-8")
    assert ".dashboard-primary-card {{" in text
    assert ".dashboard-category-card {{" in text
    assert ".dashboard-stat-chip {{" in text
    assert ".dashboard-card-badge {{" in text
    assert ".dashboard-category-card.ull::before" in text
    assert ".dashboard-category-card.easa::before" in text


def test_dashboard_cards_use_rich_visual_structure():
    text = (ROOT / "app.py").read_text(encoding="utf-8")
    assert 'class="dashboard-card-badge">TOTAL</div>' in text
    assert 'class="dashboard-category-card ull"' in text
    assert 'class="dashboard-category-card easa"' in text
    assert 'class="dashboard-category-card pic-ull"' in text
    assert 'class="dashboard-category-card pic-easa"' in text
    assert text.count('class="dashboard-stat-chip"') >= 10


def test_dashboard_information_priority_is_unchanged():
    text = (ROOT / "app.py").read_text(encoding="utf-8")
    assert "Celkový čas" in text
    assert "PIC • ULL" in text
    assert "PIC • EASA" in text
    assert "Detailní statistiky" in text
