/**
 * Bulk import tournament cache from a JSON file into Supabase tournament_cache table.
 *
 * Usage:
 *   node scripts/import-tournament-cache.js [path/to/file.json]
 *   node scripts/import-tournament-cache.js [path/to/file.json] --from-today --window-months=18 --replace-all
 *
 * Default file: data/tournament-cache.json
 *
 * Flags:
 *   --from-today       keep only rows with start_date >= today
 *   --window-months=N  keep only rows in [today, today+N months), default CACHE_WINDOW_MONTHS_SEARCH or 18
 *   --replace-all      delete existing tournament_cache rows before upsert
 *
 * Env (in .env.local or shell):
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * JSON format: array of objects, or single object. Each object can use:
 *   - Factsheet format (extract-itf-factsheet-browser.js): tournamentKey, tournamentName,
 *     city, country, startDate, endDate, surface, drawSize, entryDeadline, withdrawalDeadline,
 *     mainDrawSignIn, qualifyingSignIn, firstDayQualifying, firstDayMainDraw,
 *     tournamentDirectorName, tournamentDirectorEmail, officialBall, venue, venueAddress,
 *     venueTelephone, tournamentKeyFactsheet, ...
 *   - Simple format: { tournamentKey, tournamentName, city, startDate, category? }
 *   - DB format:     { tournament_key, name, city, start_date, category? }
 * Dates are normalized to YYYY-MM-DD where applicable.
 */

const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);

const replaceAll = args.includes('--replace-all');
const fromToday = args.includes('--from-today');
const windowMonthsArg = args.find((a) => a.startsWith('--window-months='));
const windowMonths = windowMonthsArg ? parseInt(windowMonthsArg.split('=')[1], 10) : null;
const fileArg = args.find((a) => !a.startsWith('--'));
const overridesPath = path.join(process.cwd(), 'data', 'tournament-cache-overrides.json');

// Načtení .env.local z kořene projektu (cesta vůči umístění skriptu)
const envPath = path.resolve(__dirname, '..', '.env.local');
try {
  require('dotenv').config({ path: envPath });
} catch (_) {
  // Ruční načtení, pokud dotenv není k dispozici (např. špatné cwd)
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split(/\r?\n/).forEach((line) => {
        const t = line.trim();
        if (t && !t.startsWith('#') && t.includes('=')) {
          const i = t.indexOf('=');
          process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
        }
      });
    }
  } catch (__) {}
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const defaultSearchWindowMonths = parseInt(process.env.CACHE_WINDOW_MONTHS_SEARCH || '18', 10);

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (use .env.local or export)');
  console.error('Hledaný soubor:', envPath);
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');

