# Letový zápisník

Verze: **v0.57**

## v0.57 – Roles & Admin Console

v0.57 dokončuje oddělení běžného uživatele a správce aplikace. Přihlášení z v0.56 zůstává, ale uživatel už nepotřebuje druhé admin heslo k práci se svými vlastními daty.

### Role

- `user_id = 1` je původní účet a je automaticky označen jako **admin**.
- Všechny historické lety, tracky, letadla, ceník a custom letiště zůstávají beze změny vlastnictví u `user_id = 1`.
- Nově vytvořený profil má standardně roli **user** a začíná s prázdným zápisníkem.
- Role je uložena trvale v tabulce `users`, ne v dočasné session.

### Co může běžný přihlášený uživatel

Bez dalšího hesla může spravovat pouze svoje vlastní:

- lety (přidat, editovat, smazat),
- KML/GPS tracky,
- letadla,
- ceník,
- custom letiště,
- profil a heslo,
- exporty.

Databázové dotazy dál používají `user_id`, takže jeden profil nemůže upravovat data jiného profilu.

### Admin menu

Admin má v levé navigaci novou položku **Admin**:

- Přehled – uživatelé, lety, tracky, GPS body, verze DB,
- Uživatelé – vytvoření profilu, role, aktivace/deaktivace a reset hesla,
- Záloha – plná SQLite DB, GitHub backup a restore,
- Servis – DB kontrola a SQLite servis,
- Meta – globální metadata a audit log.

Veřejná registrace může zůstat vypnutá (`allow_registration = false`). Admin přesto může vytvořit testovací běžný profil přímo v Admin → Uživatelé.

### Databáze

- SQLite zůstává zachována.
- GitHub auto-backup zůstává zachován.
- `DB_SCHEMA_VERSION = 8`.
- Přidává se `users.role` (`admin` / `user`).
- Release ZIP neobsahuje `data/logbook.sqlite`.

## Další směr

Až bude víceuživatelské chování ověřené, lze později přejít ze SQLite/GitHub persistence na PostgreSQL bez změny základního ownership modelu.
