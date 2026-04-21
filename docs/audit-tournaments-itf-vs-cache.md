# Audit ITF vs cache – turnajová data 04/2026 → 05/2026

Dokument vzniká na základě plánu `audit_itf_vs_cache` a porovnává dodané screenshoty ITF kalendáře proti `data/tournament-cache-full.json`. **Audit neaplikuje žádné změny** do overrides ani parseru – v tomto kroku pouze popisuje stav a navrhuje konkrétní opravy.

Stav cache: `data/tournament-cache-full.json` (snapshot k datu auditu).

## 1. Referenční seznam ze screenshotů ITF

Pole: `Tournament name | Country | City (ITF "Town") | Category | In/Out | Surface | Status`.
Týden je uveden jako `start date` ve formátu ITF.

### Týden 27 Apr 2026 (screenshoty 1 + 2)

| Tournament | Country | City | Cat | I/O | Surface | Status |
|---|---|---|---|---|---|---|
| J200 Villach | Austria | Villach | J200 | O | Clay | Active |
| J200 Salsomaggiore | Italy | Salsomaggiore | J200 | O | Clay | Active |
| J200 Sumter | USA | Sumter | J200 | O | Clay | Active |
| J100 San Jose | Costa Rica | San Jose | J100 | O | Hard | Active |
| J100 Quebec City | Canada | Quebec City | J100 | I | Hard | Active |
| J100 Mohammedia | Morocco | Mohammedia | J100 | O | Clay | Active |
| J60 Doha | Qatar | Doha | J60 | O | Hard | **Cancelled** |
| J60 Lyon | France | Lyon | J60 | O | Clay | Active |
| J60 Windhoek | Namibia | Windhoek | J60 | O | Hard | Active |
| J60 Vyshkovo | Ukraine | Vyshkovo | J60 | O | Clay | **Closed** |
| J60 Chengdu | China | Chengdu | J60 | O | Hard | Active |
| J60 Skopje | North Macedonia | Skopje | J60 | O | Clay | Active |
| J60 Lima | Peru | Lima | J60 | O | Clay | Active |
| J60 Istanbul | Turkiye | Istanbul | J60 | O | Hard | Active |
| J30 Kingston | Jamaica | Kingston | J30 | O | Hard | Active |
| J30 Talca | Chile | Talca | J30 | O | Clay | Active |
| J30 Hong Kong | Hong Kong, China | Hong Kong | J30 | O | Hard | Active |
| J30 Andijan | Uzbekistan | Andijan | J30 | O | Hard | Active |
| J30 Mytilene | Greece | Mytilene | J30 | O | Hard | Active |
| J30 Bhubaneswar | India | Bhubaneswar | J30 | O | Hard | Active |
| J30 Telavi | Georgia | Telavi | J30 | O | Clay | Active |
| J30 Kigali | Rwanda | Kigali | J30 | O | Hard | Active |

### Týden 28 Apr 2026 (screenshot 2 + 3)

| Tournament | Country | City | Cat | I/O | Surface | Status |
|---|---|---|---|---|---|---|
| J300 Plovdiv | Bulgaria | Plovdiv | J300 | O | Clay | Active |
| J100 Monastir | Tunisia | Monastir | J100 | O | Hard | Active |
| J60 Cairo | Egypt | Cairo | J60 | O | Clay | Active |
| J30 Vierumaki | Finland | Vierumaki | J30 | O | Hard | Active |
| J30 Melbourne | Australia | Melbourne | J30 | O | Clay | Active |
| J30 Girona | Spain | Girona | J30 | O | Clay | Active |
| J30 Lautoka | Fiji | Lautoka | J30 | O | Hard | Active |
| J30 Bucharest | Romania | Bucharest | J30 | O | Clay | Active |
| J30 Pereira | Colombia | Mosquera | J30 | O | Clay | Active |

### Týden 04 May 2026 (screenshot 3 + 4)

