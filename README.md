# Letový zápisník

Aktuální checkpoint: **v0.40 – Přidání letu / formulář 2.0**.

## Změny v0.40

- Přidán rychlý zápis v části **Přidat let**.
- Nový let lze předvyplnit ze šablony posledních letů.
- Lze rychle použít poslední let bez časů, použít i časy, nebo otočit trasu.
- Přidán výběr nejčastějších tras z historie.
- Přidán rychlý dopočet časů podle vzletu, délky Air Time a rezervy pro block time.
- Výběr letadla z databáze zůstává zachovaný a lépe navazuje na předvyplněnou registraci.
- Zachována funkčnost v0.39.1: optimalizace, agregovaná mapa, dashboard 2.0, KML landing detection a výběr letadla.

## Bezpečnost dat

Nikdy ručně nepřepisovat:

- `data/logbook.sqlite`

Tento soubor obsahuje živé lety, tracky a ruční data.
