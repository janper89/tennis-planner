# Průvodce: První nastavení cache turnajů (krok za krokem)

Tento průvodce tě provede od nuly až po fungující vyhledávání turnajů v aplikaci. Předpokládá, že máš běžící Supabase projekt a aplikaci tennis-club.

---

## Co budeš potřebovat

- Přístup do **Supabase Dashboard** (tvůj projekt)
- **Node.js** nainstalovaný (pro spuštění importu)
- Volitelně: **účet IPIN** na ipin.itftennis.com (pokud chceš tahat data z factsheetů; jinak můžeš začít s ručním JSON)

---

## Krok 1: Spustit migrace v Supabase

Bez těchto tabulek aplikace nemůže vyhledávat v cache.

1. Otevři **Supabase Dashboard**: https://supabase.com/dashboard a vyber svůj projekt.
2. V levém menu klikni na **SQL Editor**.
3. Vytvoř **nový dotaz** (New query).

**1a) Migrace pro sloupec tournament_key**

- Otevři v editoru soubor `supabase/add_tournament_key.sql` z projektu.
- Zkopíruj **celý obsah** a vlož ho do SQL Editoru v Supabase.
- Klikni **Run** (nebo Ctrl+Enter).
- Mělo by se zobrazit „Success“ (bez chyby).

**1b) Migrace pro tabulku tournament_cache**

- Otevři soubor `supabase/tournament_cache.sql`.
- Zkopíruj **celý obsah** a vlož do SQL Editoru (můžeš smazat předchozí dotaz nebo přidat pod něj).
- Znovu **Run**.
- Mělo by se zobrazit „Success“.

**1c) Rozšíření o pole z factsheetu (volitelné)**

- Pokud chceš ukládat plná data z factsheetu (draw size, deadliny, ředitel, venue atd.), otevři `supabase/tournament_cache_factsheet_columns.sql`, zkopíruj obsah do SQL Editoru a **Run**.

Tím máš v databázi tabulku `tournament_cache` a sloupec `tournament_key` u tabulky `tournament`.

---

## Krok 2: Připravit soubor s turnaji (JSON)

Máš tři cesty: **stáhnout z kalendáře ITF** (doporučeno), **rychlé otestování s ručním JSON** nebo **extrakce z IPIN factsheetů po jednom**.

### Varianta A: Stáhnout z kalendáře ITF Juniors (doporučeno – najednou)

