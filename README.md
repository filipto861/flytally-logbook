# Letový zápisník

Verze: v0.51

## v0.51 – Detail letu / editace 3.0

- GPS track nově připraví samostatný návrh časů Takeoff / Landing a Block ±5 min
- z Track části lze GPS návrh jedním kliknutím přenést do editace letu
- v editaci lze použít buď celý GPS návrh, nebo jen Takeoff + Landing
- GPS návrh nikdy nepřepisuje let automaticky; změna se zapíše až po ručním uložení
- po uložení editace zůstává detail letu otevřený a vrátí se na Přehled
- mazání GPS tracku má potvrzení
- po zápisu/editaci/track operaci se okamžitě invaliduje datová cache, takže se detail a součty nemají držet na starých hodnotách
- smooth Track Player z v0.50.2 zůstává zachovaný

## Upload

Nepřepisovat `data/logbook.sqlite`.
