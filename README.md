# Letový zápisník v0.7

Streamlit aplikace pro osobní pilotní logbook: ULL/EASA, nálety, náklady, KML/GPS tracky, databázová správa a admin režim.

## Co je důležité

- Hlavní databáze je `data/logbook.sqlite`.
- Tuto databázi po ostrém provozu nemažte ani nepřepisujte bez zálohy.
- Kód aplikace se může aktualizovat, databáze zůstává datovým úložištěm.
- v0.7 přidává čistší navigaci, skryté filtry a detail letu v modálním okně po kliknutí na řádek.

## Streamlit Secrets

V nastavení Streamlit Cloud nastavte alespoň admin heslo:

```toml
[auth]
admin_password = "tvoje_silne_heslo"
```

Volitelně pro ruční zálohu databáze na GitHub:

```toml
[github]
token = "github_pat_xxx"
repo = "filipto861/Logbook"
db_path = "data/logbook.sqlite"
```

## Spuštění lokálně

```bash
pip install -r requirements.txt
streamlit run app.py
```

## Aktualizace aplikace

Přepisujte obvykle jen:

- `app.py`
- `requirements.txt`
- `README.md`
- `.streamlit/config.toml`
- `scripts/...`

Nepřepisovat bez zálohy:

- `data/logbook.sqlite`
