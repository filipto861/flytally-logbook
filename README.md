# Letový zápisník

## v0.61.3 – Flight Import UX 2.0

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


## v0.61.3 hotfix
- fixes Streamlit 1.62 `StreamlitInvalidWidthError` caused by zero-width runtime iframes
- sidebar toggle and page-transition helper iframes now use 1×1 px dimensions


## v0.61.3
Invisible front-end runtime: sidebar toggle and page-transition scripts now use `st.html(..., unsafe_allow_javascript=True)` instead of 1×1 px iframes, removing the visible white artifacts introduced by the v0.61.1 compatibility hotfix.
