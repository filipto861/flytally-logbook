"""Logbook runtime startup hook.

v0.61.7 intentionally performs no global monkeypatching.
SQLite schema compatibility and audit repair are handled explicitly by the
application bootstrap and DB service layer.
"""
