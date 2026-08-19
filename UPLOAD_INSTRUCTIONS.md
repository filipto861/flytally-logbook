# Upload instructions – v0.40

Nahraj minimálně:

- `app.py`
- `README.md`
- `UPLOAD_INSTRUCTIONS.md`

Složka `logbook_core/` může zůstat v repozitáři. Aplikace má fallback, takže nespadne ani při chybějícím modulu, ale pro v0.39+ optimalizace je vhodné ji ponechat.

NEPŘEPISOVAT:

- `data/logbook.sqlite`

Po uploadu proveď ve Streamlit Cloud:

`Manage app → Reboot app`
