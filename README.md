# Letový zápisník

Verze: **v0.60**

## v0.60 – Smart KML Import

v0.60 přidává inteligentní analýzu KML/GPS tracků před uložením letu. Cílem je řešit reálné případy, kdy ADS-B/KML soubor obsahuje dva nebo více letů, touch-and-go, časové mezery nebo vadné GPS úseky.

### Detekce více letů

Smart KML analyzuje průběh rychlosti, času a výšky a hledá samostatné letové úseky oddělené přistáním, zastavením, otočením nebo delší mezerou v datech.

Pokud najde pravděpodobně více letů:

- zobrazí upozornění a počet navržených letů,
- nabídne **Rozdělit podle návrhu**,
- vždy zachová možnost **Nahrát jako jeden let**,
- před rozdělením zobrazí mapu jednotlivých částí,
- bod rozdělení lze ručně posunout,
- po uložení prvního dílu se body rozdělení uzamknou,
- jednotlivé části se potom kontrolují a ukládají postupně jako samostatné lety a samostatné GPS tracky.

Detekce je pouze návrh. Původní KML se při volbě „Nahrát jako jeden let“ uloží beze změny.

### Touch-and-go a počet přistání

Smart KML umí detekovat pravděpodobný touch-and-go dvěma způsoby:

- krátký letový/pozemní přechod bez úplného zastavení,
- lokální minimum výšky s následným opětovným stoupáním při zachované rychlosti.

Výsledek automaticky předvyplní pole **Starty / přistání**. Hodnota je vždy editovatelná před uložením letu.

### Kontrola kvality tracku

Import upozorní například na:

- výraznou časovou mezeru mezi GPS body,
- podezřelý GPS skok,
- více samostatných letových úseků.

Upozornění sama data nemažou ani neopravují. Uživatel rozhoduje o výsledném importu.

### Připojení KML k existujícímu letu

Pokud se KML připojuje k již existujícímu letu a Smart KML v něm najde více letů, aplikace zobrazí varování. Track lze stále připojit jako jeden celek; pro skutečné rozdělení se používá **Nový let → KML import**.

### Databáze a multi-user

- Multi-user izolace z v0.59 zůstává zachována.
- Každý vytvořený let i track patří přihlášenému uživateli.
- `APP_VERSION = v0.60`
- `DB_SCHEMA_VERSION = 8`
- Není nutná migrace struktury databáze.
- SQLite + privátní GitHub auto-backup zůstává zachován.
- Release ZIP neobsahuje `data/logbook.sqlite`.
