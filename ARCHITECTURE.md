# Logbook architecture — v0.60.1

## Smart KML layer

Nový modul `logbook_core/smart_import.py` je analytická vrstva mezi KML parserem a uložením letu.

Parser `logbook_core.tracks.parse_kml_bytes()` zůstává odpovědný pouze za převod souboru na normalizované GPS body. Smart Import nad body provádí vyšší analýzu a nikdy nemění původní data bez explicitní volby uživatele.

## Analýza letových úseků

`analyze_track()` využívá:

- GPS groundspeed a jeho vyhlazenou hodnotu,
- časové značky,
- výšku jako doplňkový signál,
- délku letových úseků,
- dobu nízké rychlosti / zastavení,
- časové mezery mezi body.

Výstup obsahuje:

- `flight_count`,
- `split_candidates`,
- `touch_and_go_events`,
- `touch_and_go_count`,
- `landing_count`,
- `anomalies`.

## Split candidates

Rozdělení tracku je konzervativní návrh. Full-stop kandidát typicky vyžaduje dva věrohodné letové úseky a mezi nimi alespoň jeden z těchto signálů:

- delší pozemní mezera,
- několik sekund velmi nízké rychlosti / úplné zastavení,
- výrazná mezera v časových značkách.

`split_track_points()` původní body pouze rozdělí do částí; body nemaže a zachovává jejich pořadí.

## Touch-and-go

Krátký pozemní přechod bez úplného zastavení se klasifikuje jako touch-and-go místo samostatného letu. Druhý detektor hledá lokální minimum výšky mezi sestupem a následným stoupáním při zachované rychlosti.

Detekovaný počet se používá pouze jako výchozí hodnota pole `starts`; uživatel jej může změnit.

## Import workflow

Pro navržené rozdělení funguje import jako sekvenční wizard:

1. uživatel zvolí rozdělení nebo import jednoho letu,
2. případně upraví split index,
3. zkontroluje první část a uloží ji,
4. split body se uzamknou,
5. pokračuje další částí,
6. každý díl dostane vlastní flight + track záznam.

Tím se minimalizuje riziko, že po uložení prvního letu dojde ke změně dělicího bodu.

## Security boundary

Všechny nové lety a tracky stále používají `strict_user_id(current_user_id())` a stávající ownership kontroly z v0.59. Smart Import nijak neobchází tenant boundary.

## Persistence

- `DB_SCHEMA_VERSION = 8`
- bez strukturální migrace,
- SQLite + GitHub backup zůstává dočasným persistence modelem.
