/**
 * Stahne seznam turnaju z verejneho kalendare ITF Juniors pres JSON API.
 * Vystup: JSON ve formatu pro import do tournament_cache (data/tournament-cache.json).
 *
 * Pouziti:
 *   node scripts/fetch-calendar-itf-juniors.js [YYYY-MM]
 *   node scripts/fetch-calendar-itf-juniors.js [YYYY-MM] --months=18
 *
 * Bez argumentu: aktualni mesic + CACHE_WINDOW_MONTHS_SEARCH (default 18 mesicu) dopredu.
 * S --months=N: stahne N mesicu od zadaneho (nebo aktualniho) mesice.
 * Priklad: 2026-02 --months=18 -> unor 2026 az cervenec 2027.
 *
 * Vyuziva Puppeteer pro ziskani Imperva/Incapsula cookies, data bere pres ITF JSON API.
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.itftennis.com/en/tournament-calendar/world-tennis-tour-juniors-calendar/';
const API_URL = 'https://www.itftennis.com/tennis/api/TournamentApi/GetCalendar';
const ITF_ORIGIN = 'https://www.itftennis.com';
const DEFAULT_START = new Date().toISOString().slice(0, 7); // YYYY-MM
const TAKE = 100;
const MAX_JSON_RETRIES = 2;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Vrati pole YYYY-MM pro N mesicu od startMonth */
function getMonthsToFetch(startMonth, count) {
  const [y, m] = startMonth.split('-').map(Number);
  const out = [];
  for (let i = 0; i < count; i++) {
    const month = m + i;
    const year = y + Math.floor((month - 1) / 12);
    const monthNorm = ((month - 1) % 12) + 1;
    out.push(`${year}-${String(monthNorm).padStart(2, '0')}`);
  }
  return out;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const monthsArg = args.find((a) => a.startsWith('--months='));
  const defaultMonths = parseInt(process.env.CACHE_WINDOW_MONTHS_SEARCH || '18', 10);
  const months = monthsArg ? parseInt(monthsArg.split('=')[1], 10) : defaultMonths;
  const startArg = args.find((a) => !a.startsWith('--') && /^\d{4}-\d{2}$/.test(a));
  const startMonth = startArg || DEFAULT_START;
  return { startMonth, months };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelayMs() {
  return Math.floor(Math.random() * 1000) + 500;
}

function getMonthRange(month) {
  const match = String(month || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error(`Neplatny mesic: ${month}`);

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) throw new Error(`Neplatny mesic: ${month}`);

  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const monthPadded = String(monthNumber).padStart(2, '0');
  return {
    dateFrom: `${year}-${monthPadded}-01`,
    dateTo: `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`,
  };
}

function buildCalendarApiUrl({ dateFrom, dateTo, skip, take }) {
  const url = new URL(API_URL);
  url.searchParams.set('circuitCode', 'JT');
  url.searchParams.set('searchString', '');
  url.searchParams.set('skip', String(skip));
  url.searchParams.set('take', String(take));
  url.searchParams.set('nationCodes', '');
  url.searchParams.set('zoneCodes', '');
  url.searchParams.set('dateFrom', dateFrom);
  url.searchParams.set('dateTo', dateTo);
  url.searchParams.set('indoorOutdoor', '');
  url.searchParams.set('categories', '');
  url.searchParams.set('isOrderAscending', 'true');
  url.searchParams.set('orderField', 'startDate');
  url.searchParams.set('surfaceCodes', '');
  url.searchParams.set('singlesDrawFormat', '');
  return url.toString();
}

function formatCookies(cookies) {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

async function createCookieSession(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);

  const session = {
    page,
    userAgent: USER_AGENT,
    cookieHeader: '',
    async refreshCookies() {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(6000);
      const cookies = await page.cookies(ITF_ORIGIN, BASE_URL);
      this.cookieHeader = formatCookies(cookies);
      if (!this.cookieHeader) {
        throw new Error('Nepodarilo se ziskat ITF cookies z Puppeteer session.');
      }
      return this.cookieHeader;
    },
  };

  await session.refreshCookies();
  return session;
}

function parseCalendarResponse({ contentType, body }) {
  let parsed = null;
  let parseError = null;

  if (contentType.includes('application/json') && !body.trimStart().startsWith('<')) {
    try {
      parsed = JSON.parse(body);
    } catch (e) {
      parseError = e;
    }
  }

  const isJson =
    contentType.includes('application/json') &&
    !body.trimStart().startsWith('<') &&
    parsed &&
    Array.isArray(parsed.items) &&
    typeof parsed.totalItems === 'number';

  return { isJson, parsed, parseError };
}

async function requestCalendarPage(session, month, params, attempt = 0) {
  const url = buildCalendarApiUrl(params);
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: BASE_URL,
      'User-Agent': session.userAgent,
      Cookie: session.cookieHeader,
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();
  const { isJson, parsed, parseError } = parseCalendarResponse({ contentType, body });

  if (isJson) return parsed;

  if (attempt < MAX_JSON_RETRIES) {
    console.warn(
      `ITF API nevratilo JSON pro ${month} (skip=${params.skip}, pokus ${attempt + 1}/${MAX_JSON_RETRIES + 1}), obnovuji cookies...`
    );
    await session.refreshCookies();
    return requestCalendarPage(session, month, params, attempt + 1);
  }

  const snippet = body.trim().slice(0, 160).replace(/\s+/g, ' ');
  const reason = parseError ? ` JSON parse error: ${parseError.message}.` : '';
  throw new Error(
    `fetchMonth ${month}: ITF API nevratilo validni JSON po retry (status=${response.status}, content-type=${contentType}, skip=${params.skip}).${reason} Body: ${snippet}`
  );
}

function shouldSkipTournament(tournament) {
  const name = String(tournament.tournamentName || '').toLowerCase();
  const url = String(tournament.factSheetUrl || '').toLowerCase();
  if (name.includes('wheelchair') || url.includes('wheelchair')) return true;
  if (name.includes('junior finals') || name.includes('world tennis tour junior finals')) return true;
  if (url.includes('junior-finals')) return true;
  return false;
}

function mapApiItemToTournament(item) {
  const startDate = typeof item.startDate === 'string' ? item.startDate.slice(0, 10) : null;
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
  if (!item.tournamentKey || typeof item.tournamentKey !== 'string') return null;
  if (!item.tournamentName || typeof item.tournamentName !== 'string') return null;

  let factSheetUrl = null;
  if (typeof item.tournamentLink === 'string' && item.tournamentLink.trim()) {
    factSheetUrl = new URL(item.tournamentLink, ITF_ORIGIN).toString();
  }

  const endDate = typeof item.endDate === 'string' ? item.endDate.slice(0, 10) : null;

  return {
    tournamentKey: item.tournamentKey.toUpperCase(),
    tournamentName: item.tournamentName,
    city: item.location || item.venue || 'N/A',
    country: item.hostNation || null,
    startDate,
    endDate: endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : null,
    category: item.category || null,
    surface: item.surfaceDesc || null,
    factSheetUrl,
  };
}

function assertMonthlySanity(month, tournaments, totalItems) {
  if (tournaments.length === 0) throw new Error(`fetchMonth ${month}: 0 items`);
  if (tournaments.length < 10) throw new Error(`fetchMonth ${month}: only ${tournaments.length} items (< 10)`);
  if (tournaments.length < totalItems) {
    throw new Error(`fetchMonth ${month}: pagination incomplete - got ${tournaments.length}, expected ${totalItems}`);
  }
}

async function fetchMonth(session, month) {
  const { dateFrom, dateTo } = getMonthRange(month);
  const allItems = [];
  let totalItems = null;

  for (let skip = 0; totalItems === null || skip < totalItems; skip += TAKE) {
    const data = await requestCalendarPage(session, month, { dateFrom, dateTo, skip, take: TAKE });
    totalItems = data.totalItems;
    allItems.push(...data.items);

    if (skip + TAKE < totalItems) {
      await sleep(randomDelayMs());
    }
  }

  const tournaments = allItems
    .map(mapApiItemToTournament)
    .filter(Boolean)
    .filter((tournament) => !shouldSkipTournament(tournament));

  assertMonthlySanity(month, tournaments, totalItems);
  return tournaments;
}

async function main() {
  const { startMonth, months } = parseArgs();
  const monthsToFetch = getMonthsToFetch(startMonth, months);

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    console.error('Nainstaluj Puppeteer: npm install puppeteer --save-dev');
    process.exit(1);
  }

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
  try {
    const session = await createCookieSession(browser);
    const byKey = new Map();

    for (let i = 0; i < monthsToFetch.length; i++) {
      const m = monthsToFetch[i];
      console.log(`Nacitam kalendar [${i + 1}/${monthsToFetch.length}]: ${m}`);
      const tournaments = await fetchMonth(session, m);
      for (const t of tournaments) {
        if (t.tournamentName && t.startDate) byKey.set(t.tournamentKey, t);
      }
      if (i + 1 < monthsToFetch.length) {
        await sleep(randomDelayMs());
      }
    }

    const list = Array.from(byKey.values());
    if (list.length === 0) {
      throw new Error('Zadne turnaje nebyly stazeny. Zkontroluj ITF API odpoved.');
    }

    const outPath = path.join(process.cwd(), 'data', 'tournament-cache.json');
    const tmpPath = path.join(process.cwd(), 'data', 'tournament-cache.tmp.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(tmpPath, JSON.stringify(list, null, 2), 'utf8');
    fs.renameSync(tmpPath, outPath);
    console.log('OK: ulozeno', list.length, 'turnaju do', outPath, `(${monthsToFetch.join(', ')})`);
    console.log('Import do DB: node scripts/import-tournament-cache.js');
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
