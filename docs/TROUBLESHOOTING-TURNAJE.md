# Troubleshooting: Data turnajů, Uzávěrka a Odhlášení

Tato stránka popisuje časté problémy kolem datumů a deadlinů turnajů v aplikaci
a jak je řešit. Platí od dubna 2026 (commit `26ada7a`).

## Zlaté pravidlo

> **Pokud narazíš na jakýkoli turnaj s divným datumem nebo kde `Uzávěrka (ITF)` chybí,
> spusť postupně:**
>
> ```bash
> npm run refresh-tournaments     # stáhne čerstvý kalendář a factsheety z ITF
> npm run check-parent-sms-fix    # ověří, že Villach/Targu Jiu/Budapest a trigger sedí
> ```
>
> **Obojí je bezpečné pouštět opakovaně** (idempotentní). `refresh-tournaments` trvá
> 20–35 minut (Puppeteer stahuje ~400 factsheetů); `check-parent-sms-fix` je rychlý.

## Jak to v aplikaci funguje

- **`tournament_cache`** – lokální zrcadlo ITF kalendáře + factsheetů.
  - `start_date` má být první den hlavního turnaje (main draw).
  - `first_day_main_draw` je text z factsheetu, slouží jako záloha, pokud kalendář
    vrátí jen fallback `YYYY-MM-01`.
  - `sign_in_deadline_text` a `withdrawal_deadline_text` jsou textové deadliny
    přímo z ITF factsheetu (např. `"Tue 14th April 2026 by 15:00GMT"`).
- **`tournament`** – konkrétní přihláška hráče. Má vlastní kopii `datum`,
  `entry_deadline`, `withdraw_deadline`, která se nepropisuje automaticky zpět
  z cache – proto existující přihlášky můžou zůstat s historickým datem, i když
  se cache opraví.
- **DB trigger `calculate_tournament_deadlines`** (viz
  [`supabase/fix_tournament_deadline_logic_from_itf.sql`](../supabase/fix_tournament_deadline_logic_from_itf.sql))
  při insert/update `tournament.datum` / deadline textů přepočte:
  - `entry_deadline = parse_itf_deadline_date(sign_in_deadline_text)`, fallback `datum - 10 dní`
  - `withdraw_deadline = parse_itf_deadline_date(withdrawal_deadline_text)`, fallback `datum - 2 dny`

## UI konvence (od dubna 2026)

- V hlavičce turnaje na dashboardu se zobrazuje jen `Datum` a `Priorita`.
- Pole `Uzávěrka` a `Odhlášení` **jsou skryté** (rušila, protože se
  v minulosti počítala fixně `-10/-2` bez ohledu na ITF).
- V sekci `Factsheet` (pod turnajem) jsou:
  - **`Uzávěrka (ITF)`** = `sign_in_deadline_text` (poslední možnost přihlášení)
  - **`Odhlášení (ITF)`** = `withdrawal_deadline_text` (freeze deadline)

Zdrojem pravdy pro rodiče je tedy vždy blok `Factsheet` s texty přímo z ITF.

## Typické problémy a postup

### 1. Turnaj má `Datum = 1. měsíce`, ale na ITF má začátek jindy

**Příznak**: V UI vidíš `Datum 01. 05. 2026`, ale ITF říká start 12. 5. nebo 18. 5.

**Příčina**: ITF kalendář občas vrátí jen `YYYY-MM-01` jako fallback, když
skutečné datum ještě není v kalendáři pevně uloženo. Factsheet to ale obvykle
už má jako `first_day_main_draw`.

**Řešení**:

1. `npm run refresh-tournaments` – přetáhne i nové factsheety; import má pojistku,
   že při `YYYY-MM-01` použije `first_day_main_draw`.
2. Pokud existuje i řádek v `tournament` (někdo už přihlásil hráče), aktualizuj
   `tournament.datum` z cache. V [`fix_tournament_deadline_logic_from_itf.sql`](../supabase/fix_tournament_deadline_logic_from_itf.sql)
   je backfill, který to dělá globálně (stačí ho spustit znovu v SQL Editoru, je idempotentní).

Ruční SQL na jeden turnaj:

```sql
UPDATE tournament t
SET datum = c.start_date::DATE
FROM tournament_cache c
WHERE t.tournament_key = c.tournament_key
  AND t.tournament_key = 'J-J200-ROU-2026-001';   -- dosadit klíč
```

### 2. `Uzávěrka (ITF)` je v UI prázdná

**Příčina**: Factsheet u toho turnaje ještě není k dispozici (ITF ho ještě
nezveřejnil) nebo scraper selhal.

**Řešení**:

1. `npm run refresh-tournaments` – zkusí factsheet znovu.
2. Pokud ITF text nikde neuvádí, aplikace použije fallback `datum - 10` /
   `datum - 2` (viditelné jen v DB, v UI se horní pole stejně neukazuje).

### 3. `Odhlášení` je po freeze deadline (starší záznamy)

**Příznak**: Například Villach 27. 4. – rodič psal, že v appce byla
`Odhlášení 25. 4.`, ale freeze deadline je už 14. 4. Rodič by při odhlášení
25. 4. schytal trestné body.

**Příčina**: Starý fixní výpočet `-2 dny`. Migrace to řeší novým triggerem
(viz výše), backfill přepočítá i historické řádky.

**Řešení**:

1. Spusť (opětovně) `supabase/fix_tournament_deadline_logic_from_itf.sql`
   v Supabase SQL Editoru – je idempotentní.
2. Ověř `npm run check-parent-sms-fix`.

### 4. Nový turnaj v cache chybí

**Řešení**: `npm run refresh-tournaments`. Stahuje kalendář 18 měsíců dopředu
a factsheety pro následujících 6 měsíců plánu.

Pokud ani to nepomůže (ITF ho ještě nemá), přidej ruční override do
[`data/tournament-cache-overrides.json`](../data/tournament-cache-overrides.json)
a spusť import: `node scripts/import-tournament-cache.js`.

## Užitečné SQL dotazy

**Kde má cache divné datum** (`YYYY-MM-01` a factsheet říká jindy):

```sql
SELECT tournament_key, name, start_date, first_day_main_draw
FROM tournament_cache
WHERE start_date LIKE '%-01'
  AND first_day_main_draw IS NOT NULL
  AND first_day_main_draw <> start_date::text
ORDER BY start_date;
```

**Zkontroluj deadliny konkrétního turnaje**:

```sql
SELECT tournament_key, nazev, datum, entry_deadline, withdraw_deadline,
       sign_in_deadline_text, withdrawal_deadline_text
FROM tournament
WHERE tournament_key = 'J-J200-AUT-2026-001';
```

**Existuje trigger parse_itf_deadline_date?**

```sql
SELECT parse_itf_deadline_date('Tue 14th April 2026 by 15:00GMT');  -- vratit musi 2026-04-14
```

Pokud vrátí chybu, spusť `supabase/fix_tournament_deadline_logic_from_itf.sql`.

## Související soubory

- [`supabase/fix_tournament_deadline_logic_from_itf.sql`](../supabase/fix_tournament_deadline_logic_from_itf.sql)
- [`scripts/refresh-tournaments.sh`](../scripts/refresh-tournaments.sh)
- [`scripts/import-tournament-cache.js`](../scripts/import-tournament-cache.js)
- [`scripts/check-parent-sms-fix.js`](../scripts/check-parent-sms-fix.js)
- [`lib/tournament-service.ts`](../lib/tournament-service.ts)
- [`components/TournamentFactsheetDetails.tsx`](../components/TournamentFactsheetDetails.tsx)
