# Tournament Service - Dokumentace

**První nastavení?** Projděte krok za krokem průvodce: [docs/PRUVODCE-CACHE-TURNAJU.md](docs/PRUVODCE-CACHE-TURNAJU.md).

## Přehled

Tournament Service je centralizovaný modul pro vyhledávání turnajů v cache (naplněné z factsheetů) a registraci hráčů. Service eliminuje duplicity pomocí `tournament_key` a zjednodušuje proces přihlašování.

## Instalace

### 1. Databázové migrace

Spusť v Supabase SQL Editoru (v tomto pořadí):

1. **tournament_key na tabulce tournament** – soubor `supabase/add_tournament_key.sql`
2. **Tabulka cache pro vyhledávání** – soubor `supabase/tournament_cache.sql`

Tabulka `tournament_cache` slouží k vyhledávání podle názvu. Naplňuje se periodicky (např. jednou za 2 měsíce) – viz **Hromadný import** níže.

### 2. Hromadný import cache (nárazově)

Turnaje do cache **nenaplňuješ jeden po druhém** – naplníš je najednou z jednoho JSON souboru.

**Krok 1 – Získat data:**  
- **IPIN factsheet (přihlášení):** Otevři factsheet na ipin.itftennis.com, v konzoli spusť `scripts/extract-tournament-browser.js` (nebo `extract-tournament-data.js`) – vyexportuje jeden objekt (název, město, datum, tournamentKey).  
- **Veřejný ITF factsheet (Fáze A, bez přihlášení):** Otevři veřejný factsheet na itftennis.com (např. `/en/tournament/.../j100-...`), v konzoli spusť `scripts/extract-itf-factsheet-browser.js` – vyexportuje plný objekt včetně `entryDeadline`, `withdrawDeadline`, `country`, `venue`, `surface`.  

Objekty z kterékoliv varianty slož do jednoho pole a ulož jako JSON (např. `data/tournament-cache.json`). Můžeš také ručně sestavit JSON podle příkladu níže.

**Krok 2 – Formát JSON:**  
Soubor musí obsahovat **pole objektů**. Každý objekt může být ve formátu z extrakce nebo v „DB“ formátu:

- Z extrakce: `{ "tournamentKey", "tournamentName", "city", "startDate", "category?" }`
- DB formát: `{ "tournament_key", "name", "city", "start_date", "category?" }`

Datum může být `YYYY-MM-DD` nebo `DD.MM.YYYY`. Příklad: `data/tournament-cache.json.example`.

**Krok 3 – Spustit import:**  
V kořeni projektu (s načteným `.env.local` nebo exportovanými proměnnými):

```bash
node scripts/import-tournament-cache.js [cesta/k/souboru.json]
```

Bez argumentu se použije `data/tournament-cache.json`. Potřebné env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (klíč najdeš v Supabase Dashboard → Project Settings → API → service_role).

Skript provede **upsert** podle `tournament_key` – při opakovaném importu se záznamy aktualizují, nevznikají duplicity.

### 3. Automatická aktualizace (3 měsíce dopředu, 1× měsíčně)

Workflow **GitHub Actions** (`.github/workflows/update-tournament-cache.yml`) každý měsíc (1. v měsíci) stáhne turnaje z ITF Juniors na **3 měsíce dopředu** a naimportuje je do `tournament_cache`.

**Nastavení v repozitáři na GitHubu:**

1. **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. Přidej dva secrets:
   - `NEXT_PUBLIC_SUPABASE_URL` – URL projektu (Supabase → Project Settings → API)
   - `SUPABASE_SERVICE_ROLE_KEY` – service_role klíč (Supabase → Project Settings → API, pozor: ne anon key)

Po pushnutí do `main` se workflow zapne. Spuštění: **Actions** → „Update tournament cache (3 months)“ → **Run workflow**. Naplánované spuštění je 1. v měsíci ve 3:00 UTC.

