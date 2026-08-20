# Upload v0.53 / GitHub cleanup

## Doporučený postup

Repozitář **není potřeba zakládat znovu**. Pro v0.53 je vhodné udělat jeden čistý cleanup commit, který nahradí pracovní strom novou strukturou, ale zachová Git historii.

### Kritické pravidlo

**Zachovat stávající `data/logbook.sqlite`.** Tento soubor obsahuje živá data a release ZIP jej neobsahuje.

## Cílový obsah repozitáře

```text
.github/
.streamlit/
.gitignore
ARCHITECTURE.md
README.md
UPLOAD_INSTRUCTIONS.md
app.py
data/
  Zapisnik_letu_source.xlsx
  airport_overrides.csv
  airports.csv
  airports_full.sqlite
  logbook.sqlite              <- ponechat existující verzi z GitHubu
logbook_core/
logbook_ui/
requirements.txt
scripts/
sitecustomize.py
tests/
```

## Odstranit staré duplicity z rootu

Pokud jsou stále trackované, odstranit zejména:

- `__pycache__/`
- `*.pyc`
- root `airports.csv`
- root `airports_full.sqlite`
- root `airport_overrides.csv`
- root `Zapisnik_letu_source.xlsx`
- root `config.toml`
- root `import_airports.py`, `import_excel.py`, `seed_airports_full.py`
- `download`
- jiné staré kopie souborů, které už existují v `data/` nebo `scripts/`

## Důležité k velikosti GitHub repozitáře

Smazání starých souborů v novém commitu vyčistí aktuální pracovní strom, ale staré velké soubory zůstávají v Git historii. Proto se tím automaticky nevynuluje historická velikost repozitáře. Pro běžný provoz to nevadí; přepis historie nebo nový repozitář není pro v0.53 potřeba.

## Po nasazení

1. Ověřit badge `v0.53`.
2. Otevřít Dashboard a seznam letů.
3. Otevřít detail letu s GPS trackem a vyzkoušet Smooth Track Player.
4. Importovat jeden testovací KML.
5. Ověřit editaci letu a automatickou GitHub zálohu `data/logbook.sqlite`.
6. Ověřit Export do XLSX.
