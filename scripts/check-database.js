// Script pro kontrolu dat v Supabase
// Spusť: node scripts/check-database.js
// Nebo: NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... node scripts/check-database.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Chybí environment variables!');
  console.log('Nastav je takto:');
  console.log('export NEXT_PUBLIC_SUPABASE_URL="tvoje-url"');
  console.log('export NEXT_PUBLIC_SUPABASE_ANON_KEY="tvoje-key"');
  console.log('node scripts/check-database.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log('🔍 Kontroluji databázi...\n');

  try {
    // 1. Zkontroluj app_user
    console.log('📋 Uživatelé v app_user:');
    const { data: users, error: usersError } = await supabase
      .from('app_user')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('❌ Chyba při načítání uživatelů:', usersError.message);
    } else {
      if (users && users.length > 0) {
        console.table(users);
        console.log(`✅ Celkem uživatelů: ${users.length}\n`);
      } else {
        console.log('⚠️  Žádní uživatelé v app_user\n');
      }
    }

    // 2. Zkontroluj hráče
    console.log('👥 Hráči:');
    const { data: players, error: playersError } = await supabase
      .from('player')
      .select('*')
      .order('created_at', { ascending: false });

    if (playersError) {
      console.error('❌ Chyba při načítání hráčů:', playersError.message);
    } else {
      if (players && players.length > 0) {
        console.table(players);
        console.log(`✅ Celkem hráčů: ${players.length}\n`);
      } else {
        console.log('⚠️  Žádní hráči\n');
      }
    }

    // 3. Zkontroluj turnaje
    console.log('🏆 Turnaje:');
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournament')
      .select('*')
      .order('datum', { ascending: false });

    if (tournamentsError) {
      console.error('❌ Chyba při načítání turnajů:', tournamentsError.message);
    } else {
      if (tournaments && tournaments.length > 0) {
        console.table(tournaments);
        console.log(`✅ Celkem turnajů: ${tournaments.length}\n`);
      } else {
        console.log('⚠️  Žádné turnaje\n');
      }
    }

    // 4. Zkontroluj přihlášky
    console.log('📝 Přihlášky:');
    const { data: entries, error: entriesError } = await supabase
      .from('entry')
      .select('*')
      .order('created_at', { ascending: false });

    if (entriesError) {
      console.error('❌ Chyba při načítání přihlášek:', entriesError.message);
    } else {
      if (entries && entries.length > 0) {
        console.table(entries);
        console.log(`✅ Celkem přihlášek: ${entries.length}\n`);
      } else {
        console.log('⚠️  Žádné přihlášky\n');
      }
    }

  } catch (error) {
    console.error('❌ Neočekávaná chyba:', error);
  }
}

checkDatabase();

