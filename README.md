# Letový zápisník

Verze: **v0.54**

## v0.54 – GPS / Map Engine 2.0

v0.54 navazuje na stabilní v0.53 Core Architecture Refactor. Tato verze přepracovává interní přípravu GPS dat pro mapy tak, aby výkon zůstal předvídatelný i s výrazně větším počtem letů a tracků. Uložená GPS data ani databázové schéma se nemění.

### Hlavní změny

- nový samostatný modul `logbook_core/map_engine.py`
- adaptivní render budget pro GPS overview mapu
  - **Rychlá:** max. 40 tracků, přibližně max. 4 400 GPS bodů v browser payloadu
  - **Střední:** max. 120 tracků, přibližně max. 14 400 bodů
  - **Vše:** všechny tracky, ale dynamický počet bodů na track s cílovým rozpočtem přibližně 24 000 bodů
- geometry-preserving simplifikace tracku místo prostého výběru každého N-tého bodu
  - vždy zachová první a poslední bod
  - prioritně zachovává zatáčky a změny tvaru trasy
  - má přesný horní limit počtu bodů
- dvoustupňové načítání overview mapy
  - SQLite načte pouze omezený počet kandidátních bodů z `track_points`
  - Map Engine 2.0 z kandidátů vybere geometricky nejdůležitější body
  - plný `coordinates_json` se používá pouze jako fallback u starých/neúplně migrovaných tracků
- sjednocený výpočet středu a zoomu map přes nový viewport helper
- Leaflet/Folium mapy používají canvas renderer pro efektivnější vykreslení většího počtu tras
- statická playback mapa používá stejnou geometry-preserving simplifikaci
- přidány samostatné regresní testy Map Engine 2.0

### Co zůstává beze změny

- `DB_SCHEMA_VERSION = 5`
- žádná migrace `data/logbook.sqlite`
- plné GPS tracky zůstávají v databázi beze změny
- výpočty GPS vzdálenosti používají plná data, nikoli zjednodušenou mapovou reprezentaci
- KML import zůstává funkčně stejný
- Smooth Track Player zůstává funkčně stejný
- filtry a režimy mapy zůstávají stejné
- Rychlá/Střední zachovávají dosavadní limit 40/120 tracků

## Bezpečnost dat při uploadu

**Nepřepisovat ani nemazat `data/logbook.sqlite`.** Release ZIP tento soubor úmyslně neobsahuje. Při kopírování v0.54 do lokálního Git repozitáře zůstane současná databáze na místě.

## Test

```bash
python -m unittest discover -s tests -v
python -m py_compile app.py logbook_core/*.py logbook_ui/*.py
```

Aktuální sada: **10 testů**.

Podrobnosti: `ARCHITECTURE.md` a `UPLOAD_INSTRUCTIONS.md`.
