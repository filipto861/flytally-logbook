# Letový zápisník

Verze: **v0.58**

## v0.58 – Aircraft Profiles & Pricing UX

v0.58 slučuje databázi letadel a ceník do jednoho uživatelského workflow. Samostatná položka **Ceník** už není v navigaci ani v databázi. Cena se spravuje pouze uvnitř profilu konkrétního letadla.

### Databáze letadel

Sekce **Databáze → Letadla** má nové UI:

- přehled letadel formou karet,
- vyhledávání a samostatný archiv neaktivních letadel,
- rychlé metriky aktivních/archivovaných profilů a aktuálních cen,
- samostatné zobrazení profilu letadla,
- čistý formulář pro přidání nového letadla,
- oddělené záložky **Profil letadla** a **Cena a historie**,
- počet letů a datum posledního letu přímo v profilu.

### Ceny a historie

Tabulka `rates` zůstává zachována jako historický zdroj cen, ale uživatel ji již needituje jako samostatný ceník.

- Každá změna ceny má `valid_from`.
- Výchozí datum nové změny je dnešní den.
- Lze zadat i historické datum, například `01.01.2025`.
- Pokud sazba pro stejné datum už existuje, upraví se pouze tento záznam.
- Budoucí sazba se nezačne používat před datem účinnosti.
- Historie cen je zobrazena v rozbalovací části profilu letadla jako období **Platí od / Platí do**.
- Starší lety zůstávají beze změny, protože let si dál ukládá vlastní `price_per_hour` jako snapshot v okamžiku uložení.

### Pricing engine

Výběr sazby je nyní datumově řízený. Pro dané letadlo se vybere poslední sazba, jejíž `valid_from` je menší nebo rovno datu letu. Logika je oddělena v `logbook_core/pricing.py`.

### Multi-user

Všechny změny respektují `user_id`. Každý uživatel má vlastní letadla i vlastní historii cen. Admin role a přihlášení z v0.57 zůstávají beze změny.

### Databáze

- `DB_SCHEMA_VERSION = 8` – žádná nová migrace databáze není potřeba.
- SQLite + GitHub auto-backup zůstává zachován.
- Release ZIP neobsahuje `data/logbook.sqlite`.
