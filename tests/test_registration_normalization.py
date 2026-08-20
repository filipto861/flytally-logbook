from logbook_core.metrics import normalize_registration


def test_normalize_registration_handles_none_and_blank():
    assert normalize_registration(None) == ""
    assert normalize_registration("") == ""
    assert normalize_registration("  ok-bin ") == "OK-BIN"