Nemusíš otevírat každý turnaj zvlášť. Jeden příkaz stáhne seznam turnajů z veřejného kalendáře [ITF World Tennis Tour Juniors](https://www.itftennis.com/en/tournament-calendar/world-tennis-tour-juniors-calendar/) a uloží ho jako `data/tournament-cache.json`.

1. V kořeni projektu nainstaluj Puppeteer (stačí jednou):
   ```bash
   npm install
   ```
   (Puppeteer je už v devDependencies.)

2. Spusť stahování kalendáře (uveď měsíc/rok, např. únor 2026):
   ```bash
   node scripts/fetch-calendar-itf-juniors.js 2026-02
   ```
   Bez argumentu se použije aktuální měsíc. (Skript používá Puppeteer – při prvním spuštění se může stáhnout Chromium.)

3. Skript otevře kalendář v prohlížeči (na pozadí), vytáhne názvy turnajů, města, data a kategorie a uloží je do `data/tournament-cache.json`. Na konci uvidíš: „OK: uloženo X turnajů do data/tournament-cache.json“.

4. Pokračuj **Krokem 4** (env) a **Krokem 5** (import do DB). Factshet nemusíš otevírat.

**Poznámka:** Pokud ITF změní vzhled kalendáře, selektory ve skriptu může být potřeba upravit. V takovém případě můžeš dočasně použít Variantu B nebo C.

**Automatické stažení plných factsheetů (doporučeno):** Po spuštění kalendáře můžeš jedním příkazem stáhnout pro všechny turnaje z kalendáře plná data (draw size, deadliny, ředitel atd.) a rovnou je importovat do Supabase:
```bash
node scripts/fetch-factsheets-bulk.js --import
```
Volitelně: `--limit=5` (jen prvních 5 turnajů), nebo uvést cestu k jinému JSON: `node scripts/fetch-factsheets-bulk.js data/jiny-kalendar.json --import`. Výstup se ukládá do `data/tournament-cache-full.json`.

### Varianta B: Rychlý test – ruční JSON (na první vyzkoušení)

1. V projektu vytvoř složku `data`, pokud ji ještě nemáš.
2. V ní vytvoř soubor `tournament-cache.json` (přesně takový název).
3. Do souboru vlož například:

```json
[
  {
    "tournamentKey": "test-praha-2025",
    "tournamentName": "Test Prague Junior",
    "city": "Praha",
    "startDate": "2025-06-01",
    "category": "J60"
  },
  {
    "tournamentKey": "test-brno-2025",
    "tournamentName": "Test Brno Cup",
    "city": "Brno",
    "start_date": "2025-07-15",
    "category": "J30"
  }
]
```

Důležité: soubor musí obsahovat **pole** (začíná `[`, končí `]`). Uvnitř jsou objekty s alespoň: identifikátor turnaje (`tournamentKey` nebo `tournament_key`), název (`tournamentName` nebo `name`), `city`, datum (`startDate` nebo `start_date`). Pole `category` je volitelné.

Tím máš dva „testovací“ turnaje, které pak vyhledáš v aplikaci (např. „Prague“ nebo „Brno“).

### Varianta C: Extrakce z IPIN factsheetů (jeden turnaj = jeden factsheet)

Použij jen tehdy, když potřebuješ data z IPIN, která na veřejném kalendáři nejsou.

1. Přihlas se na **https://ipin.itftennis.com**.
2. Otevři stránku **factsheetu** konkrétního turnaje (URL obsahuje `tournamentId=...` a `circuitId=...`).
3. V prohlížeči otevři **Developer Console** (F12, nebo Cmd+Option+I na Macu).
4. Přepni na záložku **Console**.
5. Otevři v editoru soubor `scripts/extract-tournament-browser.js`, zkopíruj **celý obsah** (od začátku do konce).
6. Vlož zkopírovaný kód do konzole a stiskni **Enter**.
7. V konzoli se zobrazí vyextrahovaný JSON a měl by se zkopírovat do schránky.
8. Pro **každý další turnaj** otevři jeho factsheet, znovu vlož ten samý skript do konzole a Enter. Z konzole (nebo staženého souboru) zkopíruj výstup.

### Varianta C2: Extrakce z veřejného ITF factsheetu (Fáze A – plná extrakce)

Pro **veřejné** factsheety (bez přihlášení na IPIN) použij skript **Fáze A**, který vytáhne všechny dostupné údaje: název, město, země, venue, datum začátku/konce, entry deadline, withdrawal deadline, kategorie, povrch.

1. Otevři veřejný factsheet na **https://www.itftennis.com/en/tournament/...** (např. `.../j100-bloemfontein/rsa/2026/j-j100-rsa-2026-001/`).
2. Otevři **Developer Console** (F12 nebo Cmd+Option+I).
3. Zkopíruj celý obsah souboru **`scripts/extract-itf-factsheet-browser.js`** a vlož ho do konzole.
4. Stiskni **Enter**.
5. V konzoli se zobrazí JSON, zkopíruje se do schránky a v konzoli se objeví odkaz na stažení souboru (pravý klik → Uložit odkaz jako).

Vyextrahovaná pole: `tournamentKey`, `tournamentName`, `city`, `country`, `venue`, `startDate`, `endDate`, `drawSize`, `entryDeadline`, `withdrawalDeadline`, `tournamentDirectorName`, `officialBall` a další. **Import do Supabase:** ulož výstup jako JSON soubor (jednořádkový objekt nebo pole objektů), pak v terminálu spusť `node scripts/import-tournament-cache.js cesta/k/souboru.json`. Pro ukládání všech těchto polí musí být v Supabase spuštěna migrace **1c** (`tournament_cache_factsheet_columns.sql`).

**Složení více turnajů do jednoho souboru:**

- Každé spuštění skriptu vrátí **jeden objekt** (začíná `{`, končí `}`).
- Tyto objekty musíš dát do **jednoho pole**: na začátek přidej `[`, mezi objekty dej čárku, na konec `]`.
- Příklad pro dva turnaje:

```json
[
  { "tournamentKey": "...", "tournamentName": "Turnaj 1", "city": "Praha", "startDate": "2025-03-01" },
  { "tournamentKey": "...", "tournamentName": "Turnaj 2", "city": "Brno", "startDate": "2025-04-01" }
]
```

- Výsledek ulož jako `data/tournament-cache.json`.

---

## Krok 3: Zkontrolovat, že soubor je na místě

- Cesta k souboru: **`data/tournament-cache.json`** (v kořeni projektu tennis-club).
- Pokud jsi při importu chtěl použít jiný soubor, zapamatuj si jeho cestu – použiješ ji v příkazu v kroku 5.

---

## Krok 4: Nastavit env proměnné pro import

Import skript potřebuje připojení k Supabase s **service role** klíčem (ne anon key).

1. V **Supabase Dashboard** vyber svůj projekt.
2. V levém menu klikni **Project Settings** (ikona ozubeného kolečka).
3. Klikni na **API**.
4. Zkopíruj:
   - **Project URL** (např. `https://xxxxx.supabase.co`)
   - **service_role** klíč (sekce „Project API keys“ – **secret**, ne „anon public“). Pozor: tenhle klíč nikdy nedávej do kódu ani do repozitáře.

5. V kořeni projektu otevři soubor **`.env.local`** (nebo ho vytvoř). Ujisti se, že v něm jsou tyto řádky (hodnoty nahraď svými):

```
NEXT_PUBLIC_SUPABASE_URL=https://TVE_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...tvůj_service_role_klíč...
```

Pokud tam už máš `NEXT_PUBLIC_SUPABASE_URL` a `NEXT_PUBLIC_SUPABASE_ANON_KEY`, přidej jen řádek s `SUPABASE_SERVICE_ROLE_KEY`. Soubor `.env.local` nesmí být commitovaný (v `.gitignore` už je).

---

## Krok 5: Spustit import

1. Otevři terminál a přejdi do **kořene projektu** tennis-club:
   ```bash
   cd /cesta/k/tennis-club
   ```

2. Spusť import (bez cesty se použije výchozí `data/tournament-cache.json`):
   ```bash
   node scripts/import-tournament-cache.js
   ```
   Pokud máš JSON jinde, napiš cestu:
   ```bash
   node scripts/import-tournament-cache.js data/jiny-soubor.json
   ```

3. V terminálu by se mělo objevit něco jako:
   ```text
   Import done: 2 upserted
   ```
   Pokud uvidíš chybu „Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY“, vrať se ke kroku 4 a zkontroluj `.env.local`.

4. Před importem (nebo po refreshi) spusť validaci cache:
   ```bash
   node scripts/validate-tournament-cache.js data/tournament-cache.json
   node scripts/validate-tournament-cache.js data/tournament-cache-full.json
   ```
   Validace failne při chybějícím `tournamentKey` / nečitelném datu. Ostatní metriky (např. `cityNA`) slouží jako quality report.

---

## Krok 6: Ověřit vyhledávání v aplikaci

1. Spusť aplikaci (pokud neběží):
   ```bash
   npm run dev
   ```

2. Přihlas se jako **rodič** (účet s rolí parent).

3. Přejdi na stránku pro rodiče (přihlášování na turnaje).

4. Zapni **„Automatické vyhledávání (ITF)“** (checkbox).

5. Do pole **„Název turnaje“** zadej část názvu z tvého JSONu – např. **Prague** nebo **Brno** (u testovacího příkladu z varianty A).

6. Vyplň zbytek formuláře (hráč, priorita atd.) a odešli.

- Pokud je vše nastavené správně, aplikace najde turnaj v cache, vytvoří z něj záznam (nebo použije existující) a vytvoří přihlášku.
- Pokud turnaj nenajde, zobrazí hlášku „Turnaj nebyl nalezen v seznamu turnajů“ a můžeš pokračovat ručním zadáním.

---

## Shrnutí pořadí

| Krok | Co dělat |
|------|----------|
| 1 | V Supabase SQL Editoru spustit `add_tournament_key.sql` a pak `tournament_cache.sql`. |
| 2 | Připravit `data/tournament-cache.json` (ruční JSON nebo extrakce z IPIN + složení do pole). |
| 3 | Ověřit, že soubor je v `data/tournament-cache.json`. |
| 4 | Do `.env.local` doplnit `SUPABASE_SERVICE_ROLE_KEY` (a případně `NEXT_PUBLIC_SUPABASE_URL`). |
| 5 | V terminálu: `node scripts/import-tournament-cache.js`. |
| 6 | V aplikaci jako rodič vyzkoušet vyhledání podle názvu turnaje. |

Až to jednou projdeš, příště stačí aktualizovat `data/tournament-cache.json` (nové/upravené turnaje) a znovu spustit import – skript provede upsert podle `tournament_key`, takže se záznamy aktualizují bez duplicit.

## Provozní checklist (měsíční běh)

- Spusť `./scripts/refresh-tournaments.sh --no-import` a ověř, že neskončí na validaci.
- Zkontroluj quality report (`cityNA`, `duplicatedNamePattern`, `nullCategory`) a porovnej s minulým během.
- Pokud jsou metriky podezřele horší, uprav `data/tournament-cache-overrides.json` nebo proveď ruční kontrolu problematických turnajů.
- Teprve potom spusť import (`./scripts/refresh-tournaments.sh` nebo `node scripts/import-tournament-cache.js ...`).
