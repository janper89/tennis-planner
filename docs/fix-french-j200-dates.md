# Oprava dat začátků turnajů J200 Cap d'Ail a J200 Istres

## Zpětná vazba

Rodiče hlásí špatná data začátků u francouzských turnajů v přihlašovací aplikaci:

| Turnaj            | Správný začátek | V aplikaci (chyba) |
|-------------------|-----------------|---------------------|
| J200 Cap d'Ail    | **30. 3.**      | 1. 4.               |
| J200 Istres       | **6. 4.**       | 1. 4.               |

U obou v aplikaci vychází **1. 4.**, což je chybné.

---

## Kde aplikace bere datum začátku

1. **Zobrazení** – datum začátku turnaje se bere z tabulky **`tournament`**, sloupec **`datum`** (např. `ParentDashboard`, `CoachDashboard`, výběr turnaje).
2. **Při přidání turnaje** – trenér/manager vybere turnaj z vyhledávání; vyhledávání čte z **`tournament_cache`** (`start_date`). Při vytvoření záznamu se do `tournament.datum` uloží právě toto `startDate` z vybraného výsledku.
3. **Aktualizace z cache** – služba sice umí „doplňovat“ chybějící údaje z cache do existujícího turnaje (`buildTournamentEnrichmentUpdate`), ale **datum se přepisuje jen tehdy, když je `existing.datum` prázdné**. Pokud už turnaj má (byť špatné) datum, z cache se nepřepíše.

---

## Pravděpodobná příčina

- Oba turnaje mají v aplikaci **1. 4.** (2026-04-01) – první den v dubnu.
- V **`data/tournament-cache-full.json`** jsou data **správně**:
  - J200 Cap d'Ail: `"startDate": "30 Mar, 2026"` → 30. 3. 2026
  - J200 Istres: `"startDate": "06 Apr, 2026"` → 6. 4. 2026
- Skript `scripts/import-tournament-cache.js` umí formát „30 Mar, 2026“ / „06 Apr, 2026“ správně převést na `YYYY-MM-DD` (funkce `normalizeDate`).

**Nejpravděpodobnější scénář:**

- Záznamy v tabulce **`tournament`** vznikly v době, kdy:
  - buď v cache ještě byla špatná/neúplná data (např. z kalendáře ITF, kde se u některých položek použije výchozí první den měsíce – duben → 2026-04-01),  
  - nebo šlo o jiný zdroj s chybným datem.
- V `tournament` tedy zůstalo **`datum = 2026-04-01`** u obou.
- Protože logika obohacování **nepřepisuje již vyplněné `datum`**, ani po pozdějším správném importu cache se tyto záznamy neopravily.

Chyba tedy není v zobrazování ani v aktuálním importu cache, ale v **už uložených datech v tabulce `tournament`** a v tom, že se při obohacování z cache existující datum neaktualizuje.

---

## Plán opravy

### Krok 1: Opravit data v databázi (doporučené)

Spustit v Supabase SQL Editoru jednorázovou opravu podle `tournament_key`:

- **J-J200-FRA-2026-001** (J200 Cap d'Ail) → `datum = 2026-03-30`
- **J-J200-FRA-2026-002** (J200 Istres) → `datum = 2026-04-06`

Trigger `tournament_deadlines_trigger` po změně `datum` přepočte `entry_deadline` a `withdraw_deadline`.

Připravený skript: **`supabase/fix_french_j200_dates.sql`**.

### Krok 2 (volitelně): Ověřit cache

Pokud chcete mít jistotu, že i **`tournament_cache`** má u těchto turnajů správné `start_date`:

- Spustit import z aktuálního `data/tournament-cache-full.json` (např. `node scripts/import-tournament-cache.js data/tournament-cache-full.json`),  
- nebo v DB ověřit:  
  `SELECT tournament_key, name, start_date FROM tournament_cache WHERE tournament_key IN ('J-J200-FRA-2026-001','J-J200-FRA-2026-002');`  
  Mělo by být: Cap d'Ail 2026-03-30, Istres 2026-04-06.

### Krok 3: Ověření v aplikaci

Po spuštění SQL a obnovení stránky by rodiče/trenéři měli u obou turnajů vidět:

- J200 Cap d'Ail – začátek **30. 3. 2026**
- J200 Istres – začátek **6. 4. 2026**

---

## Do budoucna (volitelné vylepšení)

- **Obohacování z cache** – zvážit, zda při „doplňování“ záznamu z cache (např. při vyhledání podle klíče) aktualizovat i `datum`, pokud se v cache liší (např. pouze u záznamů s kanonickým ITF klíčem). Nyní se datum nepřepisuje, pokud už je vyplněné.
- **Zdroj dat** – preferovat pro vytváření turnajů data z factsheetu/cache s explicitním datem („30 Mar, 2026“) před kalendářem, kde může být jen měsíc a default 1. den.

---

## Souhrn

- **Problém:** V aplikaci se u J200 Cap d'Ail a J200 Istres zobrazuje začátek 1. 4. místo 30. 3. resp. 6. 4.
- **Příčina:** V tabulce `tournament` je u obou uloženo chybné `datum` (2026-04-01); obohacování z cache existující datum nepřepisuje.
- **Oprava:** Jednorázový SQL update `tournament.datum` podle `tournament_key` (skript v `supabase/fix_french_j200_dates.sql`), případně ověřit/importovat cache a zkontrolovat zobrazení v aplikaci.
