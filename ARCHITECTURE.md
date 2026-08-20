# Logbook architecture — v0.59

## Tenant boundary

Každý uživatelský záznam je vlastněn pomocí `user_id`. Uživatelsky scoped tabulky jsou:

- `flights`
- `aircraft`
- `rates`
- `airports`
- `flight_tracks`
- `track_points`
- `audit_log`

Globální katalog letišť `data/airports_full.sqlite` je read-only a společný pro všechny profily. Lokální/custom letiště jsou uživatelská.

## Strict identity

`logbook_core.permissions.strict_user_id()` je bezpečnostní hranice pro runtime operace. Na rozdíl od migračního `normalize_user_id()` nikdy nepoužije fallback na `user_id = 1` při chybějícím nebo neplatném ID.

Migrační kód smí explicitně používat legacy owner #1. Běžné runtime read/write operace musí mít platný přihlášený účet.

## Object ownership

`require_owned_record()` ověřuje vlastnictví před destruktivní nebo editační operací. v0.59 jej používá minimálně pro:

- editaci letu,
- smazání letu,
- uložení tracku k letu,
- smazání tracku.

SQL zápisy zároveň stále používají `WHERE ... AND user_id = ?` jako druhou ochrannou vrstvu.

## User settings

`user_settings` zůstává tabulka 1:1 k `users` a ukládá:

- timezone,
- currency,
- home_airport,
- default_role,
- preferences_json.

`preferences_json` v0.59 obsahuje `default_evidence`. Tento formát umožní přidávat další lehká UX nastavení bez zbytečných DB migrací.

## Authentication

Hesla jsou uložena pouze jako salted scrypt hash v `user_credentials`. Změna e-mailu vyžaduje potvrzení současným heslem. Role `admin/user` je persistentní v tabulce `users`.

## Admin security health

Admin konzole kontroluje integritu tenant vazeb a upozorní na cross-user vztahy mezi lety, tracky a GPS body. Tyto kontroly jsou diagnostické a samy data nemění.

## Persistence

V této fázi zůstává SQLite + privátní GitHub backup. Při budoucím přechodu na PostgreSQL zůstane princip `user_id` a permission boundary zachován.
