/**
 * Post-import sanity check.
 *
 * Porovná počet řádků v JSON zdroji (data/tournament-cache-full.json) s počtem
 * řádků v tabulce tournament_cache ve stejném okně. Dále zkontroluje, že
 * v city není CLOSED/CANCELLED marker a že v příštích 3 měsících je
 * dostatek turnajů.
 *
 * Exit code 0 = OK, 2 = warning (něco podezřelého), 1 = hard error.
 *
 * Usage:
 *   node scripts/post-import-sanity.js [windowMonths]
 */

const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
try {
  require('dotenv').config({ path: envPath });
} catch (_) {
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
  console.error('Post-import sanity: Missing Supabase credentials, přeskakuji.');
  process.exit(0);
}

const windowMonthsArg = process.argv[2];
const windowMonths = windowMonthsArg ? parseInt(windowMonthsArg, 10) : parseInt(process.env.CACHE_WINDOW_MONTHS_SEARCH || '18', 10);

const fullPath = path.join(process.cwd(), 'data', 'tournament-cache-full.json');
const fallbackPath = path.join(process.cwd(), 'data', 'tournament-cache.json');
const sourcePath = fs.existsSync(fullPath) ? fullPath : fallbackPath;

(async () => {
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(url, serviceKey);

  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + windowMonths, start.getUTCDate()));
  const fromISO = start.toISOString().slice(0, 10);
  const toISO = end.toISOString().slice(0, 10);

  function normalizeDate(val) {
    if (!val || typeof val !== 'string') return null;
    const s = val.trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const months = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
    const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*,?\s+(\d{4})$/);
    if (m) {
      const mon = months[m[2].toLowerCase().slice(0,3)];
      if (mon) return `${m[3]}-${String(mon).padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    }
    const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
    if (dmy) {
      const year = dmy[3].length === 2 ? '20' + dmy[3] : dmy[3];
      return `${year}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
    }
    return null;
  }

  const sourceRaw = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const sourceRows = (Array.isArray(sourceRaw) ? sourceRaw : [sourceRaw]).filter((r) => {
    const raw = r.start_date || r.startDate;
    const iso = normalizeDate(String(raw || ''));
    if (!iso) return false;
    return iso >= fromISO && iso < toISO;
  });

  const { data: dbRows, error } = await sb
    .from('tournament_cache')
    .select('tournament_key,name,city,start_date,category')
    .gte('start_date', fromISO)
    .lt('start_date', toISO);
  if (error) {
    console.error('Post-import sanity: SELECT error:', error.message);
    process.exit(1);
  }

  const sourceKeys = new Set(sourceRows.map((r) => String(r.tournament_key || r.tournamentKey || '').toUpperCase()));
  const dbKeys = new Set(dbRows.map((r) => String(r.tournament_key || '').toUpperCase()));

  const sourceCount = sourceKeys.size;
  const dbCount = dbKeys.size;
  const diffRatio = sourceCount === 0 ? 0 : Math.abs(dbCount - sourceCount) / sourceCount;

  const STATUS_MARKER_RE = /\(\s*(closed|cancel{1,2}ed)\s*\)/i;
  const dbWithStatusInCity = dbRows.filter((r) => STATUS_MARKER_RE.test(String(r.city || ''))).length;

  const today0 = start.getTime();
  const horizon = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, start.getUTCDate());
  const dbInNext3M = dbRows.filter((r) => {
    const d = new Date(r.start_date + 'T00:00:00Z').getTime();
    return d >= today0 && d < horizon;
  }).length;

  const MIN_ROWS_3M = parseInt(process.env.VALIDATE_MIN_ROWS_3M || '40', 10);

  console.log('Post-import sanity:');
  console.log('  Window:', fromISO, '..', toISO);
  console.log('  Source JSON:', sourceCount, 'řádků');
  console.log('  DB           :', dbCount, 'řádků');
  console.log('  Rozdíl        :', dbCount - sourceCount, `(${(diffRatio * 100).toFixed(1)} %)`);
  console.log('  DB v příštích 3 měsících:', dbInNext3M, '(min ' + MIN_ROWS_3M + ')');
  console.log('  DB city obsahuje (CLOSED/CANCELLED):', dbWithStatusInCity);

  let warn = false;
  if (diffRatio > 0.05 && Math.abs(dbCount - sourceCount) > 10) {
    console.warn(`  WARN: Odchylka DB vs JSON > 5 % (|${dbCount}-${sourceCount}| / ${sourceCount}).`);
    warn = true;
  }
  if (dbInNext3M < MIN_ROWS_3M) {
    console.warn(`  WARN: DB má málo turnajů v příštích 3 měsících (${dbInNext3M} < ${MIN_ROWS_3M}).`);
    warn = true;
  }
  if (dbWithStatusInCity > 0) {
    console.warn(`  WARN: ${dbWithStatusInCity} záznamů má (CLOSED)/(CANCELLED) v poli city. Parser nebo sanitizer selhal.`);
    warn = true;
  }

  if (warn) {
    process.exit(2);
  }
  console.log('  OK.');
  process.exit(0);
})().catch((e) => {
  console.error('Post-import sanity: neočekávaná chyba:', e.message);
  process.exit(1);
});
