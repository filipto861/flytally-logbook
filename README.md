# Letový zápisník v0.14

Streamlit aplikace pro osobní pilotní logbook: ULL/EASA, nálety, náklady, KML/GPS tracky, databázová správa a admin režim.

## Základní pravidlo

- Hlavní databáze je `data/logbook.sqlite`.
- Kód aplikace se může aktualizovat, databázi po ostrém provozu nepřepisovat bez zálohy.
- Na Streamlit Community Cloud se lokální SQLite změny po restartu nemusí zachovat, proto v0.14 přidává automatickou zálohu databáze na GitHub.

## Streamlit Secrets

V nastavení Streamlit Cloud nastavte admin heslo:

```toml
[auth]
admin_password = "tvoje_silne_heslo"
```

Pro automatickou GitHub zálohu databáze nastavte také:

```toml
[github]
token = "github_pat_xxx"
repo = "filipto861/Logbook"
db_path = "data/logbook.sqlite"
branch = "main"
auto_backup = true
```

GitHub token musí mít oprávnění pro zápis do obsahu repozitáře. Token nikdy neukládejte do GitHubu ani do kódu aplikace.

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

## v0.14

- Automatická GitHub záloha SQLite databáze po každé potvrzené změně.
- Stav zálohy je vidět v `Databáze -> Záloha`.
- Po selhání automatické zálohy aplikace ponechá změnu lokálně a ukáže chybu.
- Altitude a speed profil KML tracku jsou sloučeny do jednoho grafu se dvěma osami.
- Popisek mapy vysvětluje význam plné a čárkované čáry.

## v0.13

- Funkční seznam letů s tlačítkem Detail u konkrétního letu.
- Výchozí stránka seznamu je poslední stránka s nejnovějšími lety.
- Přidaná možnost zobrazit všechny řádky na jedné stránce.
