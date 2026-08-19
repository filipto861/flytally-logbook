# Letový zápisník

Aktuální stabilní checkpoint: v0.31 s hotfixem map.

## Poslední opravy

- Sidebar je řešený jedním plynulým tlačítkem.
- Letiště jsou oddělená do pevné databáze `data/airports_full.sqlite`.
- ADSBexchange i Flightradar24 KML jsou kompatibilní.
- GPS tracky se vizuálně doplní přímkou k ručně zadanému letišti odletu/příletu.
- Orientační mapa letišť ukazuje navštívená letiště a direct spojnice letů.
- Folium mapy jsou runtime patchnuté tak, aby pan/zoom neposílal zbytečně stav zpět do Streamlitu a nezpůsoboval šedé překrytí.

## Bezpečnost dat

Nikdy ručně nepřepisovat:

- `data/logbook.sqlite`

Tento soubor obsahuje živé lety, tracky a ruční data.
