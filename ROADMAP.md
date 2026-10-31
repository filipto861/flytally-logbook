# FlyTally Logbook — ROADMAP

> **Aktivní plán a rozhodovací rámec, aktualizováno 31. října 2026.** Pouze pro `filipto861/flytally-logbook`; `flytally-training` je samostatný projekt. Aktuální zdrojový kód, databázová schémata, testy a skutečné nasazení mají vždy přednost před starší dokumentací. Rozhodnutí a stav zde nejsou souhlasem s merge, produkčním nasazením ani změnami DB.
>
> **Historie beze ztráty:** [Úplný původní ROADMAP před konsolidací](ROADMAP_ARCHIVE_PRE_COMPACTION_2026-10-31.md) je byte-for-byte zachovaná historická kopie z pracovního commitu `f6dfe48dc2c2fa5eab717060a61ebb8c51ac56f4` (Git blob `f860b3c99499ec59b169e2bdee73940cbfdffa72`). Je to historie včetně dříve superseded / zastaralých plánů, ne druhý aktivní plán. Podrobné revize, audity a testy zůstávají v `docs/maintenance/`, `docs/product/`, `CHANGELOG.md` a GitHub historii.

## 1. Aktuální stav (ověřený, nikoliv automaticky releasovaný)

| Oblast | Aktuální výchozí stav | Důsledky |
| --- | --- | --- |
| Canonical GitHub | `main@807f281e5870164b794d001480ecc84e0b45aea5`; `package.json` na main uvádí `3.8.1` | Commit hlavní větve **není** automaticky deployed commit |
| Nasazení Logbooku | `fly-tally.com`, Vercel READY `dpl_F2jdeRmYPGw4K2mZyvwUVii8SXAU`, zdroj `55c8076e1eb8104c14392e15b272b33e0eb29607` | Produkční DB/schéma/flags **UNKNOWN**; build ≠ provozní/bezpečnostní test |
| Rozpracovaný DATA-1 | Draft PR [#434–#451](https://github.com/filipto861/flytally-logbook/pulls) v navazujícím stacku; relevantní návrhový Draft [#451](https://github.com/filipto861/flytally-logbook/pull/451) proti #450 | Žádná z těchto návrhových větví není automaticky canonical, merged ani deployed |
| Frozen V14 audit | Aplikační kandidát `6fd5597aec03ee7b6cbab4dafd98228fafdaaea1`; návrh V7 `f8f3dc07edce42357a0871599d054c9b5e44f146` | Oddělená verze executable a **design-only**; nové V14 datové modely nejsou implementované |
| Nezávislý audit | Review A **BLOCK — DESIGN ONLY**, 5 P0, 5 P1, 3 P2; dřívější V3 také BLOCK. [Reconciliation](docs/maintenance/2026-10-31-data1e3-d4-a2-v7-independent-audit-a-provisional-reconciliation.md) | Druhý Claude audit **neproběhl**; vlastník se rozhodl ho nyní dále nevyžadovat. Netvrdit, že proběhl duální audit |

S přesným posledním SHA pracovní větve, PR base/HEAD, testy a checkpointy pracuje [SESSION_HANDOFF](docs/PROJECT_MEMORY/SESSION_HANDOFF.md) a [ACTIVE_WORK](docs/PROJECT_MEMORY/ACTIVE_WORK.md). Neopakovat v ROADMAP po každém dokumentačním commitu. Starší stav v archivech nemusí odpovídat dnešnímu runtime.

## 2. Otevřené blokery — data integrity před V14

**P0 existující aplikace — account restore / audit:** `lib/account-restore-v6.ts` v executable i v nasazeném zdrojovém SHA používá globální `MAX(id)`, `DELETE FROM flight_audit_log` a `INSERT ... ON CONFLICT DO NOTHING`; `app/(protected)/export/actions.ts` na restore navazuje. Je to **zdrojově ověřené riziko** ztráty či zkreslení auditního důkazu, **nikoliv doložený produkční incident**. Do ověřené nápravy je doporučeno neprovádět plnou obnovu účtu z portable/stored zálohy; bez výslovného schválení **neměnit** produkční flag/endpoint ani spouštět žádnou obnovu nebo mazání. [Audit A a zdrojové nálezy](docs/maintenance/2026-10-31-data1e3-d4-a2-v7-independent-audit-a-provisional-reconciliation.md).

**Blokery pro budoucí V14 (nikoliv současná V14 produkční chyba):** chybí v14-strict parser, přesné podpisové a kanonizační kontrakty, native N2-S sidecar/immutability/tenant constraints, atomic import historical ledgeru, C2 per-snapshot observations, všecestný complete backup `pre_restore` a restore/erasure anti-resurrection; [37-slot Q00–Q36 je pouze návrhový manifest](docs/maintenance/2026-10-31-data1e3-d4-a2-v14c-c2-observation-manifest-v7-candidate.md). Starý v13 writer zůstává v13; bez nového writeru/readeru nesmí dojít k prvnímu imported-claim write. Výsledek prvního nezávislého review: **BLOCK**. Neprohlašovat žádný z těchto kroků za implementovaný/testovaný.

## 3. Zmrazená rozhodnutí vlastníka (DESIGN ONLY, nikoliv autorizace implementace)

| Rozhodnutí | Platná volba a nepřekročitelná hranice | Zdroj |
| --- | --- | --- |
| Audit identity | **Option 2** — imported historical evidence odděleně od native `flight_audit_log` | [Provenance contract](docs/maintenance/2026-10-30-data1e3-d4-a2-v14-provenance-contract-v1.md) |
| Signed v13 | **Strict A** — jiný autentický digest se stejnou source user + audit ID je atomický konflikt i při shodném obsahu; replay téhož digestu pouze po úplné ekvivalenci | [V13-I](docs/maintenance/2026-10-31-data1e3-d4-a2-v13i-restore-contract-v4-design.md) |
| V13-I + L1 | Podepsanou v13 historii uchovat jako `legacy_v13_imported`, destination **UNATTACHED**; původní flight ID pouze metadata, žádný domyšlený lokální join | [V13-I](docs/maintenance/2026-10-31-data1e3-d4-a2-v13i-restore-contract-v4-design.md) |
| N2-S | Native audit `BIGSERIAL` zůstává immutable; UID při `at_event_insert` nebo explicitní `migration_backfill`, bez přepsání native historie | [Sidecar](docs/maintenance/2026-10-30-data1e3-d4-a2-v14-n2s-sidecar-review-contract-v3.md) |
| V14-C / C2 | Každá signed v14 observation zůstává samostatně immutable; provisional event grouping jen pod strict identical source+UID+event equality; cross-digest `migration_backfill` **BLOCK**, bez falešné physical-instance provenance | [C2](docs/maintenance/2026-10-31-data1e3-d4-a2-v14c-conditional-c2-approved-v5-design.md) |
| R1 K1 / T1 / E | Verifikovatelný keyring + bounded v13 legacy, lawful purpose/category retention, výjimečné právně posouzené vymazání + anti-resurrection | [R1](docs/maintenance/2026-10-31-data1e3-d4-a2-r1-retention-key-rotation-erasure-policy-options-v6-design.md) |

**Neuzavřeno:** finální SQL/DDL, tenant FK/locking, přesná query/manifest cardinality, canonicalization golden vectors, key inventory, konkrétní právní retenční periody/výjimky, backup/suppression mechanismus, multi-session PostgreSQL testy a implementační/release souhlas. Chybějící či nejednoznačné kritické údaje = **UNAVAILABLE/BLOCK**, ne domyšlený default.

## 4. Milníky a pořadí (návrh další práce, vyžaduje rozhodnutí vlastníka)

| Priorita | Malý milník | Acceptance / DO–DO NOT |
| --- | --- | --- |
| **P0 — navrhnout nejdřív** | **M0: samostatný safety fix pro existující account restore** | Nejdřív dohodnout scope a rollback/fail-closed režim, zachovat native audit, odmítnout konflikty; pak pouze výslovně schválený malý patch a izolovaný **2-session PG16**. Nepřepsat historické důkazy, žádné produkční DB operace. |
| P1 | M1: uzavřít V14 schéma/identity/immutable observations a verifikovatelný backup manifest | Exact query slots ze skutečného SQL; cross-runtime vectors; R1 K1/T1/E právní a key policy review; nezamlčet nenaplněné závislosti. **DESIGN ONLY**, dokud další milestone explicitně schválen. |
| P1 | M2: V13-I/N2-S/C2 implementovat v malých kompatibilních dávkách | Pouze na odsouhlasených pracovních větvích, migration-first/additive, celé cesty export–stored–pre_restore–import a flag-OFF fail-closed; zdrojový/perzistentní audit a ownership bez narušení native logu. |
| P1 | M3: kandidat-bound ověření a samostatné rozhodnutí o release | `DEVELOPMENT.md` planner, targeted Node/TypeScript/build, skutečné izolované PG16 concurrency, Neon HTTP tam, kde vyžadováno; readback, rollback, Playwright dle rizik. CI/DEV/PROD výsledky nezaměňovat; **bez výslovného souhlasu žádný merge/deploy/produkční migrace nebo flag**. |

**Další nezávislý Claude audit pro tento návrh momentálně NENÍ plánovaný** podle posledního rozhodnutí vlastníka; přijatý jediný report a jeho nálezy zůstávají otevřené. Toto rozhodnutí nepředstavuje bezpečnostní schválení V14.

## 5. Další produktové směry (nezahajovat implicitně)

- **3.8.x Currency:** `3.8.0` měnové řešení a v21 schéma historicky vydány (viz [CHANGELOG](CHANGELOG.md)); aktuální `package.json` na main = `3.8.1`. Historické řádky „3.8.0 NEXT“ v archivované ROADMAP jsou superseded.
- **N3 — Manual + GPS New Flight simplification:** historicky owner-prioritized, D1 volba/UI pokračování vyžaduje potvrdit proti dnešnímu main; není tím povolena změna logiky Create/Edit/Quick Add.
- **3.9 / 3.10:** multi-aircraft onboarding a sharing/recovery/scale jsou historicky plánované, **zatím bez nového product milestone GO**.
- **Map-provider compliance:** práva Esri/openAIP, attribution, coverage, quotas a usage limits zůstávají oddělená neověřená práce; reference vrstva není approved aviation chart ani EFB.

Zachovat mapy/flight/certification/recency/legacy chování; žádné tiché přepisy dokončených letů, žádný automatický regulatory `CURRENT` bez důkazů. Návazná práce mimo DATA-1 vyžaduje samostatné priority/scope rozhodnutí.

## 6. Dokumentační disciplína — aby ROADMAP znovu nebobtnala

1. **ROADMAP = kompaktní aktuální plán** (ideálně do cca 10–15 tisíc znaků), nikoliv chronologický log každého experimentu, PR a selhání. Při aktualizaci **uprav existující řádek**, nepřidávej další „2026-... checkpoint“ blok.
2. **Dokončené/nahrazené důkazy** a výsledky auditů ukládat **jednou** do cíleného souboru `docs/maintenance/`, `docs/product/` nebo `CHANGELOG.md`; ROADMAP pouze shrnuje stav a odkazuje. Starší plán archivovat **jednorázově**, nikdy nemařit historii.
3. **SESSION_HANDOFF / ACTIVE_WORK** jsou krátké rolling pointery, nikoliv druhá ROADMAP. Přesné full SHA, environment, test logs a aktuální blocker tam patří jen jako stručný checkpoint podle [HANDOFF_PROTOCOL](docs/PROJECT_MEMORY/HANDOFF_PROTOCOL.md); historické záznamy mohou mít samostatný archiv.
4. Pro každý milestone zachovat **owner decision, scope, blockers, acceptance, DO NOT, jeden next step**. Nevypouštět nepohodlný nevyřešený P0 jen kvůli zkrácení.
5. `FEATURES.md` = capabilities; `ARCHITECTURE.md` = contracts; `DEVELOPMENT.md` = testy/release; `CHANGELOG.md` = skutečné změny. Nezavádět druhý kanonický plán ani každodenní duplikace.

## Jeden další krok

**Předložit vlastníkovi úzký návrh M0 — odstranění rizikové logiky `MAX(id)`/native audit DELETE/unchecked replay z existujícího account restore**, včetně fail-closed zachování historických v13 záloh a izolovaných testů; až po jeho zvláštním schválení plánovat implementaci. Žádné automatické zásahy do produkce.
