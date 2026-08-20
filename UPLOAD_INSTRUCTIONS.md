# Upload v0.55

Postup je stejný jako u v0.54.

1. Měj bokem zálohu `data/logbook.sqlite`.
2. Rozbal ZIP v0.55.
3. Zkopíruj jeho obsah do lokálního repozitáře `Documents/GitHub/Logbook`.
4. **Nemaž `.git` a nepřepisuj `data/logbook.sqlite`.** Release ZIP živou databázi neobsahuje.
5. V GitHub Desktop ověř, že `data/logbook.sqlite` není mezi změněnými/smazanými soubory.
6. Commit message: `v0.55 - Multi-User Foundation`.
7. Push origin.
8. Streamlit po redeployi provede při prvním otevření automatickou migraci DB ze schema 5 na 6.
9. Ověř Dashboard, Lety, detail letu, KML/Track Player, Mapu, Ceník a custom letiště.
10. Pokud vše funguje, vytvoř GitHub release/tag `v0.55`.

### Důležité

První start v0.55 může být o něco delší, protože jednorázově upraví databázové schéma. Další starty už používají migration marker a nemají migraci opakovat.
