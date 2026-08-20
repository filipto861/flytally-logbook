# Logbook Streamlit

Verze: **v0.56**

## v0.56 – Authentication & Profiles

v0.56 zapíná přihlášení a uživatelské profily nad multi-user základem z v0.55. Aplikace stále používá SQLite a současný GitHub backup. Ve výchozím nastavení je registrace dalších účtů **vypnutá**, takže aplikace zůstává zatím pouze pro původního uživatele.

### První spuštění – důležité

Původní profil je `user_id = 1`. **Všechny lety, letadla, ceny, custom letiště a GPS data existující před v0.56 zůstávají vlastnictvím tohoto profilu.**

Při prvním startu v0.56 se zobrazí `Aktivovat můj stávající profil`. Aktivace vyžaduje:

- jméno,
- e-mail,
- nové uživatelské heslo,
- současné `auth.admin_password` ze Streamlit Secrets.

Po aktivaci se stávající data nepřesouvají ani nekopírují; profil 1 pouze získá přihlašovací údaje.

### Bezpečnost

- hesla nejsou ukládána v plaintextu,
- používá se `scrypt` se samostatným náhodným saltem,
- e-mail účtu je unikátní bez ohledu na velikost písmen,
- neautentizovaný návštěvník se nedostane do aplikace ani k query parametrům detailu letu,
- plná SQLite databáze je ke stažení pouze po samostatném přihlášení jako správce aplikace,
- nové účty začínají s prázdným logbookem a všechny hlavní datové cesty zůstávají filtrovány podle `user_id`.

### Registrace dalších uživatelů

Ve výchozím nastavení je vypnutá:

```toml
[auth]
admin_password = "..."
allow_registration = false
```

Až bude aplikace připravená pro další piloty, lze dočasně nastavit `allow_registration = true`. Před skutečným veřejným multi-user provozem je stále plánovaný přesun z SQLite/GitHub backupu na PostgreSQL a doplnění ověřování e-mailu/resetu hesla.

### Profil

Nová stránka `Profil` umožňuje spravovat:

- zobrazované jméno,
- časové pásmo,
- měnu,
- domovské letiště,
- výchozí funkci v letu,
- změnu hesla.

### Databáze

Schéma: **7**. Nová tabulka `user_credentials` obsahuje pouze hash hesla a metadata přihlášení. Ownership dat z v0.55 se nemění.

### GitHub backup

Zůstává zachován podle požadavku. Protože DB od v0.56 obsahuje i e-mail a hash hesla, repozitář musí zůstat **private**. Release ZIP jako dříve neobsahuje `data/logbook.sqlite`.

## Testy

Součástí release jsou testy autentizace, aktivace původního profilu, změny hesla, registrace odděleného uživatele, tenancy migrace, core výpočtů a GPS Map Engine 2.0.

## Další plán

1. produkčně ověřit aktivaci profilu 1 a login,
2. doplnit bezpečné resetování/ověření e-mailu,
3. abstrahovat persistence vrstvu,
4. PostgreSQL/Supabase,
5. poté povolit reálný multi-user provoz.
