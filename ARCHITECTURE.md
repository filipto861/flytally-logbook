# Logbook architecture — v0.55

## Cíl

v0.55 zavádí multi-user datovou architekturu bez toho, aby se aplikace už dnes chovala jako veřejná multi-user služba. Produkční režim zůstává jeden pilot + SQLite + GitHub backup.

## Ownership model

Uživatelské tabulky:

```text
users
└── user_settings

users
├── flights
│   └── flight_tracks
│       └── track_points
├── aircraft
├── rates
├── airports        # lokální/custom overrides
└── audit_log
```

`user_id` je hranice vlastnictví dat. V současném single-user režimu je aktivní `user_id = 1`.

### Shared data

`data/airports_full.sqlite` je globální read-only katalog světových letišť. Není kopírován pro jednotlivé uživatele. Lokální dodatky a overrides jsou v hlavní DB a mají `user_id`.

## Current user abstraction

`current_user_id()` v aplikaci dnes vrací výchozího lokálního uživatele ze session state. Hlavní cached read funkce přijímají `user_id` jako argument, takže budoucí autentizace může změnit aktivního uživatele bez sdílení cache mezi účty.

Profil je uložen v `users` / `user_settings`. Výchozí profil při migraci převezme nejčastější jméno velitele z existujícího zápisníku, pokud je dostupné.

## SQLite migration v6

`logbook_core/tenancy.py` provádí jednorázovou migraci:

- vytvoření lokálního uživatele,
- doplnění ownership sloupců,
- převod starých globálních UNIQUE omezení na per-user UNIQUE pro aircraft/rates/airports,
- synchronizaci ownership přes flight → track → track point,
- vytvoření user-aware indexů,
- zápis markeru `tenancy_v1`.

Po dokončení marker zajišťuje rychlý startup bez opakovaného skenování velké tabulky GPS bodů.

## Database backend

v0.55 stále používá SQLite. To je záměrné: pro jednoho uživatele je stávající provoz jednoduchý a ověřený. Až bude zapnuta registrace více uživatelů, databázová vrstva se přesune na PostgreSQL a GitHub backup živé DB se odstraní.

## Security boundary

v0.55 je **příprava**, nikoli veřejný multi-user release. Skutečný multi-user provoz se nesmí zapnout pouze přidáním login formuláře; před otevřením dalším uživatelům musí být dokončena autentizace, autorizace všech dotazů a serverová databáze.