| Tournament | Country | City | Cat | I/O | Surface | Status |
|---|---|---|---|---|---|---|
| J500 Offenbach | Germany | Offenbach | J500 | O | Clay | Active |
| J200 College Grove | USA | Nashville | J200 | O | Clay | Active |
| J100 Rabat | Morocco | Rabat | J100 | O | Clay | Active |
| J100 Lima | Peru | Lima | J100 | O | Clay | Active |
| J100 Ile des Soeurs | Canada | Ile des Soeurs | J100 | I | Hard | Active |
| J60 Doha | Qatar | Doha | J60 | O | Hard | **Cancelled** |
| J60 Telavi | Georgia | Telavi | J60 | O | Clay | Active |
| J60 Vyshkovo | Ukraine | Vyshkovo | J60 | O | Clay | **Closed** |
| J60 Chengdu | China | Chengdu | J60 | O | Hard | Active |
| J60 Filippiada | Greece | Filippiada | J60 | O | Hard | Active |
| J60 Managua | Nicaragua | Managua | J60 | O | Hard | Active |
| J30 Skopje | North Macedonia | Skopje | J30 | O | Clay | Active |
| J30 Lucknow | India | Lucknow | J30 | O | Hard | Active |
| J30 Abidjan | Côte d'Ivoire | Abidjan | J30 | O | Hard | Active |
| J30 Christiansted | US Virgin Islands | Christiansted | J30 | O | Hard | Active |
| J30 Fergana | Uzbekistan | Samarkand | J30 | O | Clay | Active |
| J30 Santiago | Chile | Santiago | J30 | O | Clay | Active |

## 2. Porovnání reference ↔ cache

Srovnáváno proti `data/tournament-cache-full.json` podle kombinace `category + country + startDate (týden)`.

### 2a. Matched (sedí všechna důležitá pole)

Týden **27 Apr 2026**: J200 Villach, J200 Salsomaggiore, J200 Sumter, J100 San Jose, J100 Quebec City, J100 Mohammedia, J60 Lyon, J60 Windhoek, J60 Chengdu, J60 Skopje, J60 Lima, J60 Istanbul, J30 Kingston, J30 Hong Kong, J30 Mytilene, J30 Bhubaneswar, J30 Telavi, J30 Kigali.

Týden **28 Apr 2026**: J300 Plovdiv, J100 Monastir, J60 Cairo, J30 Vierumaki, J30 Melbourne, J30 Girona, J30 Lautoka, J30 Bucharest.

Týden **04 May 2026**: J500 Offenbach, J100 Rabat, J100 Lima, J100 Ile des Soeurs, J60 Telavi, J60 Filippiada, J60 Managua, J30 Skopje, J30 Lucknow, J30 Abidjan, J30 Christiansted.

### 2b. Mismatched (sedí jen část polí)

| # | Tournament (ITF) | Cache klíč | Typ problému | ITF | Cache |
|---|---|---|---|---|---|
| M1 | J200 College Grove (04 May) | `J-J200-USA-2026-003` | wrong city | Nashville | College Grove |
| M2 | J60 Vyshkovo (27 Apr) | viz cache 27 Apr | status v názvu | `J60 Vyshkovo` + příznak CLOSED | `J60 Vyshkovo (CLOSED)` v `tournamentName` i `city` |
| M3 | J60 Vyshkovo (04 May) | viz cache 04 May – **CHYBÍ** | missing v tomto týdnu | Closed, ale v kalendáři 04 May | Není v cache pro 04 May |
| M4 | J60 Doha (27 Apr, 04 May) | cache 27 Apr `J60 Doha` | status není uložen | Cancelled | Bez indikace statusu |
| M5 | J30 Pereira (28 Apr) | `J-J30-COL-2026-00x` | wrong city + možný duplikát | city = Mosquera | cache má `J30 Pereira` s city `Pereira` **i** `J30 Mosquera` s city `Mosquera` (dva záznamy) |
| M6 | J60 Dakahlia (27 Apr) | cache 27 Apr | turnaj ve screenshotech není | – | Cache má `J60 Dakahlia` – mimo scope auditu, nelze potvrdit |

