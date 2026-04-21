/**
 * Nastaví heslo uživateli přes Supabase Admin API (bezpečné, správný formát).
 * Použij když SQL UPDATE hesla v auth.users stále dává "Invalid login credentials".
 *
 * Usage:
 *   node scripts/set-user-password.js
 *   node scripts/set-user-password.js --email=jan@example.com --password=jineheslo
 *   node scripts/set-user-password.js --user-id=UUID   # když listUsers ho nenašel
 *       (UUID získáš v Supabase SQL Editor: SELECT id FROM auth.users WHERE email = 'filip.marsik@tiscali.cz';)
 *
 * Env (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const emailArg = args.find((a) => a.startsWith('--email='));
const passwordArg = args.find((a) => a.startsWith('--password='));
const userIdArg = args.find((a) => a.startsWith('--user-id='));

const TARGET_EMAIL = (emailArg && emailArg.split('=')[1]) || 'filip.marsik@tiscali.cz';
const NEW_PASSWORD = (passwordArg && passwordArg.split('=')[1]) || 'vyjezdy123';
const TARGET_USER_ID = userIdArg && userIdArg.split('=')[1] ? userIdArg.split('=')[1].trim() : null;

const envPath = path.resolve(__dirname, '..', '.env.local');
try {
  require('dotenv').config({ path: envPath });
} catch (_) {
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
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Chybí NEXT_PUBLIC_SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY (nastav v .env.local)');
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

function withTimeout(promise, ms, msg) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout ${ms}s: ${msg}`)), ms)
    ),
  ]);
}

async function main() {
  console.log('Skript startuje...');
  let authUser = null;

  if (TARGET_USER_ID) {
    console.log('Nastavuji heslo pro user id:', TARGET_USER_ID);
    try {
      const result = await withTimeout(
        supabase.auth.admin.updateUserById(TARGET_USER_ID, { password: NEW_PASSWORD }),
        20000,
        'Volání Supabase Admin API trvá příliš dlouho. Zkontroluj síť nebo Supabase Dashboard.'
      );
      const updateError = result.error;
      if (updateError) {
        console.error('Chyba updateUserById (heslo):', updateError.message);
        if (updateError.message === 'User not found') {
          console.error('\n→ Uživatel s tímto ID neexistuje v tomto Supabase projektu.');
          console.error('  Možné příčiny: ID je z jiného projektu, nebo uživatel byl smazán.');
          console.error('  Řešení: Supabase Dashboard → Authentication → Users → najdi uživatele podle emailu');
          console.error('  a nastav heslo ručně, nebo vytvoř nového uživatele. Viz docs/nastaveni-hesla-bronislav-lebis.md');
        }
        process.exit(1);
      }
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
    console.log('Heslo nastaveno (Admin API).');
    authUser = { id: TARGET_USER_ID, email: TARGET_EMAIL };
  } else {
  console.log('Hledám uživatele:', TARGET_EMAIL);

  const emailNorm = (e) => (e || '').trim().toLowerCase();
  const targetNorm = emailNorm(TARGET_EMAIL);

  let page = 1;
  const perPage = 1000;
  const maxPages = 20;
  while (page <= maxPages) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error('Chyba listUsers:', error.message);
      process.exit(1);
    }
    authUser = data.users.find((u) => u.email && emailNorm(u.email) === targetNorm);
    if (authUser) break;
    if (!data.users.length || data.users.length < perPage) break;
    page++;
  }

  if (!authUser) {
    console.log('V Auth uživatel neexistuje, vytvářím ho (Admin API)...');
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: TARGET_EMAIL.trim(),
      password: NEW_PASSWORD,
      email_confirm: true,
    });
    if (createError) {
      if (createError.message && createError.message.includes('checking email')) {
        console.log('E-mail už v Auth existuje (DB), prohledávám znovu všechny stránky...');
        page = 1;
        while (page <= maxPages) {
          const { data: data2, error: err2 } = await supabase.auth.admin.listUsers({ page, perPage });
          if (err2) break;
          authUser = data2.users.find((u) => u.email && emailNorm(u.email) === targetNorm);
          if (authUser) break;
          if (!data2.users.length || data2.users.length < perPage) break;
          page++;
        }
        if (!authUser) {
          console.error('Uživatel s emailem', TARGET_EMAIL, 'v Auth existuje, ale listUsers ho nenašel. Nastav heslo přes SQL: supabase/fix_filip_marsik_login.sql');
          process.exit(1);
        }
      } else {
        console.error('Chyba createUser:', createError.message);
        process.exit(1);
      }
    } else {
      authUser = created.user;
      console.log('Vytvořen auth user:', authUser.id, authUser.email);
    }
  }
  }

  if (authUser && !TARGET_USER_ID) {
    console.log('Nalezen auth user:', authUser.id, authUser.email);
    const { error: updateError } = await supabase.auth.admin.updateUserById(authUser.id, {
      password: NEW_PASSWORD,
    });
    if (updateError) {
      console.error('Chyba updateUserById (heslo):', updateError.message);
      process.exit(1);
    }
    console.log('Heslo nastaveno (Admin API).');
  }

  if (!authUser) {
    console.error('Nepodařilo se získat auth user.');
    process.exit(1);
  }

  const { data: appRows, error: appError } = await supabase
    .from('app_user')
    .select('id, email, role')
    .eq('email', authUser.email);

  if (appError) {
    console.warn('app_user select:', appError.message);
  } else if (!appRows || appRows.length === 0) {
    const { error: insErr } = await supabase.from('app_user').insert({
      email: authUser.email,
      role: 'parent',
    });
    if (insErr) console.warn('app_user insert:', insErr.message);
    else console.log('Do app_user doplněn záznam s rolí parent.');
  } else {
    console.log('app_user v pořádku:', appRows[0].email, appRows[0].role);
  }

  console.log('\nHotovo. Uživatel se může přihlásit s emailem', TARGET_EMAIL, 'a heslem', NEW_PASSWORD);
}

main();
