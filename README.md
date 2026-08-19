# Letový zápisník v0.36.1

Hotfix verze v0.36.1 opravuje pád aplikace při startu po úpravě CSS v KML import wizardu.

## Stav

- v0.36 KML wizard zachován
- opravena CSS f-string chyba v `apply_ui_theme()`
- databáze `data/logbook.sqlite` není součástí ZIPu a nesmí se přepisovat

## Nasazení

Nahraj minimálně:

- `app.py`
- `README.md`
- `UPLOAD_INSTRUCTIONS.md`

Poté v Streamlit Cloud proveď Reboot app a v prohlížeči Ctrl+F5.
