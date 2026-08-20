# Logbook architecture — v0.58

## Aircraft profile as the editing boundary

Uživatelské UI už nemá samostatnou stránku Ceník. Vše, co patří ke konkrétnímu letadlu, se spravuje v jeho profilu:

- identita a typ letadla,
- evidence/třída,
- výchozí role,
- billing basis,
- aktivní/neaktivní stav,
- poznámka,
- aktuální cena,
- cenová historie.

Tím se odstraní dvojí editace stejných informací na dvou místech.

## Pricing source of truth

Historické ceny jsou stále uloženy v tabulce `rates`:

- `user_id`
- `registration`
- `aircraft_type`
- `valid_from`
- `price_per_hour`
- `source`

`aircraft.default_price_per_hour` zůstává pouze jako kompatibilní cache aktuální ceny pro starší části aplikace a starší databáze. Datumově správná cena se vybírá z `rates`.

Funkce `logbook_core.pricing.lookup_latest_rate()` vybírá sazbu platnou k požadovanému datu a ignoruje budoucí sazby před jejich účinností.

## Historical correctness

Tabulka `flights` dál uchovává `price_per_hour` přímo u letu. Změna ceny letadla proto nepřepočítá dříve uložené lety. Cenová historie slouží především jako zdroj správné sazby pro nové/importované lety podle jejich data.

## Multi-user ownership

Aircraft profiles i rates jsou scoped pomocí `user_id`. Dva uživatelé mohou mít stejnou registraci i rozdílnou cenovou historii bez vzájemného ovlivnění.

## Persistence

SQLite + GitHub auto-backup zůstává v této fázi zachován. `DB_SCHEMA_VERSION` zůstává 8.
