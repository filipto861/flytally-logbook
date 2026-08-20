# Letový zápisník

## v0.63 – Pilot Currency & Recency

- new **Recency** navigation page
- last flight and last landing overview
- rolling 90-day **PIC ULL** and **PIC EASA** activity cards
- rolling 30 / 90 / 365 day activity table
- new user-owned validity records for medicals, licences, ratings and other documents
- configurable warning lead time for every validity record
- status states: valid / warning / expired
- strict tenant isolation for validity records
- recency activity is explicitly informational; it does not claim legal passenger-carrying currency
- database schema upgraded from 8 to **9** by adding `user_expiries`

## v0.62.2 – Flight Import UX 2.0

v0.61 sjednocuje KML import do jednoho konzistentního workflow a přidává finální kontrolu před uložením.

### Nový čtyřkrokový KML workflow

1. **KML / Soubor** – nahrání zdrojového KML.
2. **Smart KML / Analýza** – detekce více letů, touch-and-go, časových mezer a GPS anomálií.
3. **Údaje letu / Kontrola polí** – mapa, automaticky odhadnuté časy, letiště, registrace a editovatelný formulář.
4. **Finální kontrola / Uložit** – souhrn všech údajů, nákladů a GPS tracku před skutečným zápisem do databáze.

Do databáze se nic nezapíše, dokud uživatel nepotvrdí finální kontrolu.

### Rozdělené tracky

Pokud Smart KML navrhne více letů, každý díl má vlastní workflow a vlastní finální kontrolu. Po uložení jednoho dílu pokračuje průvodce na další část. Body rozdělení zůstávají po prvním uložení uzamčené stejně jako v předchozí verzi.

### Návrat k editaci

Ve finální kontrole je tlačítko **Upravit údaje**, které vrátí uživatele zpět k formuláři bez ztráty nahraného KML nebo Smart KML analýzy.

### Inline profil letadla

Workflow z v0.60.3 zůstává zachovaný. Pokud importovaná registrace nemá profil letadla, lze jej vytvořit přímo v popupu a potom pokračovat v rozpracovaném importu.

### Branding

Součástí release jsou soubory:

- `assets/logbook_icon.png`
- `assets/logbook_icon_32.png`
- `assets/favicon.ico`

Aplikace používá vlastní ikonu v záložce prohlížeče.

### Streamlit API cleanup

v0.61 odstraňuje staré přímé použití `streamlit.components.v1.html` a hlavní výskyty deprecated `use_container_width`. Interní HTML/JS vizualizace se vykreslují přes současné `st.iframe` API a Streamlit prvky používají `width="stretch"`.

### Databáze

- `APP_VERSION = v0.61`
- `DB_SCHEMA_VERSION = 8`
- není nutná migrace databáze,
- SQLite + privátní GitHub auto-backup zůstává zachován,
- release ZIP neobsahuje `data/logbook.sqlite`.


## v0.62.2 hotfix
- fixes Streamlit 1.62 `StreamlitInvalidWidthError` caused by zero-width runtime iframes
- sidebar toggle and page-transition helper iframes now use 1×1 px dimensions


## v0.62.2
Invisible front-end runtime: sidebar toggle and page-transition scripts now use `st.html(..., unsafe_allow_javascript=True)` instead of 1×1 px iframes, removing the visible white artifacts introduced by the v0.61.1 compatibility hotfix.


## v0.62.2 – Sidebar UX Final Polish
- minimalistický edge handle se dvěma chevrony bez kruhu a pozadí
- ovladač přesunut z řádku Navigace na samostatnou hranu sidebaru
- návrat k rychlejšímu 320 ms motion profilu z dřívějších verzí
- compositor hints přes translate3d/backface visibility a odstranění drahého width transition
- kliknutí pouze přepíná CSS stav; žádný Streamlit rerun


## v0.62.2 – Top Sidebar Chevron Polish
- sidebar handle moved to the upper-right area inside the open sidebar
- two chevrons are horizontal instead of stacked
- chevrons are larger with a wider click target
- closed-state handle remains available at the left edge
- compositor-friendly sidebar motion from v0.61.5 is preserved


## v0.62.2 – Stability & Performance Cleanup
No new user-facing feature is introduced. This release prepares a stable base for v0.62.2.

- removed confirmed dead and legacy UI/map helper code from `app.py`
- removed duplicate `logbook_core.performance` fallback implementations
- removed unused imports and obsolete helper code
- authenticated session IDs no longer have any fallback path to user `1`
- generic cached SQL readers accept only explicitly permitted tables
- normal current-database cold starts skip the unnecessary second full `SCHEMA` DDL pass
- cached track-map JSON decoding uses the standard JSON decoder instead of a Pandas JSON parser
- old global `sitecustomize.py` SQLite monkeypatch is neutralized
- runtime dependencies are exactly pinned to the versions validated on Streamlit Cloud
- Streamlit 1.62 compatibility checks remain part of the regression suite


## v0.62.2 – Dashboard & Statistics 2.0

- nový rychlý volič období: celá historie, tento rok, posledních 12 měsíců, předchozí rok
- dashboardové filtry zůstávají uživatelsky kombinovatelné s obdobím
- nová horní sada KPI: Block, PIC, Air time, náklady, letadla, letiště/trasy, GPS a poslední let
- přehled přidává rekordy: nejaktivnější měsíc, nejdelší let, top letadlo a top trasu
- nový měsíční kombinovaný graf Block h + počet letů
- roční rozpad podle role a evidence a formátovaný roční souhrn
- rozšířené statistiky letadel včetně podílu na náletu, průměrné délky letu, ceny za block h, GPS a posledního letu
- detail vybraného letadla přímo v dashboardu
- letiště rozlišují odlety, přílety a návštěvy; trasy obsahují průměrný Block a poslední použití
- nákladová sekce má měsíční trend, rozpad podle letadla a průměry
- Poslední lety obsahují 30denní rychlý souhrn a volitelný počet řádků
- agregace dashboardu jsou přesunuty do čistého modulu `logbook_core/dashboard.py`
- jednotlivé dashboardové sekce zůstávají lazy: skryté grafy a tabulky se nevytvářejí
- `DB_SCHEMA_VERSION = 8`; bez migrace databáze


## v0.62.2 – Dashboard Polish
- dashboard hierarchy now prioritizes total logged time
- primary evidence split: ULL and EASA with landing counts
- primary PIC split: PIC ULL and PIC EASA with landing counts
- one dominant monthly chart with metric selector
- contextual items are condensed into one lightweight information line
- aircraft, airports/routes, costs, annual analysis and recent flights remain available under `Detailní statistiky`
- no database migration; schema stays at 8


## v0.62.2 – Dashboard Card Visual Polish
- fixes missing v0.62.1 dashboard-specific CSS
- restores rich card visuals without restoring dashboard clutter
- total time gets a stronger hero-card treatment
- ULL/EASA/PIC cards use subtle accent strips and gradients
- flight and landing counts are displayed as compact chips
- typography, spacing and numeric emphasis are improved
- no data model or calculation changes