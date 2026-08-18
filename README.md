# Letový zápisník

Lokální / Streamlit pilotní logbook pro evidenci letů, náletů, nákladů a GPS/KML tracků.

## Spuštění lokálně

```bash
pip install -r requirements.txt
streamlit run app.py
```

## Deploy na Streamlit Community Cloud

1. Nahraj repozitář na GitHub.
2. Otevři Streamlit Community Cloud.
3. Vytvoř novou aplikaci z tohoto repozitáře.
4. Main file path nastav na:

```text
app.py
```

Aplikace obsahuje aktuální reálnou databázi letů v `data/logbook.sqlite`.

## Důležité k persistenci dat

Streamlit Community Cloud je vhodný pro test a demo. Zápisy do lokální SQLite databáze nemusí být trvale persistentní po restartu/redeployi aplikace. Pro ostré používání je vhodnější VPS / vlastní hosting nebo externí databáze.

## Funkce

- dashboard celkového náletu
- ULL / EASA evidence
- PIC, DUAL, Safety Pilot statistiky
- náklady podle hodinových sazeb
- evidence a editace letů
- KML tracky
- mapa všech letů
- detail jednotlivého letu s mapou, vertikálním profilem a rychlostí
- export do Excelu
