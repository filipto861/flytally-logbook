# Letový zápisník v0.32 – rychlost a přehlednost

## Co nahrát

Nejdůležitější soubory:

- `app.py`
- `sitecustomize.py`
- `README.md`

Celý ZIP je bezpečný k nahrání, protože neobsahuje `data/logbook.sqlite`.

## Co nepřepisovat

Nikdy ručně nepřepisovat:

- `data/logbook.sqlite`

Ten soubor obsahuje tvoje živé lety, tracky, ruční letiště a nastavení.

## Po nahrání

1. Streamlit Cloud → Manage app → Reboot app
2. V prohlížeči Ctrl + F5
3. Zkontrolovat verzi `v0.32`

## Hlavní změny

- mapy se renderují jako klientské HTML, bez rerunu při posunu a zoomu,
- tabulky pod mapami jsou v rozbalovacích sekcích,
- detail letu má přehlednější hlavičku,
- dashboard umí dočasně skrýt grafy pro rychlejší načtení,
- stabilní funkce v0.31.2 zůstávají zachované.
