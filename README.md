# Letový zápisník v0.33.1

UX polish navazující na v0.33.

## Změny

- Zachována rychlejší navigace a rychlejší mapy z v0.33.
- Loading mezi stránkami je nově jen decentní točící se letadýlko, bez rušivého panelu a textu.
- Sidebar toggle je znovu více uhlazený: větší kulaté tlačítko, lepší hover a lepší poloha při zavřeném menu.
- Cílem loaderu je pouze krátký přechod, ne maskování pomalosti. Další velký milník zůstává skutečná optimalizace architektury.

## Bezpečnost dat

ZIP neobsahuje `data/logbook.sqlite`. Tento soubor nepřepisovat ručně, protože obsahuje živé lety, tracky a ruční data.
