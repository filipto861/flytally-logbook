# Letový zápisník Streamlit

Verze: v0.43.1

## v0.43.1 – Optimalizace II

- data se načítají až podle aktivní stránky
- Dashboard, Export, Mapa, Lety a Nový let už zbytečně nenačítají stejné tabulky mimo svoji stránku
- ceník má samostatnou cache a normalizaci registrací
- databázové počty GPS bodů a tracků se načítají přes rychlý COUNT místo celé tabulky
- Excel, HTML tisk a exportní souhrny jsou cachované
- zachována kompatibilita s `logbook_core/`, ale aplikace má fallback i při chybějícím modulu

## Důležité

Nepřepisovat produkční databázi `data/logbook.sqlite`.
