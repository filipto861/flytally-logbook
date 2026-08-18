# Update v0.29

Tento balík je připravený tak, aby neobsahoval osobní `data/logbook.sqlite`.

## Důležité

- `data/logbook.sqlite` nepřepisovat ani nemazat. Obsahuje tvoje lety, KML tracky, ceny a ruční úpravy.
- Nová světová letištní databáze je v samostatném souboru `data/airports_full.sqlite`.
- Aplikace čte letiště z `data/airports_full.sqlite` a ruční doplňky/opravy z `data/logbook.sqlite`. Ruční záznam má přednost.

## Co nahrát na GitHub

Nahraj / přepiš hlavně:

- `app.py`
- `sitecustomize.py`
- `scripts/seed_airports_full.py`
- `.github/workflows/seed-airports.yml`
- `data/airports_full.sqlite`

Volitelně můžeš ponechat i `data/airports.csv`, pokud už v repozitáři je.

Po nahrání udělej ve Streamlit Cloud:

1. Manage app → Reboot app
2. Ctrl + F5 v prohlížeči

Správný stav v aplikaci:

- verze vpravo nahoře `v0.29`
- sidebar má jen jednu malou šipku
- po schování je šipka vlevo u kraje
- Databáze → Letiště ukazuje cca 85 000 letišť, ne 24