Poznámky k M2/M4: status `Cancelled`/`Closed` parser aktuálně drží v `tournamentName` (jen u Vyshkova), v ostatních případech status chybí úplně. To je systémový nedostatek – řešit strukturálním polem `status` při dalším kole (není součástí rychlého override).

### 2c. Missing (v cache úplně chybí)

| # | Tournament | Country | Start | City | Surface |
|---|---|---|---|---|---|
| X1 | J30 Talca | Chile | 27 Apr 2026 | Talca | Clay - O |
| X2 | J30 Andijan | Uzbekistan | 27 Apr 2026 | Andijan | Hard - O |
| X3 | J30 Santiago | Chile | 04 May 2026 | Santiago | Clay - O |
| X4 | J30 Fergana (= J30 Samarkand) | Uzbekistan | 04 May 2026 | Samarkand | Clay - O |
| X5 | J60 Vyshkovo (CLOSED) | Ukraine | 04 May 2026 | Vyshkovo | Clay - O |
| X6 | J60 Doha (CANCELLED) | Qatar | 04 May 2026 | Doha | Hard - O |
| X7 | J30 Hradec Kralove *(mimo tyto screenshoty, známý případ)* | Czech Republic | 25 May 2026 | Hradec Kralove | Clay - O |

Vysvětlivky:
- **X1–X4** – kalendář ITF je uvádí, v `tournament-cache-full.json` pro daný týden chybí i odpovídající `factSheetUrl`. Pravděpodobně je parser `fetch-calendar-itf-juniors.js` buď odfiltruje (např. podle země/regionu), nebo je vynechá kvůli paginaci/scrollu.
- **X4** – ITF v názvu uvádí "J30 FERGANA" ale ve sloupci *Town* má Samarkand. V takových případech používáme *název = podle ITF*, *město = podle Town*. **Před aplikací override ověřit přímo na `itftennis.com` factsheetu**, aby nebyl název přehozený.
- **X5/X6** – stejná událost jako 27 Apr, ale ve druhém týdnu. Může jít o ITF zobrazení vícetýdenní položky; override potřeba pouze pokud vyhledávání ve frontendu tato data filtruje podle týdne a není schopno zobrazit zrušený turnaj.

## 3. Návrh patch overrides (bez aplikace)

Formát dle existujícího `data/tournament-cache-overrides.json`. Návrh se dělí na **P0 – aplikovat** a **P1 – verify-before-apply**.

> Klíče `MANUAL-*` držíme jako novou konvenci (viz existující záznamy Loughborough, Istanbul). Pro reálné ITF klíče (college-grove, mosquera) ponecháme původní `tournament_key` z factsheetu a modifikujeme konkrétní pole.

### P0 – jednoznačné opravy

```jsonc
// M1: J200 College Grove → město Nashville
{
  "tournament_key": "J-J200-USA-2026-003",
  "name": "J200 College Grove",
  "city": "Nashville",
  "venue": "College Grove",
  "start_date": "2026-05-04",
  "category": "J200",
  "country": "USA",
  "tournament_key_factsheet": "J-J200-USA-2026-003"
}

// M2: J60 Vyshkovo (27 Apr) – vyčistit status z city
{
  "tournament_key": "J-J60-UKR-2026-001",
  "name": "J60 Vyshkovo",
  "city": "Vyshkovo",
  "start_date": "2026-04-27",
  "category": "J60",
  "country": "UKR",
  "status": "closed",
  "tournament_key_factsheet": "J-J60-UKR-2026-001"
}

// M5: J30 Pereira – cílová verze (skutečné město = Mosquera)
{
  "tournament_key": "J-J30-COL-2026-00X", // doplnit podle factsheetu
  "name": "J30 Pereira",
  "city": "Mosquera",
  "venue": "Pereira / Mosquera",
  "start_date": "2026-04-28",
  "category": "J30",
  "country": "COL",
  "tournament_key_factsheet": "J-J30-COL-2026-00X"
}
```

