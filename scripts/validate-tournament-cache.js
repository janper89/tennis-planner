/**
 * Validace turnajové cache před importem.
 *
 * Usage:
 *   node scripts/validate-tournament-cache.js [path/to/cache.json]
 *   node scripts/validate-tournament-cache.js data/tournament-cache.json --fail-on-warn
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const fileArg = args.find((a) => !a.startsWith('--'));
const failOnWarn = args.includes('--fail-on-warn');
const filePath = fileArg || path.join(process.cwd(), 'data', 'tournament-cache.json');

function normalizeName(name) {
  return String(name || '')
    .trim()
    .toUpperCase();
}

function normalizeDate(val) {
  if (!val || typeof val !== 'string') return null;
  const s = val.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const usMatch = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (usMatch) {
    const [, a, b, y] = usMatch;
    const n1 = parseInt(a, 10);
    const n2 = parseInt(b, 10);
    if (n1 >= 1 && n1 <= 12 && n2 >= 1 && n2 <= 31) return `${y}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
    if (n1 > 12) return `${y}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
  }
  const dmyMatch = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
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

function looksLikeDuplicatedName(name) {
  const normalized = normalizeName(name);
  if (!normalized) return false;
  return /^([JW]\d+\s+[A-Z]+).*\1/.test(normalized);
}

function main() {
  if (!fs.existsSync(filePath)) {
    console.error(`Cache file not found: ${filePath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const rows = Array.isArray(raw) ? raw : [raw];
  if (rows.length === 0) {
    console.error('Cache file is empty.');
    process.exit(1);
  }

  const stats = {
    totalRows: rows.length,
    missingKey: 0,
    invalidStartDate: 0,
    cityNA: 0,
    cityWithStatusMarker: 0,
    nullCategory: 0,
    duplicatedNamePattern: 0,
    rowsInNext3Months: 0,
  };

  const today = new Date();
  const today0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const horizon = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 3, today.getUTCDate());
  const STATUS_MARKER_RE = /\(\s*(closed|cancel{1,2}ed)\s*\)/i;

  for (const row of rows) {
    const key = row.tournament_key ?? row.tournamentKey;
    const startDate = row.start_date ?? row.startDate;
    const city = row.city;
    const category = row.category;
    const name = row.name ?? row.tournamentName;

    if (!key) stats.missingKey += 1;
    const normalized = normalizeDate(String(startDate || ''));
    if (!normalized) stats.invalidStartDate += 1;
    if (!city || String(city).trim().toUpperCase() === 'N/A') stats.cityNA += 1;
    if (city && STATUS_MARKER_RE.test(String(city))) stats.cityWithStatusMarker += 1;
    if (!category) stats.nullCategory += 1;
    if (looksLikeDuplicatedName(name)) stats.duplicatedNamePattern += 1;

    if (normalized) {
      const d = new Date(normalized + 'T00:00:00Z').getTime();
      if (d >= today0 && d < horizon) stats.rowsInNext3Months += 1;
    }
  }

  console.log('Tournament cache quality check:', stats);

  const hardErrors = stats.missingKey > 0 || stats.invalidStartDate > 0;
  if (hardErrors) {
    console.error('Validation failed: missing key or invalid date detected.');
    process.exit(1);
  }

  const MIN_ROWS_NEXT_3M = parseInt(process.env.VALIDATE_MIN_ROWS_3M || '40', 10);
  const warnTooFewUpcoming = stats.rowsInNext3Months > 0 && stats.rowsInNext3Months < MIN_ROWS_NEXT_3M;
  if (warnTooFewUpcoming) {
    console.warn(
      `WARN: Suspiciously low tournament count in next 3 months: ${stats.rowsInNext3Months} < ${MIN_ROWS_NEXT_3M} (env VALIDATE_MIN_ROWS_3M). Parser mohl něco přeskočit.`
    );
  }
  if (stats.cityWithStatusMarker > 0) {
    console.warn(
      `WARN: ${stats.cityWithStatusMarker} řádků má "(CLOSED)/(CANCELLED)" ve sloupci city. Parser by měl status čistit.`
    );
  }

  const warnTooManyNA = stats.cityNA / stats.totalRows > 0.5;
  const warnTooManyDupNames = stats.duplicatedNamePattern > 0;
  if (failOnWarn && (warnTooManyNA || warnTooManyDupNames || warnTooFewUpcoming || stats.cityWithStatusMarker > 0)) {
    console.error('Validation failed in strict mode (--fail-on-warn).');
    process.exit(1);
  }
}

main();
