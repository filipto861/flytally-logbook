# Upload v0.54

v0.53 už vytvořila čistou strukturu GitHub repozitáře. Pro v0.54 není potřeba nic hromadně mazat.

## Kritické pravidlo

**Zachovat stávající `data/logbook.sqlite`.** Release ZIP tento soubor neobsahuje.

## Doporučený postup

1. Rozbal ZIP v0.54 do samostatné složky.
2. Zkopíruj celý obsah rozbalené v0.54 do lokálního repozitáře `Documents/GitHub/Logbook`.
3. Windows se zeptá na nahrazení existujících souborů — potvrď nahrazení.
4. Ověř, že `data/logbook.sqlite` je stále přítomný.
5. Otevři GitHub Desktop a zkontroluj změny.
6. Commit message: `v0.54 - GPS Map Engine 2.0`.
7. Commitni a následně `Push origin`.
8. Počkej na automatický redeploy Streamlit Cloud.

## Po nasazení

1. Ověřit badge `v0.54`.
2. Otevřít `Mapa → GPS tracky`.
3. Vyzkoušet `Rychlá`, `Střední` a `Vše`.
4. Zkontrolovat, že trasy vypadají přirozeně a zatáčky nejsou useknuté.
5. Otevřít detail letu se Smooth Track Playerem.
6. Importovat jeden testovací KML.
7. Ověřit Dashboard, Lety a Export.
8. Ověřit, že všechny stávající lety a tracky zůstaly v databázi.
