# Upload v0.61.5

1. Zachovej lokální `.git` a `data/logbook.sqlite`.
2. Nahraď aplikační soubory obsahem tohoto balíčku.
3. Zkontroluj, že `data/logbook.sqlite` zůstalo na místě a není mezi změněnými/smazanými soubory.
4. Otevři GitHub Desktop.
5. Pokud je na remote novější auto-backup databáze, použij nejdřív `Fetch` a `Pull origin`.
6. Commit doporučený jako:
   `v0.61.5 - Sidebar UX Final Polish`
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
