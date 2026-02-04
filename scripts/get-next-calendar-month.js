/**
 * Z JSONu s turnaji (z artifactu/cache) zjistí nejvyšší měsíc (podle startDate/start_date)
 * a vypíše následující měsíc ve formátu YYYY-MM (pro fetch-calendar-itf-juniors.js).
 *
 * Použití:
 *   node scripts/get-next-calendar-month.js [cesta/k/existing.json]
 *
 * Bez argumentu čte data/existing.json. Výstup: jeden řádek YYYY-MM (např. 2026-04).
 * Pokud soubor neexistuje nebo je prázdný, vypíše aktuální měsíc.
 * Formát výstupu pro GITHUB_ENV: NEXT_MONTH=YYYY-MM
 */

const fs = require('fs');
const path = require('path');

function getMonthFromItem(item) {
  const raw = item.start_date ?? item.startDate ?? null;
  if (!raw || typeof raw !== 'string') return null;
  // YYYY-MM-DD nebo YYYY-MM
  const match = raw.trim().match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : null;
}

function main() {
  const filePath = process.argv[2] || path.join(process.cwd(), 'data', 'existing.json');
  let list = [];
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    list = Array.isArray(data) ? data : (data ? [data] : []);
  } catch (_) {
    // soubor neexistuje nebo neplatný JSON → první běh
  }

  let maxMonth = null;
  for (const item of list) {
    const m = getMonthFromItem(item);
    if (m && (!maxMonth || m > maxMonth)) maxMonth = m;
  }

  let nextMonth;
  if (maxMonth) {
    const [y, m] = maxMonth.split('-').map(Number);
    const d = new Date(y, m, 1); // první den dalšího měsíce
    nextMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  } else {
    const d = new Date();
    nextMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  console.log('NEXT_MONTH=' + nextMonth);
}

main();
