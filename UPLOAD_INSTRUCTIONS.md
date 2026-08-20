# Nasazení v0.59

1. Zálohuj `data/logbook.sqlite`.
2. V lokálním Git repozitáři zachovej `.git` a `data`.
3. Nahraď aplikační soubory obsahem v0.59.
4. Obsah `data` z release zkopíruj do existujícího `data`; `logbook.sqlite` v release není.
5. V GitHub Desktopu ověř, že `data/logbook.sqlite` není omylem smazaná nebo nahrazená.
6. Commit: `v0.59 - User Profile & Permission Hardening`.
7. Pokud GitHub auto-backup mezitím vytvořil vzdálený commit, použij **Fetch → Pull origin → Push origin**.
8. Po deployi se přihlas nejdřív admin účtem.

## Test po nasazení

### Admin účet
- všechny dosavadní lety jsou stále viditelné,
- Profil → Výchozí hodnoty se uloží,
- Admin → Bezpečnost hlásí stav **OK**,
- Admin menu je dostupné pouze adminovi.

### Testovací běžný účet
- nevidí admin menu,
- nevidí lety, letadla, ceny ani custom letiště admina,
- může přidat/editovat/smazat vlastní let bez admin hesla,
- může přidat vlastní letadlo a vlastní cenu,
- vlastní profil a heslo lze upravit.

### Nastavení
- domovské letiště se předvyplní do ručně přidávaného letu,
- výchozí role a evidence se předvyplní,
- změna časového pásma ovlivní lokální časy KML/GPS,
- změna měny změní popisky cen/nákladů v UI a exportech.
