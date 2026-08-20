# Logbook architecture — v0.62.1

## Flight Import UX 2.0

v0.62.1 ponechává parser, Smart KML a datovou vrstvu beze změny, ale přidává orchestration vrstvu pro bezpečný import před zápisem do SQLite.

### Import state machine

KML import je logicky rozdělen do čtyř stavů:

1. upload,
2. Smart KML analýza a volba rozdělení,
3. editace údajů letu,
4. finální review.

Finální formulářová data se mezi krokem 3 a 4 drží pouze v `st.session_state`. Databázový `create_flight()` a `save_track()` se volají až po explicitním potvrzení review.

### Single-track review

Klíč `_single_import_review_key(signature)` izoluje review stav konkrétního nahraného souboru. Při návratu k editaci se review payload odstraní, ale KML zůstane v uploader/session workflow.

### Split-track review

Každý díl používá `_split_import_review_key(signature, progress)`. Díl se zapíše do databáze až po vlastní finální kontrole. Po dokončení se průvodce přesune na další část.

### Existing Smart KML guarantees

- automatické rozdělení je pouze návrh,
- uživatel může uložit původní KML jako jeden let,
- ruční split zůstává dostupný,
- touch-and-go pouze předvyplňuje počet startů/přistání,
- vytvoření profilu letadla je volitelné.

### UI compatibility

Statické mapy a Track Player používají `st.iframe` místo deprecated `streamlit.components.v1.html`. Streamlit prvky používají nové width API.

### Persistence

- DB schema: 8
- žádná migrace
- multi-user tenant ownership zůstává beze změny
- GPS body ani původní KML nejsou při preview modifikovány


## v0.62.1 cleanup rules
1. Runtime behavior and DB schema stay unchanged (`DB_SCHEMA_VERSION = 8`).
2. No release file may contain or replace `data/logbook.sqlite`.
3. Cross-user reads remain explicitly user-scoped; generic table readers are allow-listed.
4. Compatibility is handled in application bootstrap, not through global SQLite monkeypatches.
5. Dependency upgrades are deliberate releases, not implicit deploy-time changes.


## v0.62.1 dashboard analytics layer

`logbook_core/dashboard.py` obsahuje čisté, Streamlit-independent agregace pro období, měsíce, roky, letadla, letiště, trasy a dashboardové rekordy. UI pouze vybírá aktuální sekci a renderuje již agregovaná data. Tím se drží náklad skrytých dashboardových sekcí mimo aktuální rerun.
