# Letový zápisník

Verze: **v0.60.2**

## v0.60.2 – Inline Aircraft Creation

Tato verze navazuje na Smart KML Import z v0.60.1 a zlepšuje workflow přidávání letu v situaci, kdy importovaná nebo ručně zadaná registrace ještě nemá vytvořený profil letadla.

### Nový inline workflow

Pokud KML už obsahuje rozpoznanou registraci a letadlo není v databázi uživatele, aplikace otevře popup **Vytvořit profil letadla** ještě před uložením letu.

Popup obsahuje kompletní základní konfiguraci:

- imatrikulaci,
- typ,
- ICAO typ,
- evidenci,
- třídu,
- výchozí roli,
- cenu za hodinu,
- datum účinnosti ceny,
- způsob účtování BLOCK / AIR,
- poznámku,
- aktivní / neaktivní stav.

Po vytvoření profilu se uživatel vrátí do stejného rozpracovaného letu. KML, mapa, Smart KML analýza, detekované časy, starty/přistání a ostatní formulářová data se neztratí.

### Ruční zadání registrace

U ručně přidaného letu se registrace nevyhodnocuje během psaní uvnitř formuláře. Pokud uživatel stiskne **Přidat let** a profil pro danou registraci neexistuje, uložení se pozastaví a otevře se stejný popup. Po vytvoření profilu se původní rozpracovaný let automaticky dokončí s novou konfigurací letadla.

### Bezpečný fallback

Popup vždy nabízí i:

- **Pokračovat bez profilu** – let lze uložit i bez vytvoření letadla,
- **Vrátit se k formuláři** – uživatel může registraci nebo jiné údaje opravit.

Vytvoření profilu tedy není povinné.

### Cenová historie

Pokud je profil vytvořen během importu historického letu, datum první ceny se standardně předvyplní podle data rozpracovaného letu. Uživatel jej může změnit před uložením.

### Smart KML zůstává zachován

v0.60.2 zachovává všechny funkce v0.60.1:

- detekci více letů,
- návrh rozdělení / možnost ponechat jeden let,
- ruční rozdělení,
- detekci touch-and-go,
- automatický návrh počtu startů / přistání,
- kontrolu časových mezer a GPS skoků.

### Databáze a multi-user

- Profil letadla se vytváří pouze pro právě přihlášeného uživatele.
- Data ostatních uživatelů nejsou dotčena.
- `APP_VERSION = v0.60.2`
- `DB_SCHEMA_VERSION = 8`
- Není nutná migrace struktury databáze.
- SQLite + privátní GitHub auto-backup zůstává zachován.
- Release ZIP neobsahuje `data/logbook.sqlite`.
