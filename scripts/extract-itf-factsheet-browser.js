/**
 * Fáze A – extrakce všech údajů z veřejného ITF factsheetu
 *
 * INSTRUCTIONS:
 * 1. Otevři veřejný factsheet na https://www.itftennis.com/en/tournament/...
 *    (bez přihlášení, např. .../j100-bloemfontein/rsa/2026/j-j100-rsa-2026-001/)
 * 2. Otevři konzoli prohlížeče (F12 nebo Cmd+Option+I)
 * 3. Zkopíruj a vlož celý tento skript
 * 4. Stiskni Enter
 * 5. JSON se zobrazí a zkopíruje do schránky; lze i stáhnout soubor
 *
 * Vyhledává pouze v <main>, takže se neberou data z formuláře Sign Up.
 */

(function () {
  'use strict';

  const main = document.querySelector('main');
  const root = main || document.body;

  const data = {
    tournamentKey: null,
    tournamentName: null,
    city: null,
    country: null,
    venue: null,
    venueAddress: null,
    venueTelephone: null,
    startDate: null,
    endDate: null,
    surface: null,
    category: null,
    // Tournament Information (plná sekce)
    drawSize: null,
    singlesMainDrawFormat: null,
    entryDeadline: null,
    withdrawalDeadline: null,
    mainDrawSignIn: null,
    qualifyingSignIn: null,
    firstDayQualifying: null,
    firstDayMainDraw: null,
    tournamentDirectorName: null,
    tournamentDirectorEmail: null,
    officialBall: null,
    // tournamentKey z factsheetu (může být jiný formát než z URL)
    tournamentKeyFactsheet: null,
  };

  // --- tournamentKey z URL (poslední segment, nebo před záložkou draws-and-results / fact-sheet atd.) ---
  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  if (pathSegments.length > 0) {
    const last = pathSegments[pathSegments.length - 1];
    const tabSlugs = ['draws-and-results', 'fact-sheet', 'acceptance-list', 'champions'];
    if (tabSlugs.includes(last.toLowerCase()) && pathSegments.length > 1) {
      data.tournamentKey = pathSegments[pathSegments.length - 2];
    } else {
      data.tournamentKey = last;
    }
  }

  // --- Normalizace data na YYYY-MM-DD ---
  function normalizeDate(val) {
    if (!val || typeof val !== 'string') return null;
    const s = val.trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // US format M/D/YYYY nebo M/D/YYYY H:MM (např. schema.org "2/15/2026 12:00:00 AM")
    const usMatch = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (usMatch) {
      const [, a, b, y] = usMatch;
      const year = y.length === 2 ? '20' + y : y;
      const n1 = parseInt(a, 10);
      const n2 = parseInt(b, 10);
      if (n1 >= 1 && n1 <= 12 && n2 >= 1 && n2 <= 31) {
        if (n1 > 12) return year + '-' + b.padStart(2, '0') + '-' + a.padStart(2, '0');
        return year + '-' + a.padStart(2, '0') + '-' + b.padStart(2, '0');
      }
    }
    const dmY = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
    if (dmY) {
      const [, d, m, y] = dmY;
      const year = y.length === 2 ? '20' + y : y;
      return year + '-' + m.padStart(2, '0') + '-' + d.padStart(2, '0');
    }
    const ymd = s.match(/(\d{4})[./\-](\d{1,2})[./\-](\d{1,2})/);
    if (ymd) {
      return ymd[1] + '-' + ymd[2].padStart(2, '0') + '-' + ymd[3].padStart(2, '0');
    }
    const months = 'january|february|march|april|may|june|july|august|september|october|november|december';
    const textMatch = s.match(new RegExp('(\\d{1,2})\\s+(' + months + ')\\s+(\\d{4})', 'i'));
    if (textMatch) {
      const [, day, monthName, year] = textMatch;
      const monthNum = ['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(monthName.toLowerCase()) + 1;
      return year + '-' + String(monthNum).padStart(2, '0') + '-' + day.padStart(2, '0');
    }
    const textMatch2 = s.match(new RegExp('(' + months + ')\\s+(\\d{1,2}),?\\s+(\\d{4})', 'i'));
    if (textMatch2) {
      const [, monthName, day, year] = textMatch2;
      const monthNum = ['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(monthName.toLowerCase()) + 1;
      return year + '-' + String(monthNum).padStart(2, '0') + '-' + day.padStart(2, '0');
    }
    const anyDmy = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
    if (anyDmy) {
      const [, d, m, y] = anyDmy;
      const year = y.length === 2 ? '20' + y : y;
      return year + '-' + m.padStart(2, '0') + '-' + d.padStart(2, '0');
    }
    return null;
  }

  // --- Najít hodnotu podle labelu POUZE v root (main) ---
  function findInRootByLabel(labelKeywords) {
    const keywords = Array.isArray(labelKeywords) ? labelKeywords : [labelKeywords];
    const items = root.querySelectorAll('.tournament-info__details-item');
    for (const item of items) {
      const labelEl = item.querySelector('.tournament-info__label');
      if (!labelEl) continue;
      const label = (labelEl.textContent || '').trim().toLowerCase();
      const matches = keywords.some((kw) => label.includes(kw.toLowerCase()));
      if (!matches) continue;
      const valueEl = item.querySelector('.tournament-info__value');
      if (valueEl) {
        const href = valueEl.getAttribute('href');
        if (href && href.startsWith('mailto:')) return href.replace('mailto:', '').trim();
        return (valueEl.textContent || '').trim();
      }
      const list = item.querySelector('.tournament-info__unordered-list');
      if (list) {
        const parts = [];
        list.querySelectorAll('li').forEach((li) => {
          const h2 = li.querySelector('h2');
          const div = li.querySelector('div');
          const title = h2 ? (h2.textContent || '').trim() : '';
          const lines = div ? Array.from(div.querySelectorAll('p')).map((p) => (p.textContent || '').trim()).filter(Boolean) : [];
          if (title) parts.push(title + ': ' + lines.join(', '));
          else parts.push(lines.join(', '));
        });
        return parts.join(' | ');
      }
      return null;
    }
    return null;
  }

  // --- Název turnaje (z main) ---
  const nameEl = root.querySelector('.tournament-hero__name, h1.tournament-hero__name, h1');
  if (nameEl) {
    const t = (nameEl.textContent || '').trim();
    if (t && t.length < 300) data.tournamentName = t;
  }

  // --- Hero: Dates, Host nation, Surface (jen v main) ---
  const heroItems = root.querySelectorAll('.tournament-hero__details-item');
  heroItems.forEach((item) => {
    const label = (item.querySelector('.tournament-hero__label')?.textContent || '').trim().toLowerCase();
    const value = (item.querySelector('.tournament-hero__value')?.textContent || '').trim();
    if (!value) return;
    if (label.includes('date')) data.startDate = normalizeDate(value) || value;
    if (label.includes('host nation')) data.country = value;
    if (label.includes('surface')) data.surface = value;
  });

  // --- Tournament Information: všechny položky z .tournament-info__details ---
  data.drawSize = findInRootByLabel(['draw size']);
  data.singlesMainDrawFormat = findInRootByLabel(['singles main draw format']);
  data.entryDeadline = findInRootByLabel(['entry deadline']);
  data.withdrawalDeadline = findInRootByLabel(['withdrawal deadline']);
  data.mainDrawSignIn = findInRootByLabel(['single main draw sign-in', 'main draw sign-in']);
  data.qualifyingSignIn = findInRootByLabel(['singles qualifying sign-in', 'qualifying sign-in']);
  data.firstDayQualifying = findInRootByLabel(['first day of singles qualifying']);
  data.firstDayMainDraw = findInRootByLabel(['first day of singles main draw']);
  data.tournamentDirectorName = findInRootByLabel(['tournament director name']);
  data.tournamentDirectorEmail = findInRootByLabel(['tournament director email']);
  data.officialBall = findInRootByLabel(['official ball']);
  data.tournamentKeyFactsheet = findInRootByLabel(['tournament key']);

  // --- Datumová pole (normalizované) ---
  if (!data.startDate && data.firstDayMainDraw) data.startDate = normalizeDate(data.firstDayMainDraw);
  data.entryDeadline = data.entryDeadline || null;
  data.withdrawalDeadline = data.withdrawalDeadline || null;

  // --- Tournament Venue (druhá sekce .tournament-info__details) ---
  const venueSections = root.querySelectorAll('.tournament-info__title');
  for (const titleEl of venueSections) {
    if ((titleEl.textContent || '').toLowerCase().includes('tournament venue')) {
      const details = titleEl.parentElement?.querySelector('.tournament-info__details') || titleEl.nextElementSibling;
      if (!details) break;
      const items = details.querySelectorAll('.tournament-info__details-item');
      items.forEach((item) => {
        const label = (item.querySelector('.tournament-info__label')?.textContent || '').trim().toLowerCase();
        const valueEl = item.querySelector('.tournament-info__value');
        const value = valueEl ? (valueEl.textContent || '').trim() : '';
        if (label.includes('venue name')) data.venue = value;
        if (label.includes('venue address')) data.venueAddress = value;
        if (label.includes('venue telephone')) data.venueTelephone = value;
      });
      break;
    }
  }

  // --- City z hero nebo z venue address ---
  if (!data.city && data.venueAddress) {
    const match = data.venueAddress.match(/, ([^,]+), [A-Za-z ]+$/);
    if (match) data.city = match[1].trim();
  }
  const schemaScript = root.querySelector('script[type="application/ld+json"]');
  if (schemaScript && !data.city) {
    try {
      const schema = JSON.parse(schemaScript.textContent);
      if (schema.location?.name) data.city = schema.location.name;
      if (!data.country && schema.location?.address?.addressCountry) data.country = schema.location.address.addressCountry;
      if (!data.startDate && schema.startDate) data.startDate = normalizeDate(schema.startDate);
      if (!data.endDate && schema.endDate) data.endDate = normalizeDate(schema.endDate);
    } catch (e) {}
  }

  // Použít oficiální klíč z factsheetu, když URL dá jen záložku (draws-and-results, fact-sheet…)
  if (data.tournamentKeyFactsheet) {
    data.tournamentKey = data.tournamentKeyFactsheet;
  } else if (data.tournamentKey && /^(draws-and-results|fact-sheet|acceptance-list|champions)$/i.test(data.tournamentKey)) {
    data.tournamentKey = null;
  }

  // Odstranit null/empty z výstupu
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (v != null && v !== '') out[k] = v;
  }

  const jsonOutput = JSON.stringify(out, null, 2);

  console.log('═══════════════════════════════════════');
  console.log('ITF FACTSHEET DATA (Fáze A):');
  console.log('═══════════════════════════════════════');
  console.log(jsonOutput);
  console.log('═══════════════════════════════════════');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(jsonOutput).then(() => {
      console.log('✓ JSON zkopírován do schránky.');
    }).catch(() => {
      console.log('⚠ Kopírování do schránky selhalo. Zkopíruj JSON výše.');
    });
  } else {
    console.log('⚠ Schránka není k dispozici. Zkopíruj JSON výše.');
  }

  const blob = new Blob([jsonOutput], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tournament-' + (out.tournamentKey || 'factsheet') + '.json';
  document.body.appendChild(a);
  console.log('💾 Stáhni soubor: levý klik na odkaz níže.');
  console.log(a);

  return out;
})();