### P0 – chybějící turnaje (doplnit jako MANUAL-*)

```jsonc
// X1
{
  "tournament_key": "MANUAL-J30-TALCA-CHI-2026-04-27",
  "name": "J30 Talca",
  "city": "Talca",
  "start_date": "2026-04-27",
  "category": "J30",
  "country": "CHI",
  "venue": "Talca",
  "tournament_key_factsheet": "MANUAL-J30-TALCA-CHI-2026-04-27"
}

// X2
{
  "tournament_key": "MANUAL-J30-ANDIJAN-UZB-2026-04-27",
  "name": "J30 Andijan",
  "city": "Andijan",
  "start_date": "2026-04-27",
  "category": "J30",
  "country": "UZB",
  "venue": "Andijan",
  "tournament_key_factsheet": "MANUAL-J30-ANDIJAN-UZB-2026-04-27"
}

// X3
{
  "tournament_key": "MANUAL-J30-SANTIAGO-CHI-2026-05-04",
  "name": "J30 Santiago",
  "city": "Santiago",
  "start_date": "2026-05-04",
  "category": "J30",
  "country": "CHI",
  "venue": "Santiago",
  "tournament_key_factsheet": "MANUAL-J30-SANTIAGO-CHI-2026-05-04"
}

// X7 – už dříve identifikováno
{
  "tournament_key": "MANUAL-J30-HRADEC-KRALOVE-CZE-2026-05-25",
  "name": "J30 Hradec Kralove",
  "city": "Hradec Kralove",
  "start_date": "2026-05-25",
  "category": "J30",
  "country": "CZE",
  "venue": "Hradec Kralove",
  "tournament_key_factsheet": "MANUAL-J30-HRADEC-KRALOVE-CZE-2026-05-25"
}
```

### P1 – verify before apply (nutné ověřit ITF factsheet ručně)

```jsonc
// X4 – Fergana vs. Samarkand; ověřit skutečný název a hosting city
{
  "tournament_key": "MANUAL-J30-FERGANA-UZB-2026-05-04",
  "name": "J30 Fergana",            // pokud factsheet potvrdí, že název nese "Fergana"
  "city": "Samarkand",              // city dle ITF Town
  "venue": "Samarkand",
  "start_date": "2026-05-04",
  "category": "J30",
  "country": "UZB",
  "tournament_key_factsheet": "MANUAL-J30-FERGANA-UZB-2026-05-04"
}

// X5 – J60 Vyshkovo 04 May (druhý týden, status Closed)
{
  "tournament_key": "MANUAL-J60-VYSHKOVO-UKR-2026-05-04",
  "name": "J60 Vyshkovo",
  "city": "Vyshkovo",
  "start_date": "2026-05-04",
  "category": "J60",
  "country": "UKR",
  "status": "closed",
  "tournament_key_factsheet": "MANUAL-J60-VYSHKOVO-UKR-2026-05-04"
}

// X6 – J60 Doha 04 May (Cancelled)
{
  "tournament_key": "MANUAL-J60-DOHA-QAT-2026-05-04",
  "name": "J60 Doha",
  "city": "Doha",
  "start_date": "2026-05-04",
  "category": "J60",
  "country": "QAT",
  "status": "cancelled",
  "tournament_key_factsheet": "MANUAL-J60-DOHA-QAT-2026-05-04"
}
```

> Pozn.: aktuální `data/tournament-cache-overrides.json` nemá sloupec `status`. Pokud se rozhodneme status držet přes override, je potřeba buď (a) přidat pole do importu, nebo (b) držet status v názvu (`J60 Doha (CANCELLED)`), jak už parser dělá u Vyshkova. Rozhodnout před aplikací.

