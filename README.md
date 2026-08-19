# Letový zápisník

Aktuální checkpoint: **v0.41 – Databáze 2.0**.

## Změny v0.41

- Přepracovaná část **Databáze → Letadla**.
- Letadlo má nově výchozí roli, účtování podle Block/Air a aktivní/neaktivní stav.
- Přidán rychlý formulář pro přidání nebo úpravu jednoho letadla.
- Přehled letadel má filtrování, vyhledávání a hromadnou editaci.
- Ceník je dostupný také přímo v databázi.
- Přidání letu načítá z profilu letadla registraci, typ, evidenci, třídu, roli, cenu a způsob účtování.
- Náklady letu se počítají podle uloženého způsobu účtování: Block Time nebo Air Time.

## Bezpečnost dat

Nikdy ručně nepřepisovat:

- `data/logbook.sqlite`

Tento soubor obsahuje živé lety, tracky a ruční data.
