# Logbook architecture — v0.57

## Identity and ownership

Každá privátní datová tabulka je oddělena pomocí `user_id`. `user_id = 1` zůstává původní vlastník všech dat vytvořených před multi-user verzí.

## Authorization

Tabulka `users` obsahuje trvalý sloupec `role`:

- `admin` – správce aplikace,
- `user` – běžný pilot.

Při migraci na schema 8 je `user_id = 1` automaticky nastaven na `admin`; ostatní profily na `user`.

Autorizace má dvě vrstvy:

1. přihlášený uživatel smí CRUD pouze nad vlastními záznamy (`WHERE user_id = current_user_id`),
2. role `admin` je nutná pouze pro globální správu aplikace, uživatelů a celé databáze.

Admin heslo ze Streamlit Secrets už není druhým heslem pro běžné CRUD operace. Může zůstat pouze jako bezpečnostní mechanismus při prvotní aktivaci legacy profilu.

## Admin console

Admin konzole je samostatná stránka dostupná pouze roli `admin`. Veřejná registrace může zůstat vypnutá; testovací a budoucí profily lze vytvořit ze správy uživatelů.

## Persistence

Aktuálně SQLite + GitHub auto-backup. Datový model je koncipován tak, aby pozdější PostgreSQL backend zachoval stejné `user_id` a role.
