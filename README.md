# Letový zápisník Streamlit

Verze: v0.47

## v0.47 – Stabilita / kontrola dat / servisní nástroje

- Nová záložka `Databáze → Kontrola`.
- Ruční hloubková kontrola databáze bez zbytečného zpomalování běžného otevření stránky.
- Kontrola SQLite integrity a foreign keys.
- Detekce podezřelých duplicit letů.
- Detekce chybějících základních údajů, sazeb a časových anomálií.
- Kontrola registrací bez profilu letadla.
- Kontrola neznámých letišť / ploch proti lokální i světové databázi.
- Diagnostika GPS tracků: tracky bez bodů, nesoulad `point_count`, neplatné GPS body, osiřelé body, neplatný JSON.
- Admin servisní akce: bezpečná normalizace registrací/letišť, doplnění startů, doplnění účtování, doplnění letadel z existujících letů a backfill `track_points`.
- Samostatné `SQLite optimize` pro lehkou údržbu databáze.

## Důležité

Nepřepisovat produkční databázi `data/logbook.sqlite`.
