# Nasazení v0.56

Postup je stejný jako u v0.55.

1. Zachovejte lokální `.git`.
2. Zachovejte `data/logbook.sqlite` z běžící aplikace.
3. Nahraďte aplikační soubory obsahem tohoto release.
4. Obsah `data/` z release lze překopírovat; release **neobsahuje `logbook.sqlite`**.
5. V GitHub Desktop ověřte, že `data/logbook.sqlite` není smazán.
6. Commit: `v0.56 - Authentication & Profiles`.
7. Pokud GitHub Desktop hlásí novější remote commit kvůli automatickému DB backupu, nejdřív `Fetch` / `Pull origin`, potom push.
8. `Push origin`.
9. Po redeployi Streamlit zobrazí aktivaci původního profilu.

## Streamlit Secrets

Musí existovat:

```toml
[auth]
admin_password = "VAŠE_SOUČASNÉ_ADMIN_HESLO"
allow_registration = false
```

`admin_password` je při prvním spuštění jednorázově použit také jako důkaz, že aktivaci legacy profilu provádí vlastník aplikace.

## Po prvním spuštění

Aktivujte stávající profil. Tento profil je `user_id = 1` a obsahuje všechny dosavadní lety. Poté zkontrolujte Dashboard, Lety, Mapu, Track Player, Ceník, Databázi a Profil.
