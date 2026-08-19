# Letový zápisník

Aktuální checkpoint: **v0.33 – Smooth navigation & map performance**.

## Hlavní změny v0.33

- Plynulejší přechod mezi stránkami přes front-end loader.
- Přechod z `Lety` do `Mapa` už nemá vizuálně rozpadat starý obsah po částech.
- Mapa už nevykresluje GPS tracky a orientační direct mapu současně.
- Na stránce `Mapa` se nejdřív vybere typ mapy a generuje se jen aktivní vrstva.
- Mapové HTML je cachované podle aktuálních dat a filtru.
- Přímá mapa letišť používá rychlejší lookup souřadnic pouze z nutných sloupců letišť.
- Zachováno: sidebar, letištní databáze, ADSBexchange/FR24 KML, doplnění GPS tracku k letišti.

## Bezpečnost dat

Nikdy ručně nepřepisovat:

- `data/logbook.sqlite`

Tento soubor obsahuje živé lety, tracky, ruční letiště, ceník a audit.

Pevná světová letištní databáze je odděleně v:

- `data/airports_full.sqlite`