/** Normalize date to YYYY-MM-DD (supports DD.MM.YYYY, MM/DD/YYYY, YYYY-MM-DD) */
function normalizeDate(val) {
  if (!val || typeof val !== 'string') return null;
  const s = val.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // US format M/D/YYYY (e.g. 2/15/2026 or 2/15/2026 12:00:00 AM)
  const usMatch = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (usMatch) {
    const [, a, b, y] = usMatch;
    const year = y.length === 2 ? '20' + y : y;
    const n1 = parseInt(a, 10);
    const n2 = parseInt(b, 10);
    if (n1 >= 1 && n1 <= 12 && n2 >= 1 && n2 <= 31) {
      return year + '-' + a.padStart(2, '0') + '-' + b.padStart(2, '0');
    }
    if (n1 > 12) return year + '-' + b.padStart(2, '0') + '-' + a.padStart(2, '0');
  }
  // DD.MM.YYYY or DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? '20' + y : y;
    return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // "11 Feb, 2026" or "09 February 2026" (abbreviated or full month name)
  const months = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december';
  const textMatch = s.match(new RegExp('(\\d{1,2})\\s+(' + months + ')[a-z]*,?\\s+(\\d{4})', 'i'));
  if (textMatch) {
    const [, day, monthName, year] = textMatch;
    const mon = monthName.toLowerCase().slice(0, 3);
    const monthNum = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }[mon];
    if (monthNum) return `${year}-${String(monthNum).padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

function normalizeTournamentName(n) {
  if (!n || typeof n !== 'string') return n || '';
  const trimmed = String(n).trim();
  const noDupPrefix = trimmed.replace(/^([JW]\d+\s+[A-Za-z]+)\1/i, '$1');
  const doubled = noDupPrefix.match(/^(.{4,80}?)\1(\s|$)/i);
  if (doubled) {
    return `${doubled[1]}${noDupPrefix.slice(doubled[0].length - 1)}`.trim();
  }
  return noDupPrefix;
}

function titleCaseWords(text) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function inferCityFromTournamentName(name) {
  const normalized = normalizeTournamentName(name || '');
  const m = normalized.match(/^[JW]\d+\s+(.+?)(?:\s+\([A-Z]{3}\))?$/i);
  if (!m) return null;
  const raw = (m[1] || '').trim();
  if (!raw || raw.length > 80) return null;
  return titleCaseWords(raw);
}

function inferCityFromFactsheetUrl(factSheetUrl) {
  if (!factSheetUrl || typeof factSheetUrl !== 'string') return null;
  try {
    const u = new URL(factSheetUrl);
    const parts = (u.pathname || '').split('/').filter(Boolean);
    const tIdx = parts.findIndex((p) => p === 'tournament');
    if (tIdx < 0 || !parts[tIdx + 1]) return null;
    const cityLike = parts[tIdx + 1]
      .replace(/^j\d+-/i, '')
      .split('-')
      .filter(Boolean)
      .slice(0, 3)
      .join(' ');
    if (!cityLike) return null;
    return titleCaseWords(cityLike);
  } catch (_) {
    return null;
  }
}

function parseCanonicalTournamentKeyFromFactsheetUrl(factSheetUrl) {
  if (!factSheetUrl || typeof factSheetUrl !== 'string') return null;
  const m = factSheetUrl.match(/\/(j-[a-z0-9-]+-\d{4}-\d{3})\/?$/i);
  if (!m) return null;
  return m[1].toUpperCase();
}

function hasFactsheetFields(row) {
  if (!row || typeof row !== 'object') return false;
  return !!(
    row.entry_deadline ||
    row.withdrawal_deadline ||
    row.tournament_director_name ||
    row.official_ball ||
    row.draw_size
  );
}

function normalizeForGroup(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isoWeekKey(dateIso) {
  if (!dateIso || typeof dateIso !== 'string') return 'unknown-week';
  const d = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return 'unknown-week';
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function qualityScore(row) {
  let score = 0;
  if (!row) return score;
  if (hasFactsheetFields(row)) score += 100;
  if (row.tournament_key_factsheet) score += 30;
  if (row.tournament_key && /^J-[A-Z0-9-]+$/.test(row.tournament_key)) score += 15;
  if (row.country) score += 3;
  if (row.venue) score += 3;
  if (row.end_date) score += 2;
  return score;
}

function preferBetterRow(a, b) {
  const qa = qualityScore(a);
  const qb = qualityScore(b);
  if (qa !== qb) return qa > qb ? a : b;
  const da = (a.start_date || '').localeCompare(b.start_date || '');
  if (da !== 0) return da <= 0 ? a : b;
  return String(a.tournament_key || '') <= String(b.tournament_key || '') ? a : b;
}

/** Map row from extract or DB format to tournament_cache insert shape */
function toCacheRow(item) {
  const canonicalKeyFromUrl = parseCanonicalTournamentKeyFromFactsheetUrl(
    item.factSheetUrl ?? item.fact_sheet_url ?? item.factsheet_url
  );
  const sourceKey = item.tournament_key ?? item.tournamentKey ?? null;
  const sourceFactsheetUrl = item.factSheetUrl ?? item.fact_sheet_url ?? item.factsheet_url;
  const tournament_key =
    canonicalKeyFromUrl ||
    (typeof sourceKey === 'string' ? sourceKey.toUpperCase() : sourceKey);
  const name = normalizeTournamentName(item.name ?? item.tournamentName ?? '');
  const rawCity = (item.city || '').trim();
  const inferredFromUrl = inferCityFromFactsheetUrl(sourceFactsheetUrl);
  const inferredCity =
    rawCity && rawCity.toLowerCase() !== 'n/a'
      ? rawCity
      : inferCityFromTournamentName(name) || inferredFromUrl;
  // Defenzivní sanitizer: i kdyby parser selhal a nechal "(Closed)" v city,
  // toto ji ustraní. Konzistentní s filtrem UI varianty C.
  const cityRaw = (inferredCity || item.country || 'N/A').trim() || 'N/A';
  const city = cityRaw.replace(/\s*\(\s*(closed|cancel{1,2}ed)\s*\)\s*/gi, '').trim() || 'N/A';
  const startDateRaw = item.start_date ?? item.startDate ?? null;
  const start_date = normalizeDate(startDateRaw) || startDateRaw;
  const category = item.category ?? null;

  if (!tournament_key || !name || !start_date) {
    return null;
  }

  const row = {
    tournament_key,
    name,
    city,
    start_date,
    category: category || undefined,
    country: item.country || undefined,
    venue: item.venue || undefined,
    venue_address: item.venue_address ?? item.venueAddress ?? undefined,
    venue_telephone: item.venue_telephone ?? item.venueTelephone ?? undefined,
    end_date: normalizeDate(item.end_date ?? item.endDate) || undefined,
    surface: item.surface || undefined,
    draw_size: item.draw_size ?? item.drawSize ?? undefined,
    singles_main_draw_format: item.singles_main_draw_format ?? item.singlesMainDrawFormat ?? undefined,
    entry_deadline: item.entry_deadline ?? item.entryDeadline ?? undefined,
    withdrawal_deadline: item.withdrawal_deadline ?? item.withdrawalDeadline ?? undefined,
    main_draw_sign_in: item.main_draw_sign_in ?? item.mainDrawSignIn ?? undefined,
    qualifying_sign_in: item.qualifying_sign_in ?? item.qualifyingSignIn ?? undefined,
    first_day_qualifying: item.first_day_qualifying ?? item.firstDayQualifying ?? undefined,
    first_day_main_draw: item.first_day_main_draw ?? item.firstDayMainDraw ?? undefined,
    tournament_director_name: item.tournament_director_name ?? item.tournamentDirectorName ?? undefined,
    tournament_director_email: item.tournament_director_email ?? item.tournamentDirectorEmail ?? undefined,
    official_ball: item.official_ball ?? item.officialBall ?? undefined,
    tournament_key_factsheet:
      item.tournament_key_factsheet ??
      item.tournamentKeyFactsheet ??
      canonicalKeyFromUrl ??
      undefined,
  };

  // Remove undefined so Supabase doesn't send them (avoids overwriting with null)
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

function dedupeRowsByGroup(rows) {
  const byGroup = new Map();
  for (const row of rows) {
    const groupKey = [
      normalizeForGroup(row.name),
      normalizeForGroup(row.city),
      normalizeForGroup(row.category || ''),
      isoWeekKey(row.start_date),
    ].join('|');
    const existing = byGroup.get(groupKey);
    if (!existing) {
      byGroup.set(groupKey, row);
      continue;
    }
    byGroup.set(groupKey, preferBetterRow(existing, row));
  }
  return Array.from(byGroup.values());
}

function buildQualitySummary(rows) {
  const isNA = (value) => !value || String(value).trim().toUpperCase() === 'N/A';
  const duplicatedNamePattern = rows.filter((r) => {
    const name = String(r.name || '').toUpperCase();
    return /^([JW]\d+\s+[A-Z]+).*\1/.test(name);
  }).length;

  return {
    totalRows: rows.length,
    cityNA: rows.filter((r) => isNA(r.city)).length,
    nullCategory: rows.filter((r) => !r.category).length,
    duplicatedNamePattern,
    invalidStartDate: rows.filter((r) => !/^\d{4}-\d{2}-\d{2}$/.test(String(r.start_date || ''))).length,
  };
}

async function main() {
  const filePath = fileArg || path.join(process.cwd(), 'data', 'tournament-cache.json');

  console.log('Importuji z:', filePath);

  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    console.error('Usage: node scripts/import-tournament-cache.js [path/to/file.json]');
    process.exit(1);
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let raw;
  try {
    raw = JSON.parse(content);
  } catch (e) {
    // Soubor může být výstup z konzole (.log) – hledáme JSON objekt (ideálně factsheet s "tournamentKey")
    let start = -1;
    let openCh = '{';
    const tournamentKeyStart = content.indexOf('"tournamentKey"');
    if (tournamentKeyStart >= 0) {
      const braceBefore = content.lastIndexOf('{', tournamentKeyStart);
      if (braceBefore >= 0) start = braceBefore;
    }
    if (start < 0) {
      start = content.indexOf('[');
      if (start >= 0) openCh = '[';
      else start = content.indexOf('{');
    }
    if (start >= 0) {
      const closeCh = openCh === '[' ? ']' : '}';
      let depth = 0;
      let end = -1;
      for (let i = start; i < content.length; i++) {
        if (content[i] === openCh) depth++;
        else if (content[i] === closeCh) {
          depth--;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
      }
      if (end > start) {
        try {
          raw = JSON.parse(content.slice(start, end));
        } catch (e2) {
          console.error('Invalid JSON (and no JSON object/array found in file):', e.message);
          process.exit(1);
        }
      } else {
        console.error('Invalid JSON:', e.message);
        process.exit(1);
      }
    } else {
      console.error('Invalid JSON:', e.message);
      process.exit(1);
    }
  }

  const items = Array.isArray(raw) ? raw : [raw];
  let rows = items.map(toCacheRow).filter(Boolean);

  if (rows.length === 0) {
    console.error('No valid rows. Každý objekt musí mít: tournament_key (nebo tournamentKey), name (nebo tournamentName), city, start_date (nebo startDate).');
    process.exit(1);
  }

  console.log('Quality summary (raw input):', buildQualitySummary(rows));

  // Odstranit duplicity podle tournament_key (poslední výskyt vyhrává)
  const byKey = new Map();
  for (const row of rows) byKey.set(row.tournament_key, row);
  rows = Array.from(byKey.values());

  // Deduplikace podle normalizovaného klíče name+city+category+week
  // Preferujeme kvalitnější (factsheet) záznam.
  rows = dedupeRowsByGroup(rows);

  // Volitelné ruční overrides (pro případy, kdy ITF feed vrací neúplná data)
  if (fs.existsSync(overridesPath)) {
    try {
      const rawOverrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
      const overrideItems = Array.isArray(rawOverrides) ? rawOverrides : [rawOverrides];
      const overrideRows = overrideItems.map(toCacheRow).filter(Boolean);
      for (const row of overrideRows) byKey.set(row.tournament_key, row);
      rows = Array.from(byKey.values());
      console.log(`Načteno overrides: ${overrideRows.length} z ${overridesPath}`);
    } catch (e) {
      console.error(`Nepodařilo se načíst overrides (${overridesPath}):`, e.message);
      process.exit(1);
    }
  }

  // Volitelný filtr: jen okno od dneška (+ N měsíců)
  let cleanupWindow = null;
  if (fromToday || (windowMonths != null && Number.isFinite(windowMonths) && windowMonths > 0)) {
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const monthsAhead =
      windowMonths != null && Number.isFinite(windowMonths) && windowMonths > 0
        ? windowMonths
        : defaultSearchWindowMonths;
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + monthsAhead, start.getUTCDate()));

    const inRange = (s) => {
      if (!s || typeof s !== 'string') return false;
      const d = new Date(s + 'T00:00:00Z');
      if (Number.isNaN(d.getTime())) return false;
      return d >= start && d < end;
    };

    const before = rows.length;
    rows = rows.filter((r) => inRange(r.start_date));
    console.log(
      `Filtrované okno: ${start.toISOString().slice(0, 10)} .. ${end.toISOString().slice(0, 10)} (bez konce), ${before} -> ${rows.length} řádků`
    );

    cleanupWindow = {
      fromISO: start.toISOString().slice(0, 10),
      toISO: end.toISOString().slice(0, 10),
    };
  }

  if (rows.length === 0) {
    console.error('Po aplikaci filtrů nezbyly žádné řádky k importu.');
    process.exit(1);
  }

  console.log('Quality summary (ready to import):', buildQualitySummary(rows));

  const supabase = createClient(url, serviceKey);
  const BATCH = 100;
  let ok = 0;
  let err = 0;

  if (replaceAll) {
    console.log('Mažu existující data v tournament_cache (--replace-all)...');
    const { error: deleteError } = await supabase
      .from('tournament_cache')
      .delete()
      .not('tournament_key', 'is', null);
    if (deleteError) {
      console.error('Delete error:', deleteError.message);
      process.exit(1);
    }
  }

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('tournament_cache').upsert(batch, {
      onConflict: 'tournament_key',
    });

    if (error) {
      console.error('Batch error:', error.message);
      err += batch.length;
    } else {
      ok += batch.length;
    }
  }

  console.log('Import done:', ok, 'upserted', err ? `, ${err} failed` : '');

  // Window-diff cleanup: pokud běžíme v okně, smaž v DB vše, co do okna spadá,
  // ale není ani v source JSONu, ani v overrides. Spouští se jen když není
  // --replace-all (ten by už smazal všechno jinde) a když nedošlo k zásadnímu
  // selhání upsertu (jinak bychom mohli smazat data, která se nestihla nahradit).
  const noCleanup = args.includes('--no-cleanup');
  if (!replaceAll && !noCleanup && cleanupWindow && err === 0) {
    try {
      const { data: dbRows, error: selErr } = await supabase
        .from('tournament_cache')
        .select('tournament_key,start_date')
        .gte('start_date', cleanupWindow.fromISO)
        .lt('start_date', cleanupWindow.toISO);
      if (selErr) {
        console.warn('Window-diff cleanup: SELECT selhal, přeskakuji:', selErr.message);
      } else {
        const validKeys = new Set(rows.map((r) => r.tournament_key));
        const orphanKeys = (dbRows || [])
          .map((r) => r.tournament_key)
          .filter((k) => k && !validKeys.has(k));
        if (orphanKeys.length === 0) {
          console.log('Window-diff cleanup: žádné orphan klíče v okně.');
        } else {
          console.log(`Window-diff cleanup: mažu ${orphanKeys.length} orphan klíčů v okně ${cleanupWindow.fromISO}..${cleanupWindow.toISO}`);
          // Smazat po dávkách kvůli limitu IN ().
          const DEL_BATCH = 200;
          let deleted = 0;
          for (let i = 0; i < orphanKeys.length; i += DEL_BATCH) {
            const chunk = orphanKeys.slice(i, i + DEL_BATCH);
            const { error: delErr } = await supabase
              .from('tournament_cache')
              .delete()
              .in('tournament_key', chunk);
            if (delErr) {
              console.error('Window-diff cleanup: DELETE dávka selhala:', delErr.message);
              break;
            }
            deleted += chunk.length;
          }
          console.log(`Window-diff cleanup: smazáno ${deleted} záznamů.`);
        }
      }
    } catch (e) {
      console.warn('Window-diff cleanup: neočekávaná chyba, přeskakuji:', e.message);
    }
  } else if (!replaceAll && noCleanup) {
    console.log('Window-diff cleanup: vypnuto přes --no-cleanup.');
  } else if (!replaceAll && !cleanupWindow) {
    console.log('Window-diff cleanup: přeskočeno (bez okna, spusť s --from-today nebo --window-months).');
  } else if (err > 0) {
    console.warn('Window-diff cleanup: přeskočeno kvůli chybám v upsertu.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
