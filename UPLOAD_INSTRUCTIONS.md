# Nasazení v0.58

1. Zálohuj `data/logbook.sqlite`.
2. V lokálním Git repozitáři zachovej `.git` a `data`.
3. Nahraď aplikační soubory obsahem v0.58.
4. Obsah `data` z release zkopíruj do existujícího `data`; `logbook.sqlite` v release není.
5. Ověř v GitHub Desktopu, že `data/logbook.sqlite` není omylem smazaná nebo nahrazená.
6. Commit: `v0.58 - Aircraft Profiles & Pricing UX`.
7. Pokud mezitím GitHub auto-backup vytvořil vzdálený commit, použij Fetch/Pull a potom Push.
8. Streamlit aplikaci po deployi otevři a zkontroluj Databáze → Letadla.

## Test po nasazení

- Samostatná položka Ceník už není v menu.
- Databáze → Letadla zobrazí karty letadel.
- Otevření profilu zobrazí aktuální cenu a historii.
- Změna ceny s dnešním datem vytvoří nový historický záznam.
- Historická sazba zadaná např. od 01.01.2025 se správně zobrazí v historii.
- Budoucí sazba se před datem účinnosti nezobrazí jako aktuální.
- Přidání nového letadla vytvoří profil a volitelně první cenový záznam.
- Běžný uživatel vidí jen svoje letadla a ceny; admin data ostatních uživatelů zůstávají oddělená.
