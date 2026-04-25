# Tenisový klub - Plánování turnajů

Webová aplikace pro plánování turnajů tenisového klubu s podporou rolí (rodič, trenér, manažer).

## Technologie

- **Next.js 15+** (App Router, TypeScript)
- **Tailwind CSS** pro styling
- **Supabase** pro autentizaci a databázi (PostgreSQL + RLS)

## Struktura projektu

```
tennis-club/
├── app/
│   ├── (auth)/
│   │   └── login/          # Přihlašovací stránka
│   ├── parent/             # Dashboard rodiče
│   ├── coach/              # Dashboard trenéra
│   ├── manager/            # Dashboard manažera
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Redirect podle role
├── components/             # React komponenty
├── lib/
│   ├── supabase/           # Supabase klienti
│   ├── config.ts           # Konfigurace (role, admin e-maily)
│   └── utils.ts            # Pomocné funkce
├── supabase/
│   └── schema.sql          # SQL schéma databáze
└── types/
    └── database.ts         # TypeScript typy pro databázi
```

## Instalace a spuštění

### 1. Instalace závislostí

```bash
npm install
```

### 2. Nastavení Supabase

1. Vytvoř nový projekt na [supabase.com](https://supabase.com)
2. V Supabase Dashboard:
   - Jdi do **SQL Editor**
   - Otevři soubor `supabase/schema.sql` z tohoto projektu
   - Zkopíruj celý obsah a vlož do SQL Editoru
   - Spusť SQL (tlačítko "Run" nebo Ctrl+Enter)
3. Získej API klíče:
   - Jdi do **Settings** → **API**
   - Zkopíruj:
     - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
     - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Nastav Authentication:
   - Jdi do **Authentication** → **URL Configuration**
   - V **Site URL** nastav: `http://localhost:3000/login` (pro vývoj)
   - V **Redirect URLs** přidej: `http://localhost:3000/login`

### 3. Konfigurace prostředí

1. Zkopíruj `.env.local.example` jako `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Vyplň hodnoty v `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **Důležité:** Uprav admin e-mail v `lib/config.ts`:
   ```typescript
   export const ADMIN_EMAILS = [
     'tvuj-email@example.com', // Nahraď svým e-mailem
   ];
   ```

### 4. Spuštění vývojového serveru

```bash
npm run dev
```

Aplikace poběží na [http://localhost:3000](http://localhost:3000)

## Použití

### První přihlášení

1. Otevři `/login`
2. Zadej svůj e-mail
3. Klikni na "Odeslat magický odkaz"
4. Zkontroluj e-mail a klikni na odkaz
5. Po přihlášení budeš přesměrován podle role:
   - **Rodič** → `/parent`
   - **Trenér** → `/coach`
   - **Manažer** → `/manager`

### Role a oprávnění

#### Rodič (`parent`)
- Vidí pouze své děti (hráče)
- Může přidávat, upravovat a mazat turnaje pro své děti
- Turnaje jsou seskupené podle týdnů
- Vidí přehled odehraných turnajů vs. limit

#### Trenér (`coach`)
- Vidí pouze své svěřence (hráče, kde `coach_id = jeho id`)
- Vidí matici: sloupce = hráči, řádky = turnaje
- Buňky obsahují místo, kategorii a prioritu
- Cíl: rychle vidět, kdo z jeho hráčů jede na stejný turnaj

#### Manažer (`manager`)
- Vidí všechny hráče a turnaje
- Stejná matice jako trenér, ale pro všechny hráče
- Možnost filtrovat podle trenéra a týdne
- Cíl: plánování klubových výjezdů

#### Super účet (admin)
- Pokud je tvůj e-mail v `ADMIN_EMAILS`, máš práva manažera
- Navíc máš přepínač rolí v headeru
- Můžeš se "dívat jako" rodič/trenér/manažer (uloženo v localStorage)
- Přepínač slouží jen k zobrazení, neovlivňuje RLS v databázi

## Datový model

### Tabulky

1. **app_user** - Uživatelé s rolemi
2. **player** - Hráči (děti)
3. **tournament** - Turnaje
4. **entry** - Přihlášky hráčů na turnaje

### Automatické výpočty

- `entry_deadline` – primárně parsovaný `sign_in_deadline_text` z ITF factsheetu,
  fallback `datum - 10 dní`
- `withdraw_deadline` – primárně parsovaný `withdrawal_deadline_text` z ITF factsheetu,
  fallback `datum - 2 dny`

Tyto hodnoty se počítají automaticky triggerem `calculate_tournament_deadlines`
(viz `supabase/fix_tournament_deadline_logic_from_itf.sql`).

## Row Level Security (RLS)

Aplikace používá RLS pro zabezpečení dat:

- **Rodič** vidí a upravuje pouze své děti a jejich přihlášky
- **Trenér** vidí pouze své svěřence
- **Manažer** vidí všechno

## Další kroky a vylepšení

### 1. Sledování limitu turnajů
- Přidat automatické upozornění, když se blíží limit
- Možnost změnit limit pro jednotlivé hráče
- Zobrazení zbývajících turnajů v přehledu

### 2. Rozšíření UI
- **Týdenní kalendář** - vizuální zobrazení turnajů v kalendáři
- **Filtry** pro rodiče:
  - Filtrovat podle kategorie
  - Filtrovat podle místa
  - Filtrovat podle priority
- **Export do CSV/PDF** pro manažera
- **Notifikace** - e-mailové upozornění na blížící se uzávěrky

### 3. Pokročilé funkce
- **Status přihlášky** - možnost změnit status (plánováno → přihlášeno → odehráno)
- **Sdílené turnaje** - když více rodičů přihlásí stejný turnaj, vytvoří se jeden záznam
- **Historie** - archivace starých turnajů
- **Statistiky** - přehledy pro trenéry a manažery
- **Import/Export** dat

### 4. Bezpečnost
- Ověření e-mailu před vytvořením účtu
- Rate limiting na API endpointy
- Audit log pro důležité akce

## Řešení problémů

### Chyba při přihlášení
- Zkontroluj, že máš správně nastavené `Site URL` v Supabase
- Ověř, že `.env.local` obsahuje správné hodnoty

### RLS chyby
- Zkontroluj, že SQL schéma bylo správně nahráno
- Ověř, že uživatel má správnou roli v tabulce `app_user`

### TypeScript chyby
- Spusť `npm run build` pro kontrolu typů
- Zkontroluj, že všechny importy jsou správné

### Špatné datum turnaje / chybějící `Uzávěrka (ITF)`
Pokud narazíš na jakýkoli turnaj s divným datumem (typicky 1. v měsíci) nebo
kde v UI chybí blok `Uzávěrka (ITF)` / `Odhlášení (ITF)`, spusť:

```bash
npm run refresh-tournaments     # stáhne čerstvý ITF kalendář + factsheety
npm run check-parent-sms-fix    # ověří, že deadliny a datumy v DB sedí
```

Obojí je bezpečné pouštět opakovaně. Detailní runbook a SQL dotazy jsou
v [`docs/TROUBLESHOOTING-TURNAJE.md`](docs/TROUBLESHOOTING-TURNAJE.md).

## Destructive operations

By default, `scripts/import-tournament-cache.js` is non-destructive: it only
upserts (`onConflict: tournament_key`). No rows are ever deleted automatically.
Both the GitHub Actions cron (`.github/workflows/update-tournament-cache.yml`)
and the manual wrapper (`scripts/refresh-tournaments.sh`) run in this safe
upsert-only mode. This guarantees that an incomplete scrape can never silently
drop tournaments from `tournament_cache`.

To enable **window-diff cleanup** (delete DB rows that fall inside the active
time window but are missing from the current batch), pass `--cleanup`
explicitly. Requires a window (`--from-today` and/or `--window-months=N`).
Cleanup is skipped automatically if any upsert batch fails.

To **wipe and reload the entire table**, pass `--replace-all`. This is guarded
by a sanity check that refuses to delete when the new batch is less than 50 %
of current DB size. Override with `--force-replace` only for intentional
migrations or schema changes.

Additionally, an import with a window set is rejected if the filtered batch
contains fewer than 20 rows — a strong indicator of an incomplete scrape.
Override with `--skip-min-rows-check` if the small batch is expected.

Examples:

```bash
# Safe default: upsert only, no deletes.
node scripts/import-tournament-cache.js data/tournament-cache.json \
    --from-today --window-months=4

# Opt-in window-diff cleanup (deletes orphans inside the window).
node scripts/import-tournament-cache.js data/tournament-cache.json \
    --from-today --window-months=4 --cleanup

# Full wipe + reload (guarded by 50 % sanity check).
node scripts/import-tournament-cache.js data/tournament-cache.json \
    --replace-all

# Full wipe + reload with sanity check bypassed (only for intentional migrations).
node scripts/import-tournament-cache.js data/tournament-cache.json \
    --replace-all --force-replace
```

## Licence

Tento projekt je vytvořen pro interní použití tenisového klubu.
