# Letový zápisník

Aktuální checkpoint: v0.37.

## v0.37

- Přidání letu z KML používá přesnější návrh takeoff/landing podle rychlosti a dostupné výšky.
- Landing se neurčuje podle konce celého GPS tracku, takže dlouhé pojíždění po přistání nemá natahovat Air Time.
- On Block se dopočítá jako landing + 5 minut.
- Formulář nového letu umí vybrat letadlo z databáze.
- Po výběru registrace se doplní typ, evidence, třída a sazba z ceníku/databáze letadel.

## Bezpečnost dat

Nepřepisovat ručně `data/logbook.sqlite`.
