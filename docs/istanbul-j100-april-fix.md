# J100 Istanbul 20.–26.4. chybí v nabídce turnajů

## Zjištění

- V `data/tournament-cache-full.json` jsou **dva** záznamy „J100 Istanbul“, oba mají:
  - `tournamentKey`: `J-J100-TUR-2026-003`
  - `startDate`: **30 Mar, 2026** (turnaj 30.3.–5.4.)
- Druhý turnaj **J100 Istanbul 20.–26.4.** v datech z ITF **není** – buď ho kalendář neuvádí jako samostatný, nebo má stejný klíč a při deduplikaci zůstane jen jeden (30.3.).
- Výběr v aplikaci tedy správně ukazuje jen ten první týden; druhý týden tam být nemůže, dokud ho nemáme v cache.

## Řešení (stejný princip jako u J100 Loughborough)

1. **Ruční záznam v overrides**  
   Do `data/tournament-cache-overrides.json` přidat záznam pro J100 Istanbul s datem **20.4.2026** a vlastním `tournament_key` (např. `MANUAL-J100-ISTANBUL-TUR-2026-04-20`), aby se při importu nepletl s prvním týdnem.

2. **Znovu spustit import cache**  
   Aby se overrides načetly do DB:
   ```bash
   ./scripts/refresh-tournaments.sh
   ```
   nebo jen import z aktuálního JSON včetně overrides (podle toho, jak máte pipeline nastavenou).

3. **Ověření**  
   - V DB: `SELECT * FROM tournament_cache WHERE name ILIKE '%istanbul%' AND category ILIKE '%J100%' ORDER BY start_date;`  
     → měly by být dva řádky (30.3. a 20.4.).
   - V aplikaci: vyhledat „Istanbul“ nebo „J100 Istanbul“ – měly by se nabídnout oba turnaje.

## Do budoucna

- Pokud ITF bude druhou dubnovou stovku v Istanbulu uvádět pod jiným kódem / URL, lze overrides později odstranit a spoléhat na feed.
- Případně rozšířit fetch (kalendář / factsheety) tak, aby se rozlišovaly dva týdny u stejného města a kategorie – to by vyžadovalo úpravu skriptů a znalost struktury ITF stránek.