## Použití

### V ParentDashboard

Service je integrován do `ParentDashboard` komponenty. Uživatel má dvě možnosti:

1. **Automatické vyhledávání (cache)**
   - Zadej název turnaje
   - Service vyhledá turnaj v tabulce `tournament_cache` (částečná shoda názvu)
   - U výsledků se zobrazují i pole z factsheetu (deadline přihlášek, draw size), pokud jsou v cache
   - Pokud nalezen, automaticky vytvoří turnaj a přihlášku
   - Pokud nenalezen, zobrazí hlášku s možností ručního zadání

2. **Ruční zadání**
   - Zadej všechny údaje manuálně (název, kategorie, místo, datum)
   - Turnaj se vytvoří bez ITF integrace

### Programatické použití

```typescript
import { registerPlayerForTournament } from '@/lib/tournament-service';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

const result = await registerPlayerForTournament({
  tournamentName: 'Wimbledon Junior',
  playerId: 'player-uuid',
  priority: 1,
  poznamka: 'Poznámka',
  userId: 'user-uuid',
}, supabase);

if (result.success) {
  console.log('Úspěšně přihlášeno:', result.message);
} else {
  console.error('Chyba:', result.message);
}
```

## API Reference

### `registerPlayerForTournament`

Hlavní funkce pro registraci hráče na turnaj.

**Parametry:**
- `tournamentName: string` - Název turnaje k vyhledání
- `playerId: string` - ID hráče
- `priority: number` - Priorita (1-3)
- `poznamka?: string` - Volitelná poznámka
- `userId: string` - ID uživatele (app_user.id)

**Návratová hodnota:**
```typescript
{
  success: boolean;
  tournamentId: string;
  entryId: string;
  message: string;
  tournament?: Tournament;
  error?: string;
}
```

### `searchTournamentByName`

Vyhledá turnaj podle názvu v tabulce `tournament_cache` (částečná shoda, první nalezený).

**Parametry:**
- `supabase: SupabaseClient<Database>` – klient Supabase
- `name: string` – hledaný název turnaje

**Návratová hodnota:** `ITFTournamentSearchResult | null` (název, město, datum, kategorie, tournament_key).

### `findTournamentByKey`

Najde turnaj v databázi podle `tournament_key`.

### `createTournament`

Vytvoří nový turnaj v databázi z ITF dat.

### `createEntry`

Vytvoří přihlášku hráče na turnaj.

## Testování

### Scénáře k otestování:

1. **Turnaj existuje v ITF a v DB**
   - Zadej název existujícího turnaje
   - Očekávaný výsledek: Použije existující turnaj z DB, vytvoří novou přihlášku

2. **Turnaj existuje v ITF, ale ne v DB**
   - Zadej název turnaje, který není v DB
   - Očekávaný výsledek: Vytvoří nový turnaj s `tournament_key`, vytvoří přihlášku

3. **Turnaj neexistuje v ITF**
   - Zadej neexistující název turnaje
   - Očekávaný výsledek: Zobrazí chybu, umožní ruční zadání

4. **Duplicitní tournament_key**
   - Zkus vytvořit turnaj se stejným `tournament_key`
   - Očekávaný výsledek: Použije existující turnaj místo vytvoření duplikátu

5. **Network errors**
   - Simuluj nedostupnost ITF API
   - Očekávaný výsledek: Graceful fallback na ruční zadání

## Budoucí vylepšení

- [ ] Automatizace stahování seznamu turnajů (kalendář IPIN / ITF)
- [ ] Notifikace o změnách v turnajích

## Poznámky

- `tournament_key` je unikátní identifikátor z ITF systému
- Všechny databázové operace respektují RLS policies
- Service je navržen tak, aby fungoval i bez ITF API (fallback na ruční zadání)
- Duplicity jsou eliminovány pomocí UNIQUE constraint na `tournament_key`
