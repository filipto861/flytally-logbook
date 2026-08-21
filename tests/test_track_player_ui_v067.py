from pathlib import Path

from logbook_core.config import APP_VERSION, DB_SCHEMA_VERSION

ROOT = Path(__file__).resolve().parents[1]


def _app():
    return (ROOT / "app.py").read_text(encoding="utf-8")


def test_version_without_schema_change():
    assert APP_VERSION == "v0.73.2"
    assert DB_SCHEMA_VERSION == 10


def test_player_uses_pure_payload_builder_and_cap():
    source = _app()
    assert "build_track_player_payload(" in source
    assert "max_points=2800" in source
    assert "st.iframe(html_doc, height=760)" in source


def test_player_uses_smooth_virtual_timeline():
    source = _app()
    start = source.index("def _track_player_html(")
    end = source.index("def render_track_playback(", start)
    block = source[start:end]

    assert 'max="10000"' in block
    assert "requestAnimationFrame(animationTick)" in block
    assert "cancelAnimationFrame(animationFrame)" in block
    assert "const hasTimeline =" in block
    assert "function locate(progress)" in block
    assert "const angleLerp =" in block


def test_profile_is_second_scrubber():
    source = _app()
    start = source.index("def _track_player_html(")
    end = source.index("def render_track_playback(", start)
    block = source[start:end]
    assert "profile.addEventListener('pointerdown'" in block
    assert "profile.addEventListener('pointermove'" in block
    assert "update(chartProgress(event.clientX))" in block


def test_follow_fit_and_speed_controls_exist():
    source = _app()
    assert 'id="follow">Sledovat letadlo</button>' in source
    assert 'id="fit">Celý let</button>' in source
    assert 'id="speed">1×</button>' in source
    assert "const playbackSpeeds = [1,2,4];" in source
    assert "map.on('dragstart', () => setFollow(false));" in source


def test_progress_polyline_does_not_rebuild_full_route_every_frame():
    source = _app()
    assert "const progressDone = L.polyline(" in source
    assert "const progressActive = L.polyline(" in source
    assert "if (sample.lower !== lastCompletedIndex)" in source
    assert "progressActive.setLatLngs([route[sample.lower], latLng]);" in source


def test_track_detail_explains_interaction():
    source = _app()
    assert "Tažením timeline nebo přímo grafu plynule posouváš let." in source
