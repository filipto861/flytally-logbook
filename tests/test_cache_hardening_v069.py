from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_scoped_cache_invalidation_uses_user_keys():
    text = (ROOT / 'app.py').read_text(encoding='utf-8')
    block = text[text.index('def invalidate_cached_data'):text.index('def require_admin')]
    assert '_clear_cached_function("read_flights", uid)' in block
    assert '_clear_cached_function("read_table", "flights", uid)' in block
    assert '_clear_cached_function("read_aircraft_catalog", True, uid)' in block
    assert '_clear_cached_function("read_aircraft_catalog", False, uid)' in block
    assert 'st.cache_data.clear()' in block  # retained only for full restore/global reset


def test_stale_removed_cache_names_are_not_in_invalidator():
    text = (ROOT / 'app.py').read_text(encoding='utf-8')
    block = text[text.index('def invalidate_cached_data'):text.index('def require_admin')]
    assert 'read_tracks_joined' not in block
    assert 'read_tracks_joined_for_flights' not in block


def test_world_airport_ident_lookup_is_index_friendly():
    text = (ROOT / 'app.py').read_text(encoding='utf-8')
    coords = text[text.index('def airport_coords_for_idents'):text.index('def airport_search_index')]
    assert 'WHERE ident IN (' in coords
    assert 'UPPER(TRIM(ident)) IN' not in coords
