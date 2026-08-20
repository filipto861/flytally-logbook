# Logbook architecture — v0.60.3

## Inline aircraft creation

v0.60.3 přidává do `app.py` malou orchestration vrstvu mezi formulář letu a existující aircraft/rates datovou vrstvu.

Hlavní prvky:

- `_aircraft_profile_exists()` – ověří profil pouze v tenant scope přihlášeného uživatele,
- `_inline_aircraft_prefill()` – sestaví výchozí konfiguraci z právě rozpracovaného letu,
- `inline_aircraft_create_dialog()` – modal pro kompletní vytvoření profilu,
- `_prompt_inline_aircraft_profile()` – uloží dočasný stav a otevře dialog,
- `flight_form(..., prompt_missing_aircraft=True)` – zachytí chybějící profil před finálním vytvořením letu.

## State preservation

Rozpracovaný let se při otevření dialogu neukládá do databáze. Je dočasně držen v `st.session_state` pod klíčem odvozeným z prefixu formuláře.

Existují dva režimy:

1. **preflight** – typicky KML import, registrace je známá před zobrazením formuláře,
2. **postsubmit** – typicky ruční zadání, chybějící profil je zjištěn až při potvrzení formuláře.

Po vytvoření profilu se synchronizují pole vlastněná profilem letadla (typ, evidence, třída, cena, billing basis) a rozpracovaný let pokračuje bez ztráty KML nebo dalších hodnot.

## Escape hatch

Uživatel může vždy pokračovat bez profilu. Bypass je v session vázán na konkrétní registraci, takže změna na jinou neznámou registraci znovu vyvolá kontrolu.

## Existing flight edit

Editace již existujícího letu používá `prompt_missing_aircraft=False`, aby starší historické záznamy bez profilu nebyly nuceně měněny.

## Persistence

Vytvoření letadla používá stávající `upsert_aircraft_profile()` a historické sazby v tabulce `rates`. Nevzniká nové databázové schéma.

- `DB_SCHEMA_VERSION = 8`
- tenant ownership zůstává zachován,
- Smart KML vrstva z v0.60.1 se nemění.
