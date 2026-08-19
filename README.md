# Letový zápisník v0.31.2

Hotfix výkonu map.

## Změny

- Mapy jsou nově vykreslené jako read-only komponenty bez vracení pan/zoom/click stavu zpět do Streamlitu.
- Pohyb mapou už nemá spouštět zbytečný rerun celé stránky.
- Tím mizí šedé/zatmavené překrytí a mapa je při posunu/zoomování výrazně plynulejší.
- Zachována orientační mapa letišť z v0.31 i doplnění GPS tracku k letištím.
- Zachována kompatibilita ADSBexchange i Flightradar24 KML.

## Bezpečnost dat

Balíček záměrně neobsahuje `data/logbook.sqlite`, aby nedošlo k přepsání živé databáze letů.
