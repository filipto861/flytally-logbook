# Upload v0.69.1

1. Zachovej lokální `.git` a `data/logbook.sqlite`.
2. Nahraď aplikační soubory obsahem tohoto balíčku.
3. Zkontroluj, že `data/logbook.sqlite` zůstalo na místě a není mezi změněnými/smazanými soubory.
4. Otevři GitHub Desktop.
5. Pokud je na remote novější auto-backup databáze, použij nejdřív `Fetch` a `Pull origin`.
6. Commit doporučený jako:
   `v0.62.2 - Sidebar UX Final Polish`
7. `Push origin`.
8. Po redeployi ověř zejména:
   - minimalistický dvojitý chevron na hraně sidebaru,
   - plynulé skrytí i odkrytí sidebaru,
   - favicon,
   - single KML import až po finální kontrolu,
   - tlačítko Upravit údaje,
   - split KML a review každé části,
   - inline vytvoření chybějícího letadla,
   - touch-and-go count.

Release ZIP neobsahuje `data/logbook.sqlite`.


### v0.62.2 note
`sitecustomize.py` is no longer part of the application from v0.69.1 onward. Remove any old copy from the repository if one is still present; the app no longer uses a Python startup hook.


### v0.62.2 smoke test
Po deployi ověř Dashboard pro `Vše`, `Tento rok` a `Posledních 12 měsíců`, následně projdi Přehled, Letadla, Letiště a trasy, Náklady a Poslední lety. `data/logbook.sqlite` se nemění.

### v0.69.1 smoke test

1. Zachovej `.git` a `data/logbook.sqlite`.
2. Nahraď aplikační soubory obsahem release ZIPu.
3. Po deployi ověř novou položku **Recency** v sidebaru.
4. Ověř poslední let/přistání a 30/90/365 denní tabulku.
5. Přidej testovací termín platnosti, uprav ho a odstraň ho.
6. Ověř, že druhý uživatel termín prvního uživatele nevidí.
7. Doporučený commit: `v0.69.1 - Pilot Currency & Recency`.


### v0.69.1
No database migration is required (`DB_SCHEMA_VERSION = 9`). The release ZIP still excludes `data/logbook.sqlite`. Upload the new `logbook_core/portability.py` together with the other changed files.


### v0.69.1
No database migration is required (`DB_SCHEMA_VERSION = 9`). Upload the new `logbook_core/flight_entry.py`. The release ZIP does not contain `data/logbook.sqlite`.


### v0.69.1
No database migration is required (`DB_SCHEMA_VERSION = 9`). Upload the new `logbook_core/logbook_view.py`. The release ZIP still excludes `data/logbook.sqlite`.


### v0.69.1
No database migration is required (`DB_SCHEMA_VERSION = 9`). Upload the new `logbook_core/track_player.py`. The release ZIP still excludes `data/logbook.sqlite`.


### v0.69.1
No database migration is required (`DB_SCHEMA_VERSION = 9`). Upload the new `logbook_core/data_quality.py`. The release ZIP still excludes `data/logbook.sqlite`.


### v0.69.1
`DB_SCHEMA_VERSION` changes from 9 to 10. This is a lightweight migration: no user data table is rebuilt; tenant guard triggers and an audit index are created idempotently on startup. Upload the new `logbook_core/sqlite_runtime.py`. The release ZIP still excludes `data/logbook.sqlite`.


### v0.69.1
No database migration is required. `DB_SCHEMA_VERSION` remains 10. This is a navigation/runtime hotfix on top of v0.69.
