# Logbook Streamlit

Verze: **v0.55**

## v0.55 – Multi-User Foundation

v0.55 připravuje aplikaci na budoucí používání více piloty, ale **současné chování zůstává single-user**. Přihlášení ani registrace se zatím nezobrazují a aplikace dál používá SQLite + současný GitHub backup.

### Co se změnilo

- nový interní model uživatelů (`users`, `user_settings`),
- současný pilot je automaticky veden jako výchozí uživatel `user_id = 1`,
- existující lety, letadla, ceník, lokální/custom letiště, GPS tracky, GPS body a audit log se při prvním startu automaticky přiřadí tomuto uživateli,
- uživatelská data mají `user_id`,
- letadla jsou unikátní podle `(user_id, registration)`,
- ceny podle `(user_id, registration, valid_from)`,
- lokální/custom letiště podle `(user_id, ident)`,
- hlavní čtecí i zapisovací cesty aplikace jsou připravené na uživatelské oddělení,
- světová databáze letišť `airports_full.sqlite` zůstává společná a read-only,
- hardcoded jméno velitele bylo nahrazeno profilem aktuálního uživatele,
- databázové schéma je nyní **6**.

### Co se zatím nemění

- žádná přihlašovací obrazovka,
- žádná registrace,
- žádný PostgreSQL/Supabase,
- žádná změna Streamlit UI,
- GitHub backup databáze zůstává zachován,
- KML import a GPS Map Engine 2.0 fungují stejně jako ve v0.54.

## Bezpečná migrace

Při prvním spuštění nad databází z v0.54 proběhne jednorázová migrace. Staré záznamy se nemažou; doplní se jim vlastník `user_id = 1`. Migrace je idempotentní a má persistentní marker `tenancy_v1`, takže se při dalších startech neopakuje.

**Před nasazením ponech zálohu `data/logbook.sqlite`. Release ZIP tento soubor neobsahuje a nesmí přepsat živou databázi.**

## Testy

Součástí jsou regresní testy core funkcí, GPS Map Engine 2.0 a nové testy multi-user migrace včetně ověření, že dva uživatelé mohou mít stejné letadlo i stejný custom ident letiště.

## Další plán

Po produkčním ověření v0.55 lze navázat:

1. profil uživatele a editace jeho nastavení,
2. autentizační vrstva (login / registrace),
3. přesun datového backendu na PostgreSQL,
4. teprve potom otevření aplikace dalším uživatelům.