## 4. Ověření po aplikaci override (post-fix validation)

Cíl: detekovat, že override se projevil a zároveň nevznikly duplikace nebo nekonzistence.

### 4a. Automatické kontroly

1. `node scripts/validate-tournament-cache.js data/tournament-cache-full.json`
   - očekávání: `missingKey = 0`, `invalidStartDate = 0`, `duplicatedNamePattern = 0`.
2. `node scripts/validate-tournament-cache.js data/tournament-cache-full.json --fail-on-warn`
   - očekávání: selže pouze pokud `cityNA / total > 50 %` nebo pokud přibudou duplicitní vzory – oboje musí zůstat stejné nebo lepší než pre-fix.
3. Diff pre-fix vs. post-fix: uložit `quality summary (ready to import)` z `import-tournament-cache.js` před a po, porovnat počty per `category`.

### 4b. Ruční kontrola v datech

Očekávané výsledky po aplikaci P0:

- V `data/tournament-cache-overrides.json` přibude 7 záznamů (M1, M2, M5 + X1, X2, X3, X7).
- V importované tabulce `tournament_cache` musí být:
  - `J-J200-USA-2026-003.city = Nashville`.
  - `J-J60-UKR-2026-001` bez podřetězce `CLOSED` v poli `city`.
  - Pro Manual klíče existuje právě **jeden** řádek (žádné duplicity s automatickými klíči).

Dotazy (Supabase) pro ověření:

```sql
-- 1) Nashville místo College Grove
select tournament_key, name, city, start_date
from tournament_cache
where tournament_key = 'J-J200-USA-2026-003';

-- 2) Chybějící turnaje doplněny
select tournament_key, name, city, start_date
from tournament_cache
where tournament_key in (
  'MANUAL-J30-TALCA-CHI-2026-04-27',
  'MANUAL-J30-ANDIJAN-UZB-2026-04-27',
  'MANUAL-J30-SANTIAGO-CHI-2026-05-04',
  'MANUAL-J30-HRADEC-KRALOVE-CZE-2026-05-25'
);

-- 3) Nejsou duplicity přes (name, city, start_date)
select name, city, start_date, count(*)
from tournament_cache
group by name, city, start_date
having count(*) > 1;
```

### 4c. UI/flow smoke test

- V `ParentDashboard` → `TournamentNameInput` napsat:
  - "Talca" → musí vrátit 1 návrh, kategorie J30, 27. 4. 2026.
  - "Nashville" **i** "College Grove" → oba dotazy musí vrátit totéž `J200 College Grove (Nashville)`.
  - "Hradec" → vrátí `J30 Hradec Kralove` s datem 25. 5. 2026.

### 4d. Regression guard

- Po úspěšném importu uložit aktuální quality report (stat dump) jako baseline pro příští měsíční běh.
- Pokud další spuštění `validate-tournament-cache.js` vrátí **více** `duplicatedNamePattern` nebo `cityNA` než tato baseline, spustit audit proti aktuálnímu ITF kalendáři.

## 5. Doporučené pořadí kroků

1. **Ověřit** P1 případy (X4, X5, X6) přímo na itftennis.com (factsheet page) – stačí otevřít URL a zkopírovat `Event name`, `Town`, `Start date`, `Category`, `Surface`.
2. Zapsat P0 + potvrzené P1 overrides do `data/tournament-cache-overrides.json`.
3. Spustit `node scripts/import-tournament-cache.js data/tournament-cache-full.json` (overrides se aplikují přes upsert na stejný `tournament_key`).
4. Provést SQL kontroly z bodu 4b a UI smoke test z bodu 4c.
5. Teprve potom spustit `./scripts/refresh-tournaments.sh` v produkčním režimu pro další cyklus.

---

*Audit report připravil agent na základě dodaných ITF screenshotů a snapshotu `data/tournament-cache-full.json` k datu 21. 4. 2026. Override JSON v této fázi není aplikován – jde o návrh ke schválení.*
