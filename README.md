# Letový zápisník Streamlit

Verze: v0.45.1

## v0.45.1 – Optimalizace mapy GPS tracků

- GPS track mapa má nově volbu rozsahu: `Rychlá`, `Střední`, `Vše`.
- Výchozí režim `Rychlá` vykreslí posledních 60 GPS tracků a používá zjednodušené body pro mapu.
- Režim `Střední` vykreslí všechny tracky ve filtru s větším zjednodušením než plný KML.
- Režim `Vše` vykreslí všechny tracky ve filtru s vyšším detailem, ale může být pomalejší.
- Uložené KML tracky se nemění; zjednodušení platí jen pro mapové vykreslení.
- Zůstává v0.44 optimalizace: data se načítají podle aktivní stránky, export se generuje až po kliknutí a loader má bezpečnostní vypnutí.

## Důležité

Nepřepisovat produkční databázi `data/logbook.sqlite`.
