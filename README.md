# Letový zápisník v0.20

Streamlit aplikace pro osobní pilotní logbook: ULL/EASA, nálety, náklady, KML/GPS tracky, databázová správa a admin režim.

## Základní pravidlo

- Hlavní databáze je `data/logbook.sqlite`.
- Kód aplikace se může aktualizovat, databázi po ostrém provozu nepřepisovat bez zálohy.
- Na Streamlit Community Cloud se lokální SQLite změny po restartu nemusí zachovat, proto aplikace používá automatickou zálohu databáze na GitHub.

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

## v0.20

- Import nového letu z KML automaticky detekuje takeoff a landing z GPS rychlosti.
- Pokud není dostupná rychlost, používá se záložní detekce podle výšky.
- `Off Block` se předvyplní jako takeoff minus 5 minut.
- `On Block` se předvyplní jako landing plus 5 minut.
- Aplikace nově podporuje i KML, kde jsou body uložené jako jednotlivé Placemark/Point záznamy s TimeStamp.
- Pokud KML neobsahuje časové značky, aplikace to jasně oznámí a časy nechá k ručnímu doplnění.

## v0.18

- Automatická GitHub záloha SQLite databáze po každé potvrzené změně.
- Stav zálohy je vidět v `Databáze -> Záloha`.
- Po selhání automatické zálohy aplikace ponechá změnu lokálně a ukáže chybu.
- Altitude a speed profil KML tracku jsou sloučeny do jednoho grafu se dvěma osami.
- Popisek mapy vysvětluje význam plné a čárkované čáry.

## v0.13

- Funkční seznam letů s tlačítkem Detail u konkrétního letu.
- Výchozí stránka seznamu je poslední stránka s nejnovějšími lety.
- Přidaná možnost zobrazit všechny řádky na jedné stránce.


## v0.18

- Opravuje falešnou chybu při nahrávání KML tracku, kdy se při současném zobrazení existující mapy a náhledu nahrávaného tracku vytvořily duplicitní Streamlit klíče.
- Přidává unikátní klíče pro všechny mapové komponenty.


## v0.18

- Přidán lokální soubor `data/airports.csv` pro import světové databáze letišť do SQLite.
- Import letišť probíhá databázově do tabulky `airports`, ne z pevného seznamu v kódu.
- Mapa všech letů používá tenčí plné čáry bez rozlišování stylu podle funkce letu.
- Databázi `data/logbook.sqlite` při updatech nepřepisuj, pokud nechceš obnovit zálohu.


## v0.18

- Odstraněna běžná záložka Import letišť po prvotním importu světové databáze.
- Letiště se nyní spravují v databázové tabulce: vyhledání, export a ruční doplnění/opravování ploch.
- Databáze `data/logbook.sqlite` se při aktualizaci aplikace nepřepisuje.


## Změny v0.18

- Aplikace je trvale v tmavém režimu.
- Stránka Kontrola je skrytá z navigace; validace zůstávají přímo u formulářů a databázových pravidel.


## v0.20

- Oprava pádu seznamu letů při nově přidaném letu s prázdným nebo nečíselným polem.
- Robustnější formátování prázdných hodnot v seznamu letů.
- Databáze se nemění; nahrává se pouze kód aplikace.


## v0.24

Oprava zobrazení sidebaru po jeho skrytí. Nativní ovládací tlačítko Streamlit sidebaru zůstává viditelné i při sbaleném sidebaru.


## v0.24
- Horní Streamlit lišta je znovu skrytá.
- Sidebar je vynuceně viditelný, aby nezmizel bez možnosti návratu.
