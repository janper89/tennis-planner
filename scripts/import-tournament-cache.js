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
 * JSON format: array of objects. Each object can use either:
 *   - Extract format: { tournamentKey, tournamentName, city, startDate, category? }
 *   - DB format:     { tournament_key, name, city, start_date, category? }
 * Dates are normalized to YYYY-MM-DD (startDate can be "DD.MM.YYYY" or "YYYY-MM-DD").
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

console.log('Importuji cache z data/tournament-cache.json...');

const { createClient } = require('@supabase/supabase-js');

/** Normalize date to YYYY-MM-DD */
function normalizeDate(val) {
  if (!val || typeof val !== 'string') return null;
  const s = val.trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD.MM.YYYY or DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? '20' + y : y;
    return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return s;
}

/** Map row from extract or DB format to tournament_cache insert shape */
function toCacheRow(item) {
  const tournament_key = item.tournament_key ?? item.tournamentKey ?? null;
  const name = item.name ?? item.tournamentName ?? '';
  const city = item.city ?? '';
  const startDateRaw = item.start_date ?? item.startDate ?? null;
  const start_date = normalizeDate(startDateRaw) || startDateRaw;
  const category = item.category ?? null;

  if (!tournament_key || !name || !city || !start_date) {
    return null;
  }
  return { tournament_key, name, city, start_date, category };
}

async function main() {
  const filePath = process.argv[2] || path.join(process.cwd(), 'data', 'tournament-cache.json');

  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    console.error('Usage: node scripts/import-tournament-cache.js [path/to/file.json]');
    process.exit(1);
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('Invalid JSON:', e.message);
    process.exit(1);
  }

  const items = Array.isArray(raw) ? raw : [raw];
  const rows = items.map(toCacheRow).filter(Boolean);

  if (rows.length === 0) {
    console.error('No valid rows (need tournament_key, name, city, start_date)');
    process.exit(1);
  }

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
