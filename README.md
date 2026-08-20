# Letový zápisník

Verze: **v0.53**

## v0.53 – Core Architecture Refactor

v0.53 navazuje přímo na v0.52 Deep UX / Performance Optimization. Cílem této verze není přidávání funkcí, ale vytvoření čistšího základu pro další vývoj bez změny chování aplikace a bez změny datového modelu letů.

### Co se změnilo

- základní konfigurace a cesty přesunuty do `logbook_core/config.py`
- SQLite schéma přesunuto do `logbook_core/schema.py`
- výpočty času, ceny a souhrnů přesunuty do `logbook_core/metrics.py`
- KML parser a GPS/track analýza přesunuty do `logbook_core/tracks.py`
- exportní logika přesunuta do `logbook_core/exports.py`
- globální UI theme/header/metric helpers přesunuty do `logbook_ui/theme.py`
- společné filtry přesunuty do `logbook_ui/filters.py`
- `app.py` je přibližně o 1 270 řádků menší než ve v0.52
- přidány regresní testy základních výpočtů a KML parseru
- přidána dokumentace architektury a čistého GitHub layoutu

### Co se záměrně nezměnilo

- `DB_SCHEMA_VERSION` zůstává 5
- žádná migrace nebo přepis `data/logbook.sqlite`
- Smooth Track Player zůstává funkčně stejný
- KML import zůstává funkčně stejný
- Dashboard, seznam letů, databáze, export a mapy zachovávají chování v0.52
- GPS Map Engine 2.0 není součástí v0.53

## Bezpečnost dat při uploadu

**Nepřepisovat ani nemazat `data/logbook.sqlite`.** Release ZIP tento soubor úmyslně neobsahuje. Při GitHub cleanupu se musí zachovat aktuální databáze z repozitáře.

## Test

```bash
python -m unittest tests/test_core_refactor.py
python -m py_compile app.py logbook_core/*.py logbook_ui/*.py
```

Podrobnosti: `ARCHITECTURE.md` a `UPLOAD_INSTRUCTIONS.md`.
