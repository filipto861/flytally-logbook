# Letový zápisník

Streamlit pilotní logbook pro evidenci letů, ULL/EASA náletů, nákladů a GPS/KML tracků.

## Aktuální architektura

Aplikace používá SQLite databázi `data/logbook.sqlite`. V databázi jsou uložené:

- `flights` – lety
- `aircraft` – letadla / registrace / typy
- `rates` – hodinové sazby
- `airports` – letiště, UL plochy a další plochy
- `flight_tracks` – metadata KML tracků
- `track_points` – jednotlivé GPS body tracků
- `audit_log` – záznam admin změn
- `app_meta` – stav databáze, schema verze, backup info

Důležitá provozní data nejsou hardcoded v Python kódu. Letiště, letadla a sazby jsou databázové tabulky, které lze spravovat v admin režimu.

## Lokální spuštění

```bash
pip install -r requirements.txt
streamlit run app.py
```

## Streamlit Community Cloud

Main file path:

```text
app.py
```

## Admin přístup

Pro zápis/editaci nastav ve Streamlit Cloud v **App settings -> Secrets**:

```toml
[auth]
admin_password = "tvoje_silne_heslo"
```

Bez `admin_password` aplikace běží v read-only režimu. Dashboard, mapy, export a prohlížení fungují, ale zápis a editace jsou blokované.

## GitHub backup databáze

Volitelně můžeš zapnout ruční backup SQLite databáze zpět do GitHubu. Do Streamlit Secrets přidej:

```toml
[github]
token = "github_pat_xxx"
repo = "filipto861/Logbook"
db_path = "data/logbook.sqlite"
```

Token musí mít právo `contents: read/write` pro tento repozitář. Token nikdy neukládej do repozitáře.

V aplikaci pak v sekci **Databáze -> Záloha** bude tlačítko pro commit aktuální databáze do GitHubu.

## Poznámka k robustnosti

SQLite je pro osobní single-user logbook dobrá databáze. GitHub backup slouží jako verzovaná záloha. Pro multi-user provoz nebo plně produkční aplikaci bez ručního zálohování by byl vhodnější PostgreSQL/Supabase/VPS.
