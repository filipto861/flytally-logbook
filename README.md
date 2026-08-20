# Letový zápisník

Verze: **v0.60.1**

## v0.60.1 – Smart KML Import

v0.60.1 je opravná verze Smart KML importu zaměřená na reálné ADS-B mezery mezi přistáním a dalším vzletem. Detekce nyní kombinuje délku časové mezery, polohu bodů před/po mezeře a trend výšky/rychlosti. Velmi dlouhá mezera se zobrazí jako návrh na rozdělení i při neúplných datech, protože pilot může návrh vždy odmítnout.

Nově jsou **Možnosti importu zobrazené vždy**. Pokud Smart KML automaticky žádné rozdělení nenajde, lze zvolit **Nahrát jako jeden let** nebo **Rozdělit ručně**; ruční posuvník se při časové mezeře přednastaví právě na ni.

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
- `APP_VERSION = v0.60.1`
- `DB_SCHEMA_VERSION = 8`
- Není nutná migrace struktury databáze.
- SQLite + privátní GitHub auto-backup zůstává zachován.
- Release ZIP neobsahuje `data/logbook.sqlite`.
