# Letový zápisník v0.35.3

Stabilní vývojová verze se zaměřením na rychlou mapu a funkční přechod z mapy do výběru letů.

## Změny v0.35.3

- Orientační mapa zůstává rychlá jako HTML mapa.
- Popup letiště obsahuje akci `Zobrazit lety`.
- Popup trasy obsahuje akce `Detail` a `Trasa`.
- Akce z popupu přepínají celou aplikaci přes query parametry, ne přes nespolehlivý iframe event.
- Pod mapou se zobrazí výběr letů jen po konkrétní volbě letiště nebo trasy.
- Běžná tabulka direct tras byla odstraněna z hlavního zobrazení mapy.

## Bezpečnost dat

Nikdy ručně nepřepisovat:

- `data/logbook.sqlite`

Tento soubor obsahuje živé lety, tracky a ruční data.
