# Letový zápisník

Aktuální checkpoint: **v0.42 – Export / tisk logbooku 2.0**.

## Změny v0.42

- Přepracovaná část **Export**.
- Přidány filtry exportu podle období, evidence, funkce, imatrikulace, třídy a GPS tracku.
- Nový Excel export s listy:
  - `Zápisník`
  - `Souhrn`
  - `Letadla`
  - `Funkce`
  - `Trasy`
  - `Letiště`
- Přidán CSV export filtrovaných letů.
- Přidána tisková HTML verze, kterou lze otevřít v prohlížeči a uložit jako PDF.
- Export ukazuje souhrn filtrovaných dat ještě před stažením.
- SQLite databáze zůstává dostupná samostatně jako bezpečnostní záloha.

## Bezpečnost dat

Nikdy ručně nepřepisovat:

- `data/logbook.sqlite`

Tento soubor obsahuje živé lety, tracky a ruční data.
