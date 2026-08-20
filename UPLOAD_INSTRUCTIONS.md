# Nasazení v0.57

1. Zálohuj `data/logbook.sqlite`.
2. V lokálním Git repozitáři zachovej `.git` a `data`.
3. Nahraď aplikační soubory obsahem v0.57.
4. Obsah `data` z release zkopíruj do existujícího `data`; `logbook.sqlite` v release není.
5. Ověř, že `data/logbook.sqlite` stále existuje a není mezi změněnými soubory.
6. Commit: `v0.57 - Roles & Admin Console`.
7. Pokud mezitím GitHub auto-backup vytvořil vzdálený commit, použij Fetch/Pull a potom Push.
8. Po deployi se schema automaticky posune na 8 a původní user ID 1 dostane roli admin.

## Test po nasazení

- Přihlásit se jako původní účet a ověřit všechny staré lety.
- Ověřit, že Nový let/Editace/Track/Ceník/Letadla/Custom letiště nevyžadují admin heslo.
- Otevřít Admin → Uživatelé a vytvořit testovací účet s rolí Uživatel.
- Odhlásit se a přihlásit testovacím účtem.
- Testovací účet musí mít prázdný zápisník a nesmí vidět Admin menu ani data původního účtu.
- Přidat testovací let a ověřit, že se po návratu do admin účtu neobjeví mezi jeho lety.
