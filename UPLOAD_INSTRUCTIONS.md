# Upload v0.63.1

1. Zachovej lokální `.git` a `data/logbook.sqlite`.
2. Nahraď aplikační soubory obsahem tohoto balíčku.
3. Zkontroluj, že `data/logbook.sqlite` zůstalo na místě a není mezi změněnými/smazanými soubory.
4. Otevři GitHub Desktop.
5. Pokud je na remote novější auto-backup databáze, použij nejdřív `Fetch` a `Pull origin`.
6. Commit doporučený jako:
   `v0.62.2 - Sidebar UX Final Polish`
7. `Push origin`.
8. Po redeployi ověř zejména:
   - minimalistický dvojitý chevron na hraně sidebaru,
   - plynulé skrytí i odkrytí sidebaru,
   - favicon,
   - single KML import až po finální kontrolu,
   - tlačítko Upravit údaje,
   - split KML a review každé části,
   - inline vytvoření chybějícího letadla,
   - touch-and-go count.

Release ZIP neobsahuje `data/logbook.sqlite`.


### v0.62.2 note
`sitecustomize.py` is intentionally replaced by a no-op compatibility placeholder. Make sure this file is overwritten too; do not retain an older monkeypatching version.


### v0.62.2 smoke test
Po deployi ověř Dashboard pro `Vše`, `Tento rok` a `Posledních 12 měsíců`, následně projdi Přehled, Letadla, Letiště a trasy, Náklady a Poslední lety. `data/logbook.sqlite` se nemění.

### v0.63.1 smoke test

1. Zachovej `.git` a `data/logbook.sqlite`.
2. Nahraď aplikační soubory obsahem release ZIPu.
3. Po deployi ověř novou položku **Recency** v sidebaru.
4. Ověř poslední let/přistání a 30/90/365 denní tabulku.
5. Přidej testovací termín platnosti, uprav ho a odstraň ho.
6. Ověř, že druhý uživatel termín prvního uživatele nevidí.
7. Doporučený commit: `v0.63.1 - Pilot Currency & Recency`.
