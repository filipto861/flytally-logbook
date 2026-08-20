# Nasazení v0.60.2

1. Zálohuj `data/logbook.sqlite`.
2. V lokálním Git repozitáři zachovej `.git` a `data`.
3. Nahraď aplikační soubory obsahem v0.60.2.
4. Obsah `data` z release zkopíruj do existujícího `data`; `logbook.sqlite` v release není.
5. V GitHub Desktopu ověř, že `data/logbook.sqlite` není omylem smazaná nebo nahrazená.
6. Commit: `v0.60.2 - Inline Aircraft Creation`.
7. Pokud GitHub auto-backup mezitím vytvořil vzdálený commit, použij **Fetch → Pull origin → Push origin**.
8. Po deployi se přihlas a otestuj KML s registrací, kterou daný testovací účet ještě nemá v databázi letadel.

## Doporučený test

### KML s novým letadlem
- přihlas se testovacím uživatelem,
- nahraj KML s registrací bez existujícího profilu,
- má se otevřít popup pro vytvoření letadla,
- vyplň typ, třídu, cenu a další parametry,
- vytvoř profil,
- ověř, že se vrátíš do stejného KML importu a nic z tracku nezmizelo,
- ulož let a zkontroluj Databáze → Letadla.

### Pokračovat bez profilu
- použij jinou novou registraci,
- v popupu zvol **Pokračovat bez profilu**,
- let musí jít normálně uložit.

### Ruční let
- zvol Ručně,
- zadej novou registraci a ostatní údaje,
- po potvrzení se má otevřít popup,
- po vytvoření profilu se původní let dokončí bez opakovaného vyplňování.

### Smart KML regression
- ověř, že stále funguje rozdělení více letů a detekce touch-and-go.
