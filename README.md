# Letový zápisník

Verze: v0.52

## v0.52 – Deep UX / Performance Optimization

Tato verze je zaměřená na rychlost, stabilitu a omezení zbytečných Streamlit rerun nákladů bez změny datového modelu letů.

- Dashboard, Databáze a Export používají lazy sekce: vykresluje se jen právě otevřená část místo všech skrytých tabů
- Databáze už při otevření nenačítá celý světový registr letišť, audit log ani ceník, pokud nejsou potřeba
- seznam letišť nenačítá těžký `raw_json`; CSV export se generuje až na vyžádání
- audit log načítá jen posledních 500 záznamů
- vyhledání nejbližšího letiště při KML importu používá přednačtený minimální NumPy index a prostorový prefilter
- mapové pomocné funkce načítají souřadnice jen letišť použitých v aktuálním pohledu
- čtení letů a GPS souhrnů probíhá jedním SQL dotazem místo následného Pandas merge
- databázové cache mají cílenou invalidaci; běžná editace už nemaže všechny drahé cache aplikace
- katalog letadel je cachovaný i po normalizaci
- cold start nespouští znovu drahé migrace tracků a seedování letadel při každém restartu procesu
- světová airport SQLite databáze se otevírá read-only
- `sitecustomize.py` už nepatchuje a nekontroluje každé SQLite spojení; ochrana se týká pouze `logbook.sqlite`
- Folium, streamlit-folium, Plotly, OpenPyXL a Requests se importují až ve chvíli, kdy je příslušná funkce skutečně potřeba
- odstraněn nepoužívaný AgGrid import
- zachován Smooth Track Player, GPS časové návrhy a všechny funkce v0.51

Velká přestavba GPS přehledové mapy není součástí v0.52; zůstává jako samostatný projekt GPS Map Engine 2.0.

## Upload

Nepřepisovat `data/logbook.sqlite`.
