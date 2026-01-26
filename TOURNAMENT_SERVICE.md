# Tournament Service - Dokumentace

## Přehled

Tournament Service je centralizovaný modul pro automatické vyhledávání turnajů z ITF databáze a registraci hráčů. Service eliminuje duplicity pomocí `tournament_key` a zjednodušuje proces přihlašování.

## Instalace

### 1. Databázová migrace

Spusť SQL migraci v Supabase SQL Editoru:

```sql
-- Soubor: supabase/add_tournament_key.sql
ALTER TABLE tournament 
ADD COLUMN IF NOT EXISTS tournament_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_key ON tournament(tournament_key) 
WHERE tournament_key IS NOT NULL;
```

### 2. Environment Variables (volitelné)

Pro budoucí integraci s ITF API přidej do `.env.local`:

```env
NEXT_PUBLIC_ITF_API_URL=https://api.itf.com
ITF_API_KEY=your-api-key-here
```

## Použití

### V ParentDashboard

Service je integrován do `ParentDashboard` komponenty. Uživatel má dvě možnosti:

1. **Automatické vyhledávání (ITF)**
   - Zadej název turnaje
   - Service vyhledá turnaj v ITF databázi
   - Pokud nalezen, automaticky vytvoří turnaj a přihlášku
   - Pokud nenalezen, zobrazí chybu s možností ručního zadání

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

Vyhledá turnaj podle názvu v ITF databázi.

**Poznámka:** Aktuálně vrací `null` (placeholder). Po implementaci ITF API bude vracet detaily turnaje.

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

- [ ] Implementace skutečného ITF API endpointu
- [ ] Cache pro vyhledané turnaje
- [ ] Batch import turnajů
- [ ] Synchronizace s ITF databází
- [ ] Notifikace o změnách v turnajích

## Poznámky

- `tournament_key` je unikátní identifikátor z ITF systému
- Všechny databázové operace respektují RLS policies
- Service je navržen tak, aby fungoval i bez ITF API (fallback na ruční zadání)
- Duplicity jsou eliminovány pomocí UNIQUE constraint na `tournament_key`
