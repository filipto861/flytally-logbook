# Letový zápisník

Verze: **v0.59**

## v0.59 – User Profile, Settings & Permission Hardening

v0.59 dokončuje první multi-user bezpečnostní vrstvu a rozšiřuje profil uživatele. Aplikace dál používá SQLite a GitHub auto-backup; databázové schéma zůstává **8**.

### Profil a nastavení

Nová stránka **Profil a nastavení** je rozdělena na:

- **Profil** – jméno a přehled vlastního účtu,
- **Výchozí hodnoty** – domovské letiště, výchozí funkce, evidence, měna a časové pásmo,
- **Zabezpečení** – změna přihlašovacího e-mailu, změna hesla a informace o oprávnění účtu.

Domovské letiště se předvyplní do ručně přidávaného letu. Výchozí role a evidence se používají pro nové lety. Časové pásmo se používá při převodu GPS/KML časů do lokálního času.

### Měna profilu

Zvolená měna se nyní používá při zobrazení cen a nákladů v hlavním UI, profilech letadel a exportech. Číselná data se nepřepočítávají kurzem – měna je vlastnost profilu/ceníku, nikoli FX konverze.

### Permission hardening

Nový modul `logbook_core/permissions.py` zavádí striktní práci s uživatelským kontextem:

- neplatný nebo nepřihlášený `user_id` se už nesmí automaticky převést na původního uživatele #1,
- editace a mazání letu/tracku ověřují vlastnictví záznamu před změnou,
- user-scoped read funkce vyžadují explicitní `user_id`,
- běžný uživatel vidí a upravuje pouze vlastní lety, letadla, ceny, GPS tracky, GPS body, vlastní letiště a audit,
- globální servisní a zálohovací nástroje zůstávají pouze adminovi.

### Admin → Bezpečnost

Admin konzole má novou sekci **Bezpečnost**, která kontroluje:

- chybějící nebo neexistující `user_id`,
- nesoulad vlastníka `flight_track → flight`,
- nesoulad vlastníka `track_point → flight_track`,
- neplatné role uživatelů,
- stav hlavního admin profilu #1.

### Existující data

Všechna data vytvořená před zavedením účtů zůstávají přiřazená původnímu profilu **user_id = 1**. v0.59 vlastnictví existujících letů nijak nemění.

### Databáze a persistence

- `APP_VERSION = v0.59`
- `DB_SCHEMA_VERSION = 8`
- SQLite + GitHub auto-backup zůstává zachován.
- Release ZIP neobsahuje `data/logbook.sqlite`.
