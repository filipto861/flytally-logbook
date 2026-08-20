# Logbook architecture — v0.56

## Stav

v0.56 přidává autentizaci nad ownership modelem v0.55. Datový backend zůstává SQLite a `user_id` je bezpečnostní hranice mezi profily.

## Identita původního uživatele

`user_id = 1` je legacy owner. Migrace v0.55 už přiřadila všechna historická data právě jemu. v0.56 tuto vazbu **nemění**; pouze k uživateli 1 přidá e-mail a credentials po bezpečné aktivaci.

```text
users
├── user_credentials
├── user_settings
├── flights
│   └── flight_tracks
│       └── track_points
├── aircraft
├── rates
├── airports (custom)
└── audit_log
```

## Authentication gate

`main()` inicializuje DB, ale před navigací a před zpracováním detailových query parametrů volá auth gate. Bez platné session se žádná stránka s uživatelskými daty nevykreslí.

První start nad legacy profilem vyžaduje aktivaci pomocí existujícího `auth.admin_password`, aby veřejný návštěvník nemohl převzít profil 1. Po aktivaci se používá e-mail + heslo.

## Password storage

`logbook_core/auth.py` používá `hashlib.scrypt`:

- N = 16384,
- r = 8,
- p = 1,
- 16B random salt,
- 32B derived key,
- constant-time comparison.

Do databáze se neukládá plaintext heslo.

## Registration

Implementace registrace je připravena, ale `auth.allow_registration = false` je výchozí a doporučený stav. Nový účet dostane nové `user_id` a žádná historická data.

## Full database access

Export jednotlivého uživatele (Excel/CSV/HTML) zůstává dostupný. Stažení celé SQLite DB je nově pouze pro aplikačního admina, protože DB může obsahovat data více uživatelů.

## Shared airport catalogue

`data/airports_full.sqlite` zůstává globální read-only katalog. `airports` v hlavní DB jsou user-scoped custom/override záznamy.

## Budoucí backend

SQLite + GitHub backup je přechodný single-user deployment. Před otevřením registrace širší veřejnosti je plánovaný PostgreSQL backend, serverová persistence, e-mail verification/reset a odstranění GitHub backupu živé DB.
