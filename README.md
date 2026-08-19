# Letový zápisník Streamlit

Verze: v0.46

## v0.46 – Hloubková optimalizace a stabilita

- GPS přehledová mapa už pro běžné vykreslení nenačítá plné `coordinates_json` všech tracků.
- Pro mapu se načítají nejdříve pouze metadata tracků a až potom vzorkované body z normalizované tabulky `track_points`.
- Režim `Rychlá` je nově agresivnější: méně tracků a méně bodů pro rychlejší otevření mapy.
- Režim `Střední` zůstává jako praktičtější kompromis pro širší přehled.
- Režim `Vše` zůstává dostupný, ale stále je určený pro situace, kdy je opravdu potřeba vykreslit celý filtr.
- Doplněna migrace chybějících `track_points` pro starší/importované KML tracky.
- Uložené KML soubory a detail jednotlivého letu zůstávají beze změny.

## Důležité

Nepřepisovat produkční databázi `data/logbook.sqlite`.
