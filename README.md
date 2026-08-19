# Letový zápisník

Aktuální checkpoint: **v0.39 – core optimization**.

## Změny v0.39

- Přidán samostatný modul `logbook_core/performance.py` pro bezpečné výkonnostní pomocné funkce.
- SQLite spojení používají sjednocené performance PRAGMA hodnoty.
- Doplněny databázové indexy pro trasy, registrace, ceník, tracky a časové body.
- Orientační mapa letišť nově agreguje direct trasy podle dvojice letišť místo vykreslení jedné linie pro každý let.
- Mapové cache používají kompaktnější JSON, aby se zmenšil objem dat při renderování.
- GPS tracky se pro mapové zobrazení zjednodušují konzervativněji. Detailní body zůstávají v databázi.
- Zachována funkčnost v0.38: dashboard 2.0, mapová navigace, KML landing detection a výběr letadla.

## Bezpečnost dat

Nikdy ručně nepřepisovat:

- `data/logbook.sqlite`

Tento soubor obsahuje živé lety, tracky a ruční data.
