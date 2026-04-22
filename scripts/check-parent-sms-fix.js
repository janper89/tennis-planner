/**
 * Rychlá kontrola po refreshi a migraci: ověří, že tři turnaje z SMS od rodiče
 * (Villach, Targu Jiu, Budapest) mají v tournament_cache a tournament správná data
 * a že trigger parse_itf_deadline_date je nasazený.
 *
 * Použití:
 *   node scripts/check-parent-sms-fix.js
 */

const fs = require('fs');
const path = require('path');

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Chybi NEXT_PUBLIC_SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY v .env.local');
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, serviceKey);

const CASES = [
  { label: 'Villach J200', cityLike: 'villach' },
  { label: 'Targu Jiu (RUM)', cityLike: 'targu jiu' },
  { label: 'Budapest J100', cityLike: 'budapest', cat: 'J100' },
];

function fmt(row) {
  if (!row) return '  (nenalezeno)';
  return [
    `  tournament_key: ${row.tournament_key}`,
    `  name:           ${row.name || row.nazev}`,
    `  city:           ${row.city || row.misto}`,
    `  start/datum:    ${row.start_date || row.datum}`,
    row.first_day_main_draw ? `  firstDayMain:   ${row.first_day_main_draw}` : null,
    row.entry_deadline ? `  entry_deadline: ${row.entry_deadline}` : null,
    row.withdraw_deadline ? `  withdraw_deadl: ${row.withdraw_deadline}` : null,
    row.sign_in_deadline_text ? `  signIn(text):   ${row.sign_in_deadline_text}` : null,
    row.withdrawal_deadline_text ? `  withdraw(text): ${row.withdrawal_deadline_text}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

async function main() {
  console.log('=== Kontrola SMS od rodice po refreshi a migraci ===\n');

  for (const c of CASES) {
    console.log(`--- ${c.label} ---`);

    let cacheQuery = supabase
      .from('tournament_cache')
      .select('tournament_key, name, city, start_date, first_day_main_draw, entry_deadline, withdrawal_deadline, category')
      .ilike('city', `%${c.cityLike}%`)
      .order('start_date', { ascending: true });
    if (c.cat) cacheQuery = cacheQuery.eq('category', c.cat);
    const { data: cacheRows, error: cacheErr } = await cacheQuery;
    if (cacheErr) {
      console.log('  chyba cache:', cacheErr.message);
      continue;
    }
    console.log('[tournament_cache]');
    if (!cacheRows || cacheRows.length === 0) {
      console.log('  (v cache neni)');
    } else {
      for (const r of cacheRows) console.log(fmt(r));
    }

    let tQuery = supabase
      .from('tournament')
      .select('tournament_key, nazev, misto, datum, entry_deadline, withdraw_deadline, sign_in_deadline_text, withdrawal_deadline_text, kategorie')
      .ilike('misto', `%${c.cityLike}%`);
    if (c.cat) tQuery = tQuery.eq('kategorie', c.cat);
    const { data: tRows, error: tErr } = await tQuery;
    if (tErr) {
      console.log('  chyba tournament:', tErr.message);
      continue;
    }
    console.log('[tournament]');
    if (!tRows || tRows.length === 0) {
      console.log('  (zadne entry zatim neni)');
    } else {
      for (const r of tRows) console.log(fmt(r));
    }
    console.log('');
  }

  // Kontrola, zda je nasazen novy trigger. Jednoduse: zavolame funkci parse_itf_deadline_date.
  const { data: checkFn, error: fnErr } = await supabase.rpc('parse_itf_deadline_date', {
    deadline_text: 'Tue 14th April 2026 by 15:00GMT',
  });
  if (fnErr) {
    console.log('[migrace deadline] JESTE NENI NASAZENA:');
    console.log('  >>', fnErr.message);
    console.log('  Spust: supabase/fix_tournament_deadline_logic_from_itf.sql v SQL Editoru.');
  } else {
    console.log('[migrace deadline] OK, parse_itf_deadline_date vratilo:', checkFn);
  }

  // Globalni kontrola fallbacku YYYY-MM-01 v cache.
  const { data: bad, error: badErr } = await supabase
    .from('tournament_cache')
    .select('tournament_key, name, start_date, first_day_main_draw')
    .like('start_date', '%-01')
    .not('first_day_main_draw', 'is', null);
  if (!badErr && bad) {
    const realMismatches = bad.filter((r) => r.first_day_main_draw && r.first_day_main_draw !== r.start_date);
    console.log(`\n[cache YYYY-MM-01 anomalie] ${realMismatches.length} zaznamu, kde start_date konci na -01 a firstDayMainDraw se lisi.`);
    for (const r of realMismatches.slice(0, 10)) {
      console.log(`  ${r.tournament_key}: start=${r.start_date} firstDayMain=${r.first_day_main_draw} (${r.name})`);
    }
    if (realMismatches.length > 10) console.log(`  ... a dalsich ${realMismatches.length - 10}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
