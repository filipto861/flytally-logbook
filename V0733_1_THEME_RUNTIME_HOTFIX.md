# v0.73.3.1 – Theme Runtime Hotfix

## Incident

v0.73.3 introduced a lightweight HTML/CSS Dashboard chart. Its CSS was placed inside an existing Python f-string, but eight new CSS rule braces were not escaped. Python therefore interpreted the CSS body as an f-string format specifier and raised `ValueError` when `apply_ui_theme()` executed.

The failure occurred during authentication-page theme rendering, before normal application navigation. PostgreSQL data was not the cause.

## Fix

- escaped the eight new Dashboard CSS rule braces (`{{` / `}}`)
- added regression coverage that executes `apply_ui_theme()` in both dark and light mode
- added a rendered-CSS assertion for the new Dashboard chart rules
- removed a Python 3.14 `return in finally` warning from PostgreSQL connection cleanup without changing pool semantics

## Database

No new database migration. The v0.73.3 automatic schema targets remain:

- PostgreSQL schema/foundation 2
- SQLite fallback schema 11

The schema upgrade is idempotent, so a partially started v0.73.3 deployment is safe to follow with v0.73.3.1.

## Validation

- full regression suite passes
- theme runtime path is executed by tests
- all Python sources compile with `SyntaxWarning` treated as an error
