# Letový zápisník Streamlit

Verze: v0.48.1

## v0.48.1 – Hotfix seznamu letů


- Opraveno formátování tlačítek v seznamu letů.
- Text tlačítek se už nemá lámat pod sebe.
- Akce v seznamu jsou šířkově upravené: Detail / Edit / GPS.
- Editace letu je praktičtější přímo ze seznamu letů.
- V seznamu letů jsou rychlé akce `Detail`, `Edit` a `Track`.
- `Edit` otevře rovnou editační část detailu letu.
- `Track` otevře rovnou část s GPS trackem, pokud ho let má.
- Přidání i editace letu mají kontrolu logbookových pravidel před uložením.
- Kritické chyby blokují uložení.
- Varování upozorní na podezřelé údaje, ale neblokuje uložení starších nebo záměrně neúplných záznamů.
- Kontrola řeší zejména povinné údaje, neplatné časy, Air Time delší než Block Time, logické pořadí časů, nulové starty, nulovou cenu a Safety Pilot.
- Detail letu ukazuje varování/kritické chyby i u existujících záznamů.

## Důležité

Nepřepisovat produkční databázi `data/logbook.sqlite`.
