# Nasazení v0.60.1

1. Zálohuj `data/logbook.sqlite`.
2. V lokálním Git repozitáři zachovej `.git` a `data`.
3. Nahraď aplikační soubory obsahem v0.60.1.
4. Obsah `data` z release zkopíruj do existujícího `data`; `logbook.sqlite` v release není.
5. V GitHub Desktopu ověř, že `data/logbook.sqlite` není omylem smazaná nebo nahrazená.
6. Commit: `v0.60.1 - Smart KML Import`.
7. Pokud GitHub auto-backup mezitím vytvořil vzdálený commit, použij **Fetch → Pull origin → Push origin**.
8. Po deployi se přihlas a otestuj import KML.

## Doporučený test po nasazení

### Běžný jeden let
- nahraj běžný KML,
- Smart KML nesmí nutit rozdělení,
- zkontroluj navržené časy a počet startů/přistání,
- ulož let.

### KML se dvěma lety
- nahraj track obsahující přistání / zastavení / nový vzlet,
- aplikace má nabídnout rozdělení,
- zkus nejdříve mapu a posuvník dělicího bodu,
- ověř, že lze místo toho zvolit **Nahrát jako jeden let**,
- při rozdělení ulož obě části a ověř dva samostatné záznamy v Letech.

### Touch-and-go
- nahraj let s touch-and-go,
- ověř počet detekovaných T&G,
- pole **Starty / přistání** má být předvyplněno odpovídajícím číslem,
- hodnotu musí být možné ručně změnit.

### Multi-user
- testovací user vidí pouze vlastní nově importované lety a tracky,
- adminův logbook zůstane oddělený.
