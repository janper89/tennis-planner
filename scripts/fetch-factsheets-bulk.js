/**
 * Automatické stažení plných factsheetů pro turnaje z kalendáře.
 *
 * Postup:
 * 1. Nejdřív spusť kalendář (vygeneruje data/tournament-cache.json včetně factSheetUrl):
 *    node scripts/fetch-calendar-itf-juniors.js 2026-02
 * 2. Pak spusť tento skript:
 *    node scripts/fetch-factsheets-bulk.js [cesta/k/tournament-cache.json]
 *
 * Skript pro každý záznam s factSheetUrl otevře stránku v Puppeteeru, spustí extrakci
 * (stejnou logiku jako extract-itf-factsheet-browser.js) a výsledky sloučí do jednoho JSON.
 * Výstup: data/tournament-cache-full.json (nebo --import rovnou import do Supabase).
 *
 * Volby:
 *   --import    po stažení spustit import do Supabase (import-tournament-cache.js)
 *   --limit=N   zpracovat max N turnajů (pro test)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const envPath = path.resolve(__dirname, '..', '.env.local');
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
} catch (_) {}

const args = process.argv.slice(2);
const doImport = args.includes('--import');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const fileArg = args.filter((a) => !a.startsWith('--'))[0];
const inputPath = fileArg || path.join(process.cwd(), 'data', 'tournament-cache.json');
const outputPath = path.join(process.cwd(), 'data', 'tournament-cache-full.json');

// Načíst extrakční kód z browser skriptu (řádky 15–215 + return out; })();)
const extractScriptPath = path.join(__dirname, 'extract-itf-factsheet-browser.js');
let extractCode = fs.readFileSync(extractScriptPath, 'utf8');
const startMark = '(function ()';
const endMark = '  const jsonOutput = JSON.stringify';
const startIdx = extractCode.indexOf(startMark);
const endIdx = extractCode.indexOf(endMark);
if (startIdx === -1 || endIdx === -1) {
  console.error('Nelze vyříznout extrakční logiku z extract-itf-factsheet-browser.js');
  process.exit(1);
}
extractCode = extractCode.slice(startIdx, endIdx).trim() + '\n  return out;\n})();';

async function main() {
  if (!fs.existsSync(inputPath)) {
    console.error('Soubor nenalezen:', inputPath);
    console.error('Nejdřív spusť: node scripts/fetch-calendar-itf-juniors.js 2026-02');
    process.exit(1);
  }

  let list;
  try {
    list = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  } catch (e) {
    console.error('Neplatný JSON:', e.message);
    process.exit(1);
  }

  const items = Array.isArray(list) ? list : [list];
  const withUrl = items.filter((i) => {
    if (!i.factSheetUrl || (!i.factSheetUrl.includes('/tournament/') && !i.factSheetUrl.includes('factsheet'))) return false;
    const name = (i.tournamentName || i.name || '').toLowerCase();
    const url = i.factSheetUrl.toLowerCase();
    if (name.includes('wheelchair') || url.includes('wheelchair')) return false;
    if (name.includes('junior finals') || name.includes('world tennis tour junior finals')) return false;
    if (url.includes('junior-finals') || url.includes('jm-chn')) return false;
    return true;
  });
  const toFetch = limit ? withUrl.slice(0, limit) : withUrl;

  if (toFetch.length === 0) {
    console.log('Žádné záznamy s factSheetUrl. Spusť nejdřív kalendář (fetch-calendar-itf-juniors.js).');
    process.exit(0);
  }

  console.log('Načítám', toFetch.length, 'factsheetů (Puppeteer)...');

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    console.error('Puppeteer není nainstalovaný: npm install puppeteer --save-dev');
    process.exit(1);
  }

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Map URL -> factsheet data (pro sloučení s kalendářem)
  const factsheetByUrl = new Map();
  for (let i = 0; i < toFetch.length; i++) {
    const item = toFetch[i];
    const url = item.factSheetUrl;
    process.stdout.write(`  [${i + 1}/${toFetch.length}] ${item.tournamentName || item.tournamentKey} ... `);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await new Promise((r) => setTimeout(r, 3000));
      const data = await page.evaluate((code) => eval(code), extractCode);
      if (data && (data.tournamentKey || data.tournamentName)) {
        factsheetByUrl.set(url, data);
        console.log('OK');
      } else {
        console.log('prázdný výstup');
      }
    } catch (e) {
      console.log('chyba:', e.message);
    }
  }

  await browser.close();

  // Sloučit: všechny položky z kalendáře, factsheet data přepíše kde je k dispozici
  const merged = items.map((cal) => {
    const url = cal.factSheetUrl;
    const sheet = url ? factsheetByUrl.get(url) : null;
    if (!sheet) return cal;
    const out = { ...cal };
    for (const [k, v] of Object.entries(sheet)) {
      if (v != null && v !== '') out[k] = v;
    }
    return out;
  });

  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2), 'utf8');
  console.log('Uloženo', merged.length, 'turnajů do', outputPath, '(kalendář + factsheet merge)');

  if (doImport && merged.length > 0) {
    console.log('Spouštím import do Supabase...');
    try {
      execSync(`node "${path.join(__dirname, 'import-tournament-cache.js')}" "${outputPath}"`, {
        stdio: 'inherit',
        cwd: path.resolve(__dirname, '..'),
      });
    } catch (e) {
      console.error('Import selhal (zkontroluj .env.local a SUPABASE_SERVICE_ROLE_KEY)');
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
