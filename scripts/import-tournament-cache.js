/**
 * Bulk import tournament cache from a JSON file into Supabase tournament_cache table.
 *
 * Usage:
 *   node scripts/import-tournament-cache.js [path/to/file.json]
 *
 * Default file: data/tournament-cache.json
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
  return String(n).replace(/^([JW]\d+\s+[A-Za-z]+)\1/i, '$1').trim();
}

/** Map row from extract or DB format to tournament_cache insert shape */
function toCacheRow(item) {
  const tournament_key = item.tournament_key ?? item.tournamentKey ?? null;
  const name = normalizeTournamentName(item.name ?? item.tournamentName ?? '');
  const city = (item.city || item.country || 'N/A').trim() || 'N/A';
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
    tournament_key_factsheet: item.tournament_key_factsheet ?? item.tournamentKeyFactsheet ?? undefined,
  };

  // Remove undefined so Supabase doesn't send them (avoids overwriting with null)
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

async function main() {
  const filePath = process.argv[2] || path.join(process.cwd(), 'data', 'tournament-cache.json');

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

  // Odstranit duplicity podle tournament_key (poslední výskyt vyhrává)
  const byKey = new Map();
  for (const row of rows) byKey.set(row.tournament_key, row);
  rows = Array.from(byKey.values());

  const supabase = createClient(url, serviceKey);
  const BATCH = 100;
  let ok = 0;
  let err = 0;

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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
