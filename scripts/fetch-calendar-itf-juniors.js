/**
 * Stáhne seznam turnajů z veřejného kalendáře ITF Juniors (jednou za období).
 * Výstup: JSON ve formátu pro import do tournament_cache (data/tournament-cache.json).
 *
 * Použití:
 *   node scripts/fetch-calendar-itf-juniors.js [YYYY-MM]
 *
 * Bez argumentu: aktuální měsíc. Příklad: 2026-02
 *
 * Vyžaduje: npm install (puppeteer je v devDependencies)
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.itftennis.com/en/tournament-calendar/world-tennis-tour-juniors-calendar/';
const DEFAULT_START = new Date().toISOString().slice(0, 7); // YYYY-MM

async function main() {
  const startParam = process.argv[2] || DEFAULT_START;
  const url = `${BASE_URL}?categories=All&startdate=${startParam}`;

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    console.error('Nainstaluj Puppeteer: npm install puppeteer --save-dev');
    process.exit(1);
  }

  console.log('Načítám kalendář:', url);
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  const launchOptions = {
    headless: true,
    ...(isCI && {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    }),
    ...(process.env.PUPPETEER_EXECUTABLE_PATH && {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    }),
  };
  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // SPA: počkat na vykreslení obsahu (tabulka, odkazy na turnaje)
  await new Promise((r) => setTimeout(r, 6000));
  try {
    await page.waitForSelector('table, [class*="tournament"], a[href*="tournament"], a[href*="factsheet"]', { timeout: 15000 });
  } catch (_) {}

  const tournaments = await page.evaluate((startMonth) => {
    const out = [];
    const slug = (s) => (s || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

    // Odkaz může obsahovat tournamentId (IPIN factsheet)
    function getTournamentIdFromLink(a) {
      if (!a || !a.href) return null;
      try {
        const u = new URL(a.href);
        const id = u.searchParams.get('tournamentId') || u.searchParams.get('tournamentid');
        if (id) return id;
        const pathMatch = (u.pathname || '').match(/tournament[s]?[\/\-]([a-f0-9\-]{36})/i);
        if (pathMatch) return pathMatch[1];
      } catch (_) {}
      return null;
    }

    // Hledání řádků s turnaji: tabulka nebo kontejnery s daty
    const tables = document.querySelectorAll('table');
    for (const table of tables) {
      const rows = table.querySelectorAll('tbody tr, tr');
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 2) continue;

        const links = row.querySelectorAll('a[href*="tournament"], a[href*="factsheet"]');
        let name = '';
        let tournamentId = null;
        let factSheetUrl = null;
        for (const a of links) {
          const text = (a.textContent || '').trim();
          if (text.length > 2 && text.length < 200) {
            name = text;
            tournamentId = getTournamentIdFromLink(a);
            if (a.href && a.href.includes('itftennis') && (a.href.includes('/tournament/') || a.href.includes('factsheet'))) factSheetUrl = a.href;
            break;
          }
        }
        if (!name) {
          const firstCell = (cells[0] && cells[0].textContent || '').trim();
          if (firstCell.length > 2) name = firstCell;
        }

        let dateStr = '';
        const dateCandidates = [];
        let city = '';
        let category = '';
        const cellTexts = Array.from(cells).map((c) => (c.textContent || '').trim());
        for (let i = 0; i < cellTexts.length; i++) {
          const t = cellTexts[i];
          if (/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/.test(t)) {
            dateCandidates.push(t);
          }
          if (/^[A-Za-z\s\-]+$/.test(t) && t.length > 1 && t.length < 80 && !t.match(/^(J\d+|Category|Date|City|Nation)$/i)) {
            if (!city && i > 0) city = t;
          }
          if (/^J\d+$/i.test(t)) category = t;
        }
        // Použij poslední datum v řádku (skutečné datum turnaje), ne první (často společné „týden 2.1.“)
        if (dateCandidates.length > 0) {
          dateStr = dateCandidates[dateCandidates.length - 1];
        }
        if (!dateStr) {
          const dateCell = row.querySelector('td[class*="date"], [data-date]');
          if (dateCell) dateStr = (dateCell.textContent || '').trim();
        }
        if (!city) city = 'N/A';

        if (!name) continue;
        const nameLower = name.toLowerCase();
        if (nameLower.includes('wheelchair')) continue;
        if (nameLower.includes('junior finals') || nameLower.includes('world tennis tour junior finals')) continue;
        if (factSheetUrl && factSheetUrl.toLowerCase().includes('wheelchair')) continue;

        // Normalizace data na YYYY-MM-DD
        let startDate = dateStr;
        const dMatch = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
        if (dMatch) {
          const [, d, m, y] = dMatch;
          const year = y.length === 2 ? '20' + y : y;
          startDate = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        } else {
          const ymdMatch = dateStr.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
          if (ymdMatch) startDate = `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) continue;
        const tournamentKey = tournamentId || `itf-juniors-${slug(name)}-${startDate}`;
        out.push({
          tournamentKey,
          tournamentName: name,
          city,
          startDate,
          category: category || null,
          factSheetUrl: factSheetUrl || null,
        });
      }
    }

    // Fallback: hledat kartičky / bloky turnajů (SPA)
    if (out.length === 0) {
      const blocks = document.querySelectorAll('[class*="tournament"], [class*="event"], [data-tournament]');
      for (const el of blocks) {
        const nameEl = el.querySelector('a, [class*="name"], [class*="title"]');
        const name = (nameEl && nameEl.textContent || '').trim() || (el.textContent || '').trim().split('\n')[0];
        if (!name || name.length < 3) continue;
        const nameLower = name.toLowerCase();
        if (nameLower.includes('wheelchair')) continue;
        if (nameLower.includes('junior finals') || nameLower.includes('world tennis tour junior finals')) continue;
        const link = el.querySelector('a[href*="tournament"], a[href*="factsheet"]');
        const tournamentId = link ? getTournamentIdFromLink(link) : null;
        const factSheetUrl = (link && link.href && link.href.includes('itftennis') && (link.href.includes('/tournament/') || link.href.includes('factsheet'))) ? link.href : null;
        if (factSheetUrl && factSheetUrl.toLowerCase().includes('wheelchair')) continue;
        const text = el.innerText || '';
        const allDates = text.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/g);
        const dateStr = allDates && allDates.length ? allDates[allDates.length - 1] : '';
        let startDate = dateStr;
        const dMatch = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
        if (dMatch) {
          const [, d, m, y] = dMatch;
          startDate = `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        } else {
          const ymd = dateStr.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
          if (ymd) startDate = `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
        }
        const cityMatch = text.match(/(?:City|Town|Venue)[:\s]*([A-Za-z\s,]+)/i);
        const city = (cityMatch && cityMatch[1] && cityMatch[1].trim()) || 'N/A';
        const catMatch = text.match(/\b(J\d+)\b/i);
        const category = (catMatch && catMatch[1]) || null;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) continue;
        const tournamentKey = tournamentId || `itf-juniors-${slug(name)}-${startDate}`;
        out.push({ tournamentKey, tournamentName: name, city, startDate, category, factSheetUrl });
      }
    }

    // Fallback: jen odkazy na turnaje (název z textu, datum z kontextu nebo první den měsíce)
    if (out.length === 0) {
      const monthFallback = (startMonth || '').match(/^(\d{4})-(\d{2})$/);
      const defaultDate = monthFallback ? `${monthFallback[1]}-${monthFallback[2]}-01` : null;
      const links = document.querySelectorAll('a[href*="tournament"], a[href*="factsheet"]');
      const seen = new Set();
      for (const a of links) {
        const name = (a.textContent || '').trim();
        if (!name || name.length < 3 || name.length > 150) continue;
        const nameLower = name.toLowerCase();
        if (nameLower.includes('wheelchair')) continue;
        if (nameLower.includes('junior finals') || nameLower.includes('world tennis tour junior finals')) continue;
        const tournamentId = getTournamentIdFromLink(a);
        const key = tournamentId || slug(name);
        if (seen.has(key)) continue;
        seen.add(key);
        let row = a.closest('tr') || a.closest('[class*="row"]') || a.closest('li') || a.parentElement;
        let dateStr = '';
        let city = 'N/A';
        if (row) {
          const rowText = row.innerText || '';
          const allDm = rowText.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/g);
          if (allDm && allDm.length) dateStr = allDm[allDm.length - 1];
          const cm = rowText.match(/(?:City|Town|Venue|Location)[:\s]*([A-Za-z\s,\-]+?)(?:\n|$|J\d|Category)/i);
          if (cm) city = cm[1].trim();
        }
        let startDate = defaultDate;
        if (dateStr) {
          const dMatch = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
          if (dMatch) {
            const [, d, m, y] = dMatch;
            startDate = `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          } else {
            const ymd = dateStr.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
            if (ymd) startDate = `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
          }
        }
        if (!startDate) continue;
        const category = (row && (row.innerText || '').match(/\b(J\d+)\b/i)) ? row.innerText.match(/\b(J\d+)\b/i)[1] : null;
        const factSheetUrl = (a.href && a.href.includes('itftennis') && (a.href.includes('/tournament/') || a.href.includes('factsheet'))) ? a.href : null;
        if (factSheetUrl && (factSheetUrl.toLowerCase().includes('wheelchair') || factSheetUrl.toLowerCase().includes('junior-finals') || factSheetUrl.toLowerCase().includes('jm-chn'))) continue;
        out.push({
          tournamentKey: tournamentId || `itf-juniors-${key}-${startDate}`,
          tournamentName: name,
          city,
          startDate,
          category,
          factSheetUrl,
        });
      }
    }

    return out;
  }, startParam);

  // Deduplikace podle tournamentKey
  const byKey = new Map();
  for (const t of tournaments) {
    if (t.tournamentName && t.startDate) byKey.set(t.tournamentKey, t);
  }
  const list = Array.from(byKey.values());

  if (list.length === 0) {
    const debugPath = path.join(process.cwd(), 'data', 'calendar-debug.html');
    try {
      const html = await page.evaluate(() => document.documentElement.outerHTML);
      fs.mkdirSync(path.dirname(debugPath), { recursive: true });
      fs.writeFileSync(debugPath, html, 'utf8');
      console.warn('Žádné turnaje nebyly rozpoznány. Pro kontrolu struktury stránky byl uložen soubor:', debugPath);
    } catch (e) {
      console.warn('Žádné turnaje nebyly rozpoznány. Stránka mohla změnit strukturu – uprav selektory ve skriptu.');
    }
    await browser.close();
    process.exit(1);
  }

  await browser.close();

  const outPath = path.join(process.cwd(), 'data', 'tournament-cache.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(list, null, 2), 'utf8');
  console.log('OK: uloženo', list.length, 'turnajů do', outPath);
  console.log('Import do DB: node scripts/import-tournament-cache.js');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
